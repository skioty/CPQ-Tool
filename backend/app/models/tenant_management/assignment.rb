module TenantManagement
  class Assignment < ApplicationRecord
    self.table_name = "public.platform_tenant_assignments"
    belongs_to :tenant, class_name: "TenantManagement::Tenant"
    validates :administrator_id, presence: true, uniqueness: { scope: :tenant_id }
  end
end
