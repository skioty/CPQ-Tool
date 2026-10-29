module Api
  module V1
    class ReferenceOptionsController < ApplicationController
      before_action :authenticate!
      def index
        options = TenantManagement::ReferenceOption.order(:label)
        options = options.where(enabled: true) unless @actor.super_admin? && params[:include_disabled] == "true"
        render json: { data: options.as_json(only: [:id, :kind, :code, :label, :enabled]),
          admins: Platform::Administrator.where(role: "admin", enabled: true).order(:email).map { |a| { id: a.id, label: a.email } },
          typography: TenantManagement::BusinessRules::FONTS,
          countries: TZInfo::Country.all.map { |c| {id:c.code,label:c.name} }.sort_by { |c| c[:label] },
          time_zones: TZInfo::Timezone.all_identifiers.map { |id| seconds=TZInfo::Timezone.get(id).current_period.observed_utc_offset; minutes=seconds.abs/60; {id:id,label:"#{id} (UTC#{seconds < 0 ? '-' : '+'}#{format('%02d:%02d',minutes/60,minutes%60)})"} },
          country_currencies: JSON.parse(Rails.root.join("config/country_currencies.json").read).fetch("countries"),
          country_time_zones: TZInfo::Country.all.to_h { |c| [c.code, c.zone_identifiers] },
          pricing_tiers: TenantManagement::SubscriptionPricing.current!.tiers,
          can_manage_industries:@actor.super_admin? }
      end
      def create
        super_admin!
        record = TenantManagement::ReferenceOption.create!(params.require(:option).permit(:kind, :code, :label))
        render json: { data: record.as_json(only: [:id, :kind, :code, :label, :enabled]) }, status: :created
      end
      def update
        super_admin!
        record = TenantManagement::ReferenceOption.find(params[:id])
        record.with_lock do
          record.update!(params.require(:option).permit(:label, :enabled))
          Platform::AccountEvent.create!(actor_id: @actor.id, subject_id: record.id, action: record.enabled? ? "reference_option_enabled" : "reference_option_deactivated", created_at: Time.current)
        end
        render json: { data: record.as_json(only: [:id, :kind, :code, :label, :enabled]) }
      end
      def destroy
        super_admin!
        record = TenantManagement::ReferenceOption.find(params[:id])
        record.with_lock do
          unless record.kind == "industry"
            raise TenantManagement::Error.new("forbidden", "Only industries support deletion", status: 403)
          end
          if TenantManagement::Tenant.where(industry_id: record.code).exists?
            raise TenantManagement::Error.new("industry_in_use", "This industry is referenced by a tenant. Deactivate it to prevent new selections while retaining existing records.", status: 409)
          end
          Platform::AccountEvent.create!(actor_id: @actor.id, subject_id: record.id, action: "industry_deleted", created_at: Time.current)
          record.destroy!
        end
        head :no_content
      end
      private
      def authenticate!
        @actor = current_administrator
        Platform::Access.new.verified!(@actor)
      end
      def super_admin!
        raise TenantManagement::Error.new("forbidden", "Super Admin required", status: 403) unless @actor.super_admin?
      end
      rescue_from TenantManagement::Error do |e|
        render json: { error: { code: e.code, message: e.message, fields: e.fields } }, status: e.status
      end
      rescue_from ActiveRecord::RecordInvalid do |e|
        render json: { error: { code: "validation_failed", message: "Review reference option", fields: e.record.errors.to_hash } }, status: 422
      end
      rescue_from ActiveRecord::RecordNotFound do
        render json: { error: { code: "not_found", message: "Option not found" } }, status: 404
      end
      rescue_from ActiveRecord::RecordNotUnique do
        render json:{error:{code:"validation_failed",message:"An industry with this name already exists",fields:{label:["Already exists (case-insensitive)"]}}},status:422
      end
    end
  end
end
