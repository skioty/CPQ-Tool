module TenantAccess
  class Membership < ApplicationRecord
    self.table_name = "public.tenant_access_memberships"
    belongs_to :user, class_name: "TenantAccess::User"
    belongs_to :tenant, class_name: "TenantManagement::Tenant"
    validates :role, inclusion: { in: ["tenant_admin"] }
    before_save do
      if enabled? && (new_record? || will_save_change_to_enabled? || will_save_change_to_user_id? || will_save_change_to_tenant_id?)
        tenant.lock!
        TenantManagement::Seats.ensure_room!(tenant,user.email) if user.enabled?
      end
    end
  end
end
