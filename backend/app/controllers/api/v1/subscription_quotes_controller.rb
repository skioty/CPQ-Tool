module Api
  module V1
    class SubscriptionQuotesController < ApplicationController
      def show
        actor = current_administrator
        Platform::Access.new.verified!(actor)
        currency = params[:currency].to_s
        unless TenantManagement::ReferenceOption.exists?(kind: "currency", code: currency, enabled: true)
          raise TenantManagement::Error.new("validation_failed", "Select an enabled currency", fields: {"subscription.currency" => ["Select an enabled currency"]})
        end
        if params[:source_currency].present?
          raise TenantManagement::Error.new("forbidden", "Super Admin required", status: 403) unless actor.super_admin?
          from = params[:source_currency].to_s
          unless TenantManagement::ReferenceOption.exists?(kind: "currency", code: from)
            raise TenantManagement::Error.new("validation_failed", "Unknown source currency")
          end
          TenantManagement::ExchangeRateBook.refresh_if_needed! unless from == currency
          quote = TenantManagement::ExchangeRateBook.convert!(params[:amount], from: from, to: currency)
        else
          limit = params[:user_limit].to_s
          unless limit.match?(/\A[1-9]\d*\z/) && limit.to_i <= 2147483647
            raise TenantManagement::Error.new("validation_failed", "Use a positive whole user limit")
          end
          tiers = TenantManagement::SubscriptionPricing.current!.tiers
          direct = tiers.any? { |t| t["currency"] == currency && limit.to_i.between?(t["min_users"],t["max_users"]) }
          base = tiers.any? { |t| t["currency"] == "BTN" && limit.to_i.between?(t["min_users"],t["max_users"]) }
          TenantManagement::ExchangeRateBook.refresh_if_needed! if base && !direct && currency != "BTN"
          quote = TenantManagement::SubscriptionPricing.transaction { TenantManagement::SubscriptionPricing.quote_details!(currency, limit.to_i) }
        end
        render json: {data: quote}
      end
      rescue_from TenantManagement::Error do |e|
        render json: {error: {code: e.code, message: e.message, fields: e.fields}}, status: e.status
      end
    end
  end
end
