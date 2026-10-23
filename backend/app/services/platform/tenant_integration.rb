module Platform
  class TenantIntegration < TenantManagement::Integration
    def authenticate!(controller)
      @request_id = controller.request.request_id
      actor = controller.current_administrator
      Access.new.verified!(actor)
      actor
    end
    def scope!(actor) = Access.new.scope(actor)
    def authorize!(actor, action, tenant = nil) = Access.new.authorize!(actor, action, tenant)

    def validate_assignments!(actor, ids, tenant)
      Access.new.authorize!(actor, tenant.persisted? ? :update : :create, tenant)
      if !actor.super_admin? && ids.sort != tenant.assignments.pluck(:administrator_id).sort
        raise TenantManagement::Error.new("forbidden", "Administrator reassignment requires Super Admin", status: 403)
      end
      unless Administrator.where(id: ids, role: "admin", enabled: true).count == ids.length
        raise TenantManagement::Error.new("validation_failed", "Review the highlighted fields", fields: { responsible_admin_ids: ["Assignments require eligible CPQ Admin accounts"] })
      end
      # Cardinality still belongs to approved business validation.
      true
    end

    def validate_business!(actor, attributes, tenant)
      unless tenant.persisted?
        attributes["branding"] = TenantManagement::BusinessRules::DEFAULT_BRANDING.merge((attributes["branding"] || {}).transform_values { |v| v.presence })
        TenantManagement::BusinessRules::DEFAULT_BRANDING.each { |k,v| attributes["branding"][k] ||= v }
        attributes["subscription"] ||= {}
        attributes["subscription"]["discount"] = { "type" => "percentage", "value" => "0", "duration" => nil }.merge(attributes["subscription"]["discount"] || {})
      end
      TenantManagement::BusinessRules.validate!(actor, attributes, tenant)
    end
    def permitted_actions(actor, tenant) = TenantManagement::Lifecycle.actions(actor, tenant)
    def initial_lifecycle! = "inactive"
    def filter_status!(status)
      raise TenantManagement::Error.new("invalid_filter", "Unknown status", status: 400) unless %w[inactive active suspended archived].include?(status)
      true
    end
    def validate_assets!(actor, ids, tenant)
      ids.each do |key, id|
        next if id.nil?
        asset = TenantManagement::BrandAsset.lock.find_by(id: id, kind: key.delete_suffix("_attachment_id"))
        unless asset && (asset.tenant_id == tenant.id || (asset.tenant_id.nil? && asset.owner_id == actor.id))
          raise TenantManagement::Error.new("validation_failed", "Invalid branding asset", fields: { "branding.#{key}" => ["Asset must belong to this tenant and kind"] })
        end
        asset.update!(tenant_id: tenant.id, storage_key: "#{tenant.id}/#{asset.id}") if asset.tenant_id.nil?
      end
      true
    end

    def provision!(tenant) = SchemaProvisioner.provision!(tenant)
    def compensate!(receipt) = SchemaProvisioner.compensate!(receipt)
    def record_provisioning_failure!(tenant_id, code)
      ProvisioningFailure.create!(tenant_id: tenant_id, request_id: @request_id || SecureRandom.uuid,
        error_code: code, created_at: Time.current)
    end
  end
end
