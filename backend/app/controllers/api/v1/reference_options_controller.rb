module Api
  module V1
    class ReferenceOptionsController < ApplicationController
      before_action :authenticate!
      def index
        options = TenantManagement::ReferenceOption.order(:label)
        options = options.where(enabled: true) unless @actor.super_admin? && params[:include_disabled] == "true"
        render json: { data: options.as_json(only: [:id, :kind, :code, :label, :enabled]),
          admins: Platform::Administrator.where(role: "admin", enabled: true).order(:email).map { |a| { id: a.id, label: a.email } },
          typography: TenantManagement::BusinessRules::FONTS }
      end
      def create
        super_admin!
        record = TenantManagement::ReferenceOption.create!(params.require(:option).permit(:kind, :code, :label))
        render json: { data: record.as_json(only: [:id, :kind, :code, :label, :enabled]) }, status: :created
      end
      def update
        super_admin!
        record = TenantManagement::ReferenceOption.find(params[:id])
        record.update!(params.require(:option).permit(:label, :enabled))
        render json: { data: record.as_json(only: [:id, :kind, :code, :label, :enabled]) }
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
    end
  end
end
