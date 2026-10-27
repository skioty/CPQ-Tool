module TenantManagement
  class Payload
    SCALARS = %w[company_name company_name_display display_name country time_zone description industry_id user_limit primary_contact_role].freeze
    BRANDING = %w[primary_colour secondary_colour typography logo_attachment_id favicon_attachment_id].freeze
    SUBSCRIPTION = %w[currency fee payment_method payment_method_description discount].freeze
    DISCOUNT = %w[type value duration].freeze
    CONTACT = %w[id name email phone primary].freeze

    def self.parse(value)
      new.parse(value)
    end

    def parse(value)
      object!(value, "tenant", SCALARS + %w[branding subscription contacts responsible_admin_ids])
      value.each { |key, item| scalar!(item, key) if SCALARS.include?(key) && !%w[company_name_display user_limit].include?(key) }
      if value.key?("user_limit") && !(value["user_limit"].is_a?(Integer) && value["user_limit"].between?(1,2147483647))
        invalid!("user_limit","Use a positive whole number up to 2147483647")
      end
      boolean!(value["company_name_display"], "company_name_display", nullable: true) if value.key?("company_name_display")
      if value.key?("branding")
        object!(value["branding"], "branding", BRANDING)
        value["branding"].each { |key, item| scalar!(item, "branding.#{key}") }
      end
      if value.key?("subscription")
        subscription = value["subscription"]
        object!(subscription, "subscription", SUBSCRIPTION)
        subscription.each { |key, item| scalar!(item, "subscription.#{key}") unless key == "discount" }
        decimal!(subscription["fee"], "subscription.fee") if subscription.key?("fee")
        if subscription.key?("discount")
          object!(subscription["discount"], "subscription.discount", DISCOUNT)
          subscription["discount"].each { |key, item| scalar!(item, "subscription.discount.#{key}") }
          decimal!(subscription["discount"]["value"], "subscription.discount.value")
        end
      end
      if value.key?("contacts")
        invalid!("contacts", "Must be an array") unless value["contacts"].is_a?(Array)
        value["contacts"].each_with_index do |contact, index|
          object!(contact, "contacts.#{index}", CONTACT)
          contact.each { |key, item| scalar!(item, "contacts.#{index}.#{key}") unless key == "primary" }
          boolean!(contact["primary"], "contacts.#{index}.primary")
        end
        invalid!("contacts", "Exactly one primary contact is required") unless value["contacts"].count { |c| c["primary"] == true } == 1
        ids = value["contacts"].filter_map { |contact| contact["id"].presence }
        invalid!("contacts", "Contact IDs must be unique") unless ids.uniq == ids
      end
      if value.key?("responsible_admin_ids")
        ids = value["responsible_admin_ids"]
        invalid!("responsible_admin_ids", "Must be an array of unique nonblank identifiers") unless ids.is_a?(Array) && ids.all? { |id| id.is_a?(String) && id.present? } && ids.uniq == ids
      end
      value
    end

    def object!(value, path, keys)
      invalid!(path, "Must be an object") unless value.is_a?(Hash)
      invalid!(path, "Contains unsupported fields") unless (value.keys - keys).empty?
    end

    def scalar!(value, path)
      invalid!(path, "Must be a string or null") unless value.nil? || value.is_a?(String)
    end

    def boolean!(value, path, nullable: false)
      invalid!(path, "Must be a boolean") unless value == true || value == false || (nullable && value.nil?)
    end

    def decimal!(value, path)
      return if value.nil? || value == ""
      invalid!(path, "Must be a finite decimal string") unless value.is_a?(String) && value.match?(/\A[+-]?\d+(?:\.\d+)?\z/)
    end

    def invalid!(path, message)
      raise Error.new("validation_failed", "Review the highlighted fields", fields: { path => [message] })
    end
  end
end
