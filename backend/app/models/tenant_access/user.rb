module TenantAccess
  class User < ApplicationRecord
    self.table_name = "public.tenant_access_users"
    devise :database_authenticatable, :validatable, :timeoutable
    def active_for_authentication? = super && enabled?
  end
end
