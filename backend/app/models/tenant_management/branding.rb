module TenantManagement
  class Branding < ApplicationRecord
    self.table_name = "public.platform_tenant_brandings"
    belongs_to :tenant, class_name: "TenantManagement::Tenant"
  end
end
