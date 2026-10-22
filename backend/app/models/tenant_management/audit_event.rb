module TenantManagement
  class AuditEvent < ApplicationRecord
    self.table_name = "public.platform_tenant_audit_events"
    belongs_to :tenant, class_name: "TenantManagement::Tenant"
    def readonly?
      persisted?
    end
  end
end
