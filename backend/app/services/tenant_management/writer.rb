module TenantManagement
  class Writer
    def initialize(integration:, actor:, request_id:)
      @integration, @actor, @request_id = integration, actor, request_id
    end

    def create(attributes)
      receipt = nil
      tenant = nil
      attempt_tenant_id = nil
      begin
        Tenant.transaction do
          Tenant.connection.execute("SET CONSTRAINTS ALL DEFERRED")
          approved!(@integration.authorize!(@actor, :create))
          tenant = Tenant.new(provisioning_status: "pending")
          approved!(@integration.validate_business!(@actor, attributes, tenant))
          require_contacts!(attributes)
          tenant.assign_attributes(attributes.slice(*Payload::SCALARS))
          tenant.lifecycle_status = @integration.initial_lifecycle!
          tenant.save!
          attempt_tenant_id = tenant.id
          persist_settings!(tenant, attributes)
          Seats.validate!(tenant)
          # Validate constraints before external effects (not just at commit).
          Tenant.connection.execute("SET CONSTRAINTS ALL IMMEDIATE")
          receipt = @integration.provision!(tenant)
          raise Error.new("provisioning_failed", "Tenant provisioning did not complete", status: 503) unless receipt
          tenant.update!(provisioning_status: "ready")
          audit!(tenant, "created", attributes)
          tenant
        end
      rescue StandardError => original_error
        # Adapter must clean its own partial effects when provision! raises before returning.
        if receipt
          begin
            approved!(@integration.compensate!(receipt))
          rescue StandardError => cleanup_error
            Rails.logger.error("Tenant provisioning compensation failed request_id=#{@request_id} error_class=#{cleanup_error.class.name}")
            raise Error.new("provisioning_recovery_required", "Tenant provisioning requires administrator recovery", status: 503)
          end
        end
        if attempt_tenant_id && original_error.is_a?(Error) && %w[provisioning_failed schema_conflict].include?(original_error.code)
          @integration.record_provisioning_failure!(attempt_tenant_id, original_error.code)
        end
        raise
      end
    end

    def update(tenant, attributes, expected_version:)
      tenant.with_lock do
        Tenant.connection.execute("SET CONSTRAINTS ALL DEFERRED")
        approved!(@integration.authorize!(@actor, :update, tenant))
        unless tenant.lock_version == expected_version
          raise Error.new("stale_version", "Tenant changed; reload before saving", status: 409)
        end
        approved!(@integration.validate_business!(@actor, attributes, tenant))
        tenant.assign_attributes(attributes.slice(*Payload::SCALARS))
        tenant.assign_attributes(billing_resolved:nil,contracts_resolved:nil,retention_records_approved:nil) if attributes.key?("subscription")
        persist_settings!(tenant, attributes)
        Seats.validate!(tenant)
        # touch increments lock_version even when only child settings change.
        tenant.save!
        tenant.touch
        audit!(tenant, "updated", attributes)
        Tenant.connection.execute("SET CONSTRAINTS ALL IMMEDIATE")
        tenant
      end
    end

    private

    def approved!(result)
      return if result == true
      raise Error.new("integration_unavailable", "Tenant management approval is unavailable", status: 503)
    end

    def require_contacts!(attributes)
      return if attributes.key?("contacts")
      raise Error.new("validation_failed", "Review the highlighted fields", fields: { contacts: ["Exactly one primary contact is required"] })
    end

    def persist_settings!(tenant, attributes)
      replace_contacts!(tenant, attributes["contacts"]) if attributes.key?("contacts")
      if attributes.key?("branding")
        changes = attributes["branding"]
        assets = changes.slice("logo_attachment_id", "favicon_attachment_id")
        approved!(@integration.validate_assets!(@actor, assets, tenant)) unless assets.empty?
        record = tenant.branding || tenant.build_branding
        record.update!(changes)
      end
      if attributes.key?("subscription")
        changes = attributes["subscription"].except("discount")
        changes["pricing_conversion"] = nil if changes["pricing_mode"] == "custom"
        if attributes["subscription"].key?("discount")
          attributes["subscription"]["discount"].each { |key, value| changes["discount_#{key}"] = value }
        end
        %w[fee discount_value].each { |key| changes[key] = nil if changes[key] == "" }
        record = tenant.subscription || tenant.build_subscription
        record.update!(changes)
      end
      if attributes.key?("responsible_admin_ids")
        ids = attributes["responsible_admin_ids"]
        approved!(@integration.validate_assignments!(@actor, ids, tenant))
        tenant.assignments.where.not(administrator_id: ids).destroy_all
        ids.each { |id| tenant.assignments.find_or_create_by!(administrator_id: id) }
      end
    end

    def replace_contacts!(tenant, values)
      existing = tenant.contacts.index_by(&:id)
      values.each do |value|
        if value["id"].present? && !existing.key?(value["id"])
          raise Error.new("validation_failed", "Review the highlighted fields", fields: { contacts: ["Contact identifiers must belong to this tenant"] })
        end
      end
      # Clear first to avoid transient collision when the primary changes.
      tenant.contacts.update_all(primary: false)
      retained = []
      values.each do |value|
        contact = value["id"].present? ? existing.fetch(value["id"]) : tenant.contacts.build
        contact.reload if contact.persisted?
        contact.update!(value.except("id"))
        retained << contact.id
      end
      tenant.contacts.where.not(id: retained).destroy_all
    end

    def audit!(tenant, action, attributes)
      # Keys only: no contact details, values, payment data, passwords or tokens.
      tenant.audit_events.create!(actor_id: @actor.id.to_s, action: action,
        request_id: @request_id, changed_fields: attributes.keys.sort, created_at: Time.current)
    end
  end
end
