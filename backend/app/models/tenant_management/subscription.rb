module TenantManagement
  class Subscription < ApplicationRecord
    self.table_name = "public.platform_tenant_subscriptions"
    belongs_to :tenant, class_name: "TenantManagement::Tenant"
  end
end
