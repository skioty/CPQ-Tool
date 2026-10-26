module TenantManagement
  class BrandAsset < ApplicationRecord
    self.table_name = "public.platform_brand_assets"
    belongs_to :tenant, class_name: "TenantManagement::Tenant", optional: true
    attr_readonly :owner_id, :kind, :content, :content_type
  end
end
