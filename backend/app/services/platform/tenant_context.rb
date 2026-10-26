module Platform
  class TenantContext
    def self.with(actor:, tenant_id:)
      ActiveRecord::Base.connection_pool.with_connection do
        Apartment::Tenant.reset
        tenant = Access.new.scope(actor).find(tenant_id)
        Access.new.authorize!(actor, :read, tenant)
        within_registry(tenant) { yield tenant }
      ensure
        Apartment::Tenant.reset
      end
    end

    def self.with_membership(user:, tenant_id:)
      ActiveRecord::Base.connection_pool.with_connection do
        Apartment::Tenant.reset
        unless user.is_a?(TenantAccess::User) && user.persisted? && user.reload.enabled?
          raise TenantManagement::Error.new("unauthenticated", "Tenant sign-in is required", status: 401)
        end
        member = TenantAccess::Membership.find_by!(user_id: user.id, tenant_id: tenant_id, enabled: true)
        tenant = TenantManagement::Tenant.find(member.tenant_id)
        within_registry(tenant) { yield tenant }
      ensure
        Apartment::Tenant.reset
      end
    end

    def self.within_registry(tenant)
      unless tenant.provisioning_status == "ready"
        raise TenantManagement::Error.new("tenant_unavailable", "Tenant provisioning is not ready", status: 409)
      end
      # Approved tenant-user workspace policy: only active tenants; management APIs remain accessible to authorized platform staff.
      approved = Rails.application.config.x.tenant_management.workspace_access.call(tenant)
      unless approved == true
        raise TenantManagement::Error.new("tenant_unavailable", "Tenant workspace requires active status", status: 409)
      end
      Apartment::Tenant.switch(tenant.schema_key) do
        unless TenantMigrator.current?
          raise TenantManagement::Error.new("tenant_unavailable", "Tenant schema migrations are pending", status: 409)
        end
        yield tenant
      end
    end
    private_class_method :within_registry
  end
end
