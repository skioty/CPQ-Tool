module TenantManagement
  class Contact < ApplicationRecord
    self.table_name = "public.platform_tenant_contacts"
    belongs_to :tenant, class_name: "TenantManagement::Tenant"
    validates :primary, inclusion: { in: [true, false] }
  end
end
