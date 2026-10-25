module TenantAccess
  class Membership < ApplicationRecord
    self.table_name = "public.tenant_access_memberships"
    belongs_to :user, class_name: "TenantAccess::User"
    belongs_to :tenant, class_name: "TenantManagement::Tenant"
    validates :role, inclusion: { in: ["tenant_admin"] }
  end
end
