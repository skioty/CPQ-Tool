module Platform
  class ManagementController < ApplicationController
    before_action :verify_actor!
    rescue_from TenantManagement::Error do |error|
      render json: {error: {code: error.code, message: error.message, fields: error.fields}}, status: error.status
    end
    rescue_from ActiveRecord::RecordNotFound do
      render json: {error: {code: "not_found", message: "Record not found", fields: {}}}, status: 404
    end
    rescue_from ActiveRecord::RecordInvalid do |error|
      render json: {error: {code: "validation_failed", message: "Review the highlighted fields", fields: error.record.errors.to_hash}}, status: 422
    end
    rescue_from ActiveRecord::RecordNotUnique do
      render json: {error: {code: "conflict", message: "An account or invitation changed. Refresh before retrying.", fields: {}}}, status: 409
    end
    private
    def verify_actor!
      @actor = current_administrator
      Access.new.verified!(@actor)
    end
    def super_admin!
      raise TenantManagement::Error.new("forbidden", "Super Admin access is required", status: 403) unless @actor.super_admin?
    end
    def tenant!
      tenant = Access.new.scope(@actor).find(params[:tenant_id])
      Access.new.authorize!(@actor, :read, tenant)
      tenant
    end
    def account_event!(action, subject)
      AccountEvent.create!(actor_id: @actor.id, subject_id: subject.id, action: action, created_at: Time.current)
    end
  end
end
