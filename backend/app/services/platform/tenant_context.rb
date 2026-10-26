module Platform
  class TenantContext
    def self.with(actor:, tenant_id:)
      ActiveRecord::Base.connection_pool.with_connection do
        Apartment::Tenant.reset
        tenant = Access.new.scope(actor).find(tenant_id)
        Access.new.authorize!(actor, :read, tenant)
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
      ensure
        Apartment::Tenant.reset
      end
    end
  end
end
