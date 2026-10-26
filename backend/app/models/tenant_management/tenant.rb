module TenantManagement
  class Tenant < ApplicationRecord
    self.table_name = "public.platform_tenants"
    attr_readonly :schema_key
    before_validation(on: :create) { self.schema_key ||= "cpq_t_#{SecureRandom.hex(16)}" }
    has_many :contacts, class_name: "TenantManagement::Contact", foreign_key: :tenant_id
    has_one :branding, class_name: "TenantManagement::Branding", foreign_key: :tenant_id
    has_one :subscription, class_name: "TenantManagement::Subscription", foreign_key: :tenant_id
    has_many :assignments, class_name: "TenantManagement::Assignment", foreign_key: :tenant_id
    has_many :audit_events, class_name: "TenantManagement::AuditEvent", foreign_key: :tenant_id
    validate do
      if time_zone.present?
        begin
          TZInfo::Timezone.get(time_zone)
        rescue TZInfo::InvalidTimezoneIdentifier
          errors.add(:time_zone, "must be a valid IANA time zone")
        end
      end
      %i[display_name country].each { |field| errors.add(field, "is too long") if public_send(field).to_s.length > 255 }
    end
    validates :provisioning_status, inclusion: { in: %w[pending ready] }
    validates :user_limit, numericality: {only_integer:true,greater_than:0,less_than_or_equal_to:2147483647}
    validates :primary_contact_role, inclusion: {in:["tenant_admin"]}
    before_destroy { throw :abort } # Generic destroy is blocked; reviewed permanent deletion uses the dedicated retention service.
  end
end
