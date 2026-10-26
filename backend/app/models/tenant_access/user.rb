module TenantAccess
  class User < ApplicationRecord
    self.table_name = "public.tenant_access_users"
    devise :database_authenticatable, :validatable, :timeoutable
    def active_for_authentication? = super && enabled?
    before_update do
      if enabled? && will_save_change_to_enabled?
        ids = TenantAccess::Membership.where(user_id:id,enabled:true).pluck(:tenant_id)
        TenantManagement::Tenant.where(id:ids).order(:id).each do |tenant|
          tenant.lock!
          TenantManagement::Seats.ensure_room!(tenant,email)
        end
      end
    end
  end
end
