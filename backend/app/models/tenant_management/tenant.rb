module TenantManagement
  class Tenant < ApplicationRecord
    self.table_name = "public.platform_tenants"
    has_many :contacts, class_name: "TenantManagement::Contact", foreign_key: :tenant_id
    has_one :branding, class_name: "TenantManagement::Branding", foreign_key: :tenant_id
    has_one :subscription, class_name: "TenantManagement::Subscription", foreign_key: :tenant_id
    has_many :assignments, class_name: "TenantManagement::Assignment", foreign_key: :tenant_id
    has_many :audit_events, class_name: "TenantManagement::AuditEvent", foreign_key: :tenant_id
    validates :provisioning_status, inclusion: { in: %w[pending ready] }
    before_destroy { throw :abort } # No destructive policy has been approved.
  end
end
