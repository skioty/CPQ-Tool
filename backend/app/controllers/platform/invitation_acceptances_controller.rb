module Platform
  class InvitationAcceptancesController < ApplicationController
    rescue_from TenantManagement::Error do |error|
      render json: {error: {code: error.code, message: error.message, fields: error.fields}}, status: error.status
    end
    rescue_from ActiveRecord::RecordInvalid do |error|
      render json: {error: {code: "validation_failed", message: "Review your password", fields: error.record.errors.to_hash}}, status: 422
    end
    rescue_from ActiveRecord::RecordNotUnique do
      render json: {error: {code: "conflict", message: "The account changed. Refresh this invitation and retry.", fields: {}}}, status: 409
    end
    def preview
      record = Invitations.find_token!(params[:token])
      render json: {data: {tenant_id:record.tenant_id, email: record.email, kind: record.kind, expires_at: record.expires_at,
        company_name: record.tenant_id && TenantManagement::Tenant.find(record.tenant_id).company_name,
        existing_account: record.kind == "tenant" && TenantAccess::User.exists?(["lower(email) = ?", record.email])}}
    end
    def create
      user = current_tenant_user
      verified = user && session[:mfa_verified_for] == "tenant_user:#{user.id}" && user.totp_secret_ciphertext.present?
      kind = Invitations.accept!(token: params[:token], password: params[:password], confirmation: params[:password_confirmation], name:params[:name], authenticated_user: verified ? user : nil)
      render json: {data: {kind: kind, accepted: true}}
    end
  end
end
