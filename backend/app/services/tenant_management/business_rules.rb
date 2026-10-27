module TenantManagement
  class BusinessRules
    DEFAULT_BRANDING = { "primary_colour" => "#17365D", "secondary_colour" => "#2563EB", "typography" => "system" }.freeze
    FONTS = [{id:"open_sans",label:"Open Sans",fontFamily:"'Open Sans', sans-serif"}, { id: "system", label: "System sans serif", fontFamily: "system-ui, sans-serif" },
      { id: "serif", label: "System serif", fontFamily: "Georgia, serif" }].freeze
    def self.validate!(actor, changes, tenant)
      errors = {}
      current = tenant.persisted? ? Serializer.detail(tenant).deep_stringify_keys : {}
      data = current.deep_merge(changes)
      required = ->(key, value) { errors[key] = ["Required"] if value.blank? }
      %w[company_name industry_id].each { |key| required.call(key, data[key]) }
      admins = data["responsible_admin_ids"] || []
      errors["responsible_admin_ids"] = ["Exactly one responsible CPQ Admin is required"] unless admins.size == 1
      eligible = Platform::Administrator.where(id: admins, role: "admin", enabled: true).lock.to_a
      errors["responsible_admin_ids"] = ["Select one enabled CPQ Admin"] unless admins.size == 1 && eligible.size == 1
      contacts = data["contacts"] || []
      errors["contacts"] = ["Exactly one primary contact is required"] unless contacts.count { |c| c["primary"] == true } == 1
      contacts.each_with_index do |contact, i|
        required.call("contacts.#{i}.name", contact["name"])
        unless contact["email"].to_s.match?(URI::MailTo::EMAIL_REGEXP)
          errors["contacts.#{i}.email"] = ["Enter a valid email address"]
        end
      end
      sub = data["subscription"] || {}
      old_sub = current["subscription"] || {}
      if tenant.persisted? && !actor.super_admin? && changes.key?("subscription") && changes["subscription"].any? { |k, v| old_sub[k] != v }
        raise Error.new("forbidden", "Commercial changes require Super Admin", status: 403)
      end
      decimal = ->(key, raw, max) do
        if !raw.to_s.match?(/\A\d+(?:\.\d{1,2})?\z/) || BigDecimal(raw.to_s) > max
          errors[key] = ["Must be between 0 and #{max.to_s('F')} with at most two decimal places"]
        end
      end
      decimal.call("subscription.fee", sub["fee"], BigDecimal("999999999.99"))
      discount = sub["discount"] || {}
      decimal.call("subscription.discount.value", discount["value"].presence || "0", BigDecimal("100"))
      errors["subscription.discount.type"] = ["Use percentage"] unless discount["type"] == "percentage"
      if (discount["value"].to_f > 0 || discount["duration"].present?) && !discount["duration"].to_s.match?(/\A[1-9]\d*\z/)
        errors["subscription.discount.duration"] = ["Use positive whole monthly billing cycles"]
      end
      if sub["fee"].to_f > 0
        required.call("subscription.payment_method", sub["payment_method"])
      end
      if sub["payment_method"] == "other"
        required.call("subscription.payment_method_description", sub["payment_method_description"])
      end
      if tenant.subscription&.first_invoiced_at && old_sub["currency"] != sub["currency"]
        errors["subscription.currency"] = ["Cannot change after first invoice"]
      end
      { "industry" => [data["industry_id"], current["industry_id"], "industry_id"],
        "currency" => [sub["currency"], old_sub["currency"], "subscription.currency"],
        "payment_method" => [sub["payment_method"], old_sub["payment_method"], "subscription.payment_method"] }.each do |kind, (value, old, path)|
        next if kind == "payment_method" && value.blank? && sub["fee"].to_f == 0
        next if tenant.persisted? && value.present? && value == old
        # Hold the catalogue row until the writer commits: deletion/deactivation must
        # serialize with a tenant selecting the option, not race an existence check.
        errors[path] = ["Select an enabled option"] unless ReferenceOption.where(kind: kind, code: value, enabled: true).lock("FOR SHARE").first
      end
      branding = data["branding"] || {}
      %w[primary_colour secondary_colour].each do |key|
        errors["branding.#{key}"] = ["Use a six-digit hex colour"] unless branding[key].to_s.match?(/\A#[0-9a-f]{6}\z/i)
      end
      errors["branding.typography"] = ["Select a supported font"] unless FONTS.any? { |f| f[:id] == branding["typography"] }
      raise Error.new("validation_failed", "Review the highlighted fields", fields: errors) unless errors.empty?
      true
    end
  end
end
