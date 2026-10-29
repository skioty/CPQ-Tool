module TenantAccess
  class WorkspacesController < ApplicationController
    before_action :verify_user!
    rescue_from TenantManagement::Error do |error|
      render json: {error: {code: error.code, message: error.message, fields: error.fields}}, status: error.status
    end
    rescue_from ActiveRecord::RecordNotFound do
      render json: {error: {code: "not_found", message: "Workspace not found", fields: {}}}, status: 404
    end
    def index
      ids = Membership.where(user_id: @user.id, enabled: true).select(:tenant_id)
      render json: {data: TenantManagement::Tenant.where(id: ids).order(:company_name).map { |tenant| {id: tenant.id, company_name: tenant.company_name, status: tenant.lifecycle_status} }}
    end
    def show
      response.set_header("Cache-Control","no-store")
      Platform::TenantContext.with_membership(user: @user, tenant_id: params[:id]) do |tenant|
        branding = tenant.branding
        render json: {data: {id: tenant.id, company_name: tenant.company_name, display_name:tenant.display_name, description: tenant.description,
          country:tenant.country, time_zone:tenant.time_zone, currency:tenant.subscription&.currency, company_name_display: tenant.company_name_display, role: "tenant_admin",
          branding: {primary_colour: branding.primary_colour, secondary_colour: branding.secondary_colour,
            typography: branding.typography, logo_attachment_id: branding.logo_attachment_id, favicon_attachment_id: branding.favicon_attachment_id}}}
      end
    end
    def asset
      Platform::TenantContext.with_membership(user: @user, tenant_id: params[:id]) do |tenant|
        record = TenantManagement::BrandAsset.find_by!(id: params[:asset_id], tenant_id: tenant.id)
        response.set_header("X-Content-Type-Options", "nosniff")
        send_data record.content, type: record.content_type, disposition: "inline", filename: record.id
      end
    end
    private
    def verify_user!
      @user = current_tenant_user
      raise TenantManagement::Error.new("unauthenticated", "Tenant sign-in is required", status: 401) unless @user&.enabled?
    end
  end
end
