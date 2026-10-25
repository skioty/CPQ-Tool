module TenantManagement
  class SetupReview
    GROUPS = {
      "company" => ["Company information", %w[company_name industry_id]],
      "contacts" => ["Company contacts", ["contacts"]],
      "assignment" => ["Responsible CPQ Admin", ["responsible_admin_ids"]],
      "subscription" => ["Subscription settings", ["subscription"]],
      "branding" => ["Workspace branding", ["branding"]]
    }.freeze

    def self.call(actor, tenant)
      errors = {}
      begin
        BusinessRules.validate!(actor, {}, tenant)
      rescue Error => error
        raise unless error.code == "validation_failed"
        errors = error.fields.stringify_keys
      end
      checks = GROUPS.map do |key, (label, prefixes)|
        fields = errors.select { |field, _| prefixes.any? { |prefix| field == prefix || field.start_with?("#{prefix}.") } }
        { key: key, label: label, complete: fields.empty?, errors: fields }
      end
      checks << { key: "provisioning", label: "Schema provisioning", complete: tenant.provisioning_status == "ready",
                  errors: tenant.provisioning_status == "ready" ? {} : { provisioning: ["Provisioning must finish before activation"] } }
      { tenant_id: tenant.id, company_name: tenant.company_name, lifecycle_status: tenant.lifecycle_status,
        checks: checks, complete: checks.all? { |check| check[:complete] },
        can_activate: checks.all? { |check| check[:complete] } && Lifecycle.actions(actor, tenant).include?("activate") }
    end
  end
end
