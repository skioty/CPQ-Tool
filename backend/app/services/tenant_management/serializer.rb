module TenantManagement
  class Serializer
    def self.detail(tenant)
      branding = tenant.branding
      subscription = tenant.subscription
      {
        id: tenant.id,
        **tenant.attributes.slice(*Payload::SCALARS).symbolize_keys,
        lifecycle_status: tenant.lifecycle_status,
        provisioning_status: tenant.provisioning_status,
        lock_version: tenant.lock_version,
        contacts: tenant.contacts.order(:created_at, :id).map { |c| c.attributes.slice(*Payload::CONTACT) },
        responsible_admin_ids: tenant.assignments.order(:administrator_id).pluck(:administrator_id),
        branding: Payload::BRANDING.index_with { |key| branding&.public_send(key) },
        subscription: {
          currency: subscription&.currency,
          fee: subscription&.fee&.to_s("F"),
          payment_method: subscription&.payment_method,
          payment_method_description: subscription&.payment_method_description,
          billing_interval: "monthly",
          discount: {
            type: subscription&.discount_type,
            value: subscription&.discount_value&.to_s("F"),
            duration: subscription&.discount_duration
          }
        }
      }
    end
  end
end
