module Api
  module V1
    class SubscriptionPricingsController < ApplicationController
      before_action do
        @actor = current_administrator
        Platform::Access.new.verified!(@actor)
        raise TenantManagement::Error.new("forbidden", "Super Admin required", status: 403) unless @actor.super_admin?
      end
      def show
        render json: { data: TenantManagement::SubscriptionPricing.current!.as_json(only: [:tiers, :lock_version]) }
      end
      def update
        record = TenantManagement::SubscriptionPricing.current!
        input = params.require(:pricing).to_unsafe_h
        record.with_lock do
          unless input["lock_version"] == record.lock_version
            raise TenantManagement::Error.new("stale_version", "Pricing changed. Reload before saving.", status: 409)
          end
          record.update!(tiers: input["tiers"])
          Platform::AccountEvent.create!(actor_id: @actor.id, subject_id: "subscription_pricing", action: "subscription_pricing_updated", created_at: Time.current)
        end
        render json: { data: record.as_json(only: [:tiers, :lock_version]) }
      end
      rescue_from TenantManagement::Error do |e|
        render json: {error: {code: e.code, message: e.message, fields: e.fields}}, status: e.status
      end
      rescue_from ActiveRecord::RecordInvalid do |e|
        render json: {error: {code: "validation_failed", message: e.record.errors.full_messages.join(". ")}}, status: 422
      end
    end
  end
end
