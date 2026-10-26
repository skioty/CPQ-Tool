module TenantManagement
  class RetentionDeletion
    REVIEW_FIELDS = %w[legal_hold billing_resolved contracts_resolved retention_records_approved].freeze
    def self.days
      raw = ENV.fetch("TENANT_RETENTION_DAYS","90")
      raw.match?(/\A\d+\z/) && raw.to_i.between?(1,36500) ? raw.to_i : nil
    end
    def self.eligibility(actor, tenant)
      Platform::Access.new.authorize!(actor,:read,tenant)
      reasons = []
      reasons << "Only CPQ Super Admins may permanently delete tenants." unless actor.super_admin?
      reasons << "Permanent deletion is disabled in production pending SELISE retention and backup approval." if Rails.env.production?
      reasons << "Archive this tenant before requesting permanent deletion." unless tenant.lifecycle_status == "archived"
      reasons << "The retention period is not validly configured." unless days
      reasons << "The archive timestamp is unknown." unless tenant.archived_at
      eligible_at = tenant.archived_at && days && tenant.archived_at + days.days
      reasons << "The retention period has not elapsed." if eligible_at && Time.current < eligible_at
      reasons << (tenant.legal_hold.nil? ? "Legal hold status has not been reviewed." : "A legal hold blocks deletion.") unless tenant.legal_hold == false
      reasons << "Unresolved or unreviewed billing blocks deletion." unless tenant.billing_resolved == true
      reasons << "Unresolved or unreviewed subscriptions/contracts block deletion." unless tenant.contracts_resolved == true
      unless tenant.retention_records_approved == true && tenant.retention_policy_reference.present?
        reasons << "Approve and reference the retention policy for records that must be preserved."
      end
      {eligible:reasons.empty?,eligible_at:eligible_at&.iso8601,archived_at:tenant.archived_at&.iso8601,retention_days:days,blocking_reasons:reasons,
       clearances:tenant.attributes.slice(*REVIEW_FIELDS,"retention_policy_reference")}
    end
    def self.review!(actor,tenant,values,note)
      Platform::Access.new.verified!(actor)
      raise Error.new("forbidden","Super Admin access is required",status:403) unless actor.super_admin?
      raise Error.new("validation_failed","Provide a review note") unless note.is_a?(String) && note.strip.length.between?(1,500)
      attrs = values.slice(*REVIEW_FIELDS,"retention_policy_reference")
      raise Error.new("validation_failed","Provide at least one clearance") if attrs.empty?
      REVIEW_FIELDS.each do |field|
        raise Error.new("validation_failed","Clearances must be true, false or null") if attrs.key?(field) && ![true,false,nil].include?(attrs[field])
      end
      if attrs.key?("retention_policy_reference") && !(attrs["retention_policy_reference"].nil? || attrs["retention_policy_reference"].is_a?(String) && attrs["retention_policy_reference"].length <= 255)
        raise Error.new("validation_failed","Provide a valid policy reference")
      end
      tenant.with_lock do
        tenant.update!(attrs)
        Platform::TenantRetentionEvent.create!(tenant_id:tenant.id,actor_id:actor.id,action:"retention_clearances_reviewed",details:attrs.merge("review_note"=>note),created_at:Time.current)
        tenant.audit_events.create!(actor_id:actor.id,action:"retention_reviewed",changed_fields:attrs.keys,request_id:SecureRandom.uuid,created_at:Time.current)
      end
      eligibility(actor,tenant)
    end
    def self.delete!(actor,tenant,password,confirmation)
      Platform::Access.new.verified!(actor)
      raise Error.new("forbidden","Super Admin access is required",status:403) unless actor.super_admin?
      raise Error.new("reauthentication_failed","Re-enter your current password",status:401) unless password.is_a?(String) && actor.valid_password?(password)
      tenant.with_lock do
        raise Error.new("validation_failed","Type the tenant name exactly") unless confirmation == tenant.company_name
        report = eligibility(actor,tenant)
        raise Error.new("deletion_blocked",report[:blocking_reasons].join(" "),status:409) unless report[:eligible]
        raise Error.new("deletion_blocked","The stored schema identity is not valid",status:409) unless tenant.schema_key.match?(/\Acpq_t_[0-9a-f]{32}\z/)
        Apartment::Tenant.reset
        Tenant.connection.execute("SET CONSTRAINTS ALL DEFERRED")
        history = tenant.audit_events.order(:created_at,:id).map { |e| e.attributes.slice("actor_id","action","changed_fields","created_at") }
        Platform::TenantRetentionEvent.create!(tenant_id:tenant.id,actor_id:actor.id,action:"permanently_deleted",created_at:Time.current,
          details:{"company_name"=>tenant.company_name,"archived_at"=>tenant.archived_at,"retention_policy_reference"=>tenant.retention_policy_reference,"audit_history"=>history})
        [TenantAccess::Membership,Platform::Invitation,BrandAsset,Contact,Branding,Subscription,Assignment,AuditEvent].each { |model| model.where(tenant_id:tenant.id).delete_all }
        Tenant.connection.execute("DROP SCHEMA #{Tenant.connection.quote_column_name(tenant.schema_key)} CASCADE")
        Tenant.where(id:tenant.id).delete_all
      ensure
        Apartment::Tenant.reset
      end
      true
    end
  end
end
