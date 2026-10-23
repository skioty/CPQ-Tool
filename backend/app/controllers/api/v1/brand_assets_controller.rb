module Api
  module V1
    class BrandAssetsController < ApplicationController
      before_action :authenticate!
      def create
        tenant = nil
        if params[:tenant_id].present?
          tenant = Platform::Access.new.scope(@actor).find(params[:tenant_id])
          Platform::Access.new.authorize!(@actor, :update, tenant)
        elsif !@actor.super_admin?
          raise TenantManagement::Error.new("forbidden", "New tenant uploads require Super Admin", status: 403)
        end
        kind = params[:kind].to_s
        bytes, mime = TenantManagement::ImageValidator.read!(params[:file], kind)
        asset = TenantManagement::BrandAsset.create!(tenant_id: tenant&.id, owner_id: @actor.id,
          kind: kind, content: bytes, content_type: mime,
          storage_key: "#{tenant&.id || 'staged'}/#{SecureRandom.uuid}")
        render json: { id: asset.id, url: "/api/v1/brand_assets/#{asset.id}" }, status: 201
      end
      def show
        asset = TenantManagement::BrandAsset.find(params[:id])
        if asset.tenant_id
          tenant = Platform::Access.new.scope(@actor).find(asset.tenant_id)
          Platform::Access.new.authorize!(@actor, :read, tenant)
        elsif asset.owner_id != @actor.id
          raise ActiveRecord::RecordNotFound
        end
        response.set_header("X-Content-Type-Options", "nosniff")
        response.set_header("Cache-Control", "private, no-store")
        send_data asset.content, type: asset.content_type, disposition: "inline", filename: asset.id
      end
      private
      def authenticate!
        @actor = current_administrator
        Platform::Access.new.verified!(@actor)
      end
      rescue_from TenantManagement::Error do |e|
        render json: { error: { code: e.code, message: e.message, fields: e.fields } }, status: e.status
      end
      rescue_from ActiveRecord::RecordNotFound do
        render json: { error: { code: "not_found", message: "Asset not found" } }, status: 404
      end
    end
  end
end
