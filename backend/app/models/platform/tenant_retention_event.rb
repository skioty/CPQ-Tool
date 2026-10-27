module Platform
  class TenantRetentionEvent < ApplicationRecord
    self.table_name = "public.platform_tenant_retention_events"
    def readonly? = persisted?
  end
end
