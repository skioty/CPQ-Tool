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

    def provision!(tenant) = SchemaProvisioner.provision!(tenant)
    def compensate!(receipt) = SchemaProvisioner.compensate!(receipt)
    def record_provisioning_failure!(tenant_id, code)
      ProvisioningFailure.create!(tenant_id: tenant_id, request_id: @request_id || SecureRandom.uuid,
        error_code: code, created_at: Time.current)
    end
  end
end
