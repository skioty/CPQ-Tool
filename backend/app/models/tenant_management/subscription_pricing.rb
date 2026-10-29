module TenantManagement
  class SubscriptionPricing < ApplicationRecord
    self.table_name = "public.platform_subscription_pricings"
    validate :valid_tiers

    def self.current! = find_or_create_by!(id: 1)

    def self.quote!(currency, limit) = quote_details!(currency, limit).fetch(:fee)

    def self.quote_details!(currency, limit)
      current!
      schedule = lock("FOR SHARE").find(1)
      tier = schedule.tiers.find { |t| t["currency"] == currency && limit.to_i.between?(t["min_users"], t["max_users"]) }
      tier ||= schedule.tiers.find { |t| t["currency"] == "BTN" && limit.to_i.between?(t["min_users"], t["max_users"]) }
      unless tier
        raise Error.new("validation_failed", "No automatic pricing tier matches this currency and user limit. Configure a tier or choose Custom.", fields: { "subscription.pricing_mode" => ["No matching pricing tier"] })
      end
      ExchangeRateBook.convert!(tier.fetch("fee"), from: tier.fetch("currency"), to: currency)
    end

    private
    def valid_tiers
      unless tiers.is_a?(Array) && tiers.length <= 200
        errors.add(:tiers, "Use at most 200 tiers"); return
      end
      tiers.each do |t|
        unless t.is_a?(Hash) && t.keys.sort == %w[currency fee max_users min_users] &&
            t["min_users"].is_a?(Integer) && t["max_users"].is_a?(Integer) &&
            t["min_users"].between?(1,2147483647) && t["max_users"].between?(t["min_users"],2147483647) &&
            t["fee"].is_a?(String) && t["fee"].match?(/\A\d+(?:\.\d{1,2})?\z/) && BigDecimal(t["fee"]) <= BigDecimal("999999999.99") &&
            ReferenceOption.where(kind: "currency", code: t["currency"], enabled: true).exists?
          errors.add(:tiers, "Each tier needs an enabled currency, positive whole user range and nonnegative fee with up to two decimals"); return
        end
      end
      tiers.group_by { |t| t["currency"] }.each_value do |group|
        group.sort_by { |t| t["min_users"] }.each_cons(2) do |a,b|
          errors.add(:tiers, "Ranges must not overlap within a currency") if a["max_users"] >= b["min_users"]
        end
      end
    end
  end
end
