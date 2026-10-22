module Api
  module V1
    class TenantsController < ApplicationController
      before_action :authenticate_administrator!
      rescue_from StandardError do |error|
        Rails.logger.error("Tenant operation failed request_id=#{request.request_id} error_class=#{error.class.name}")
        render_error("internal_error", "Tenant operation could not be completed", 500)
      end
      rescue_from ActiveRecord::RecordNotFound do
        render_error("not_found", "Tenant was not found", 404)
      end
      rescue_from ActiveRecord::RecordInvalid do
        render_error("validation_failed", "Tenant data could not be saved", 422)
      end
      rescue_from ActiveRecord::StaleObjectError do
        render_error("stale_version", "Tenant changed; reload before saving", 409)
      end
      rescue_from ActiveRecord::StatementInvalid do |error|
        Rails.logger.error("Tenant database operation failed request_id=#{request.request_id} error_class=#{error.cause.class.name}")
        render_error("persistence_failed", "Tenant data could not be saved", 409)
      end
      rescue_from TenantManagement::Error, with: :domain_error

      def index
        authorize!(:list)
        tenants = authorized_scope
        page = integer_param("page", 1)
        per_page = integer_param("per_page", 20, max: 100)
        if params[:q].present?
          query = ActiveRecord::Base.sanitize_sql_like(params[:q].to_s)
          tenants = tenants.where("company_name ILIKE ?", "%#{query}%")
        end
        if params[:status].present?
          approved!(@integration.filter_status!(params[:status].to_s))
          tenants = tenants.where(lifecycle_status: params[:status])
        end
        count = tenants.count
        tenants = tenants.order(:created_at, :id).offset((page - 1) * per_page).limit(per_page)
        response.set_header("Cache-Control", "no-store")
        render json: { data: tenants.map { |tenant| TenantManagement::Serializer.detail(tenant) },
          meta: { page: page, per_page: per_page, total_count: count, total_pages: (count.to_f / per_page).ceil } }
      end

      def show
        tenant = find_authorized(:read)
        render_tenant(tenant)
      end

      def create
        attributes = tenant_payload
        tenant = writer.create(attributes)
        render_tenant(tenant, status: 201)
      end

      def update
        tenant = find_authorized(:update)
        version = request.headers["If-Match"]
        unless version&.match?(/\A"\d+"\z/)
          raise TenantManagement::Error.new("precondition_required", 'Send the saved ETag in If-Match', status: 428)
        end
        tenant = writer.update(tenant, tenant_payload, expected_version: version.delete('"').to_i)
        render_tenant(tenant)
      end

      def lifecycle
        find_authorized(:lifecycle)
        raise TenantManagement::Error.new("policy_unavailable", "Lifecycle transitions and permissions await approval", status: 503)
      end

      private

      def authenticate_administrator!
        @integration = Rails.application.config.x.tenant_management.integration.call
        @actor = @integration.authenticate!(self)
        raise TenantManagement::Error.new("unauthenticated", "Administrator login is required", status: 401) unless @actor&.id.present?
      end

      def authorized_scope
        scope = @integration.scope!(@actor)
        unless scope.is_a?(ActiveRecord::Relation) && scope.klass == TenantManagement::Tenant
          raise TenantManagement::Error.new("integration_unavailable", "Tenant authorization scope is unavailable", status: 503)
        end
        scope
      end

      def find_authorized(action)
        unless params[:id].to_s.match?(/\A[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\z/i)
          raise ActiveRecord::RecordNotFound
        end
        tenant = authorized_scope.find(params[:id])
        authorize!(action, tenant)
        tenant
      end

      def approved!(result)
        return if result == true
        raise TenantManagement::Error.new("integration_unavailable", "Tenant management approval is unavailable", status: 503)
      end

      def authorize!(action, tenant = nil)
        approved!(@integration.authorize!(@actor, action, tenant))
      end

      def tenant_payload
        value = params[:tenant]
        value = value.to_unsafe_h if value.is_a?(ActionController::Parameters)
        TenantManagement::Payload.parse(value)
      end

      def writer
        TenantManagement::Writer.new(integration: @integration, actor: @actor, request_id: request.request_id)
      end

      def render_tenant(tenant, status: 200)
        response.set_header("ETag", %Q("#{tenant.lock_version}"))
        response.set_header("Cache-Control", "no-store")
        render json: { data: TenantManagement::Serializer.detail(tenant) }, status: status
      end

      def integer_param(key, default, max: nil)
        return default unless params.key?(key)
        value = params[key].to_s
        unless value.match?(/\A[1-9]\d{0,8}\z/) && (!max || value.to_i <= max)
          raise TenantManagement::Error.new("invalid_filter", "Invalid pagination", status: 400, fields: { key => ["Must be a positive integer#{max ? " no greater than #{max}" : ''}"] })
        end
        value.to_i
      end

      def domain_error(error)
        render_error(error.code, error.message, error.status, error.fields)
      end

      def render_error(code, message, status, fields = {})
        response.set_header("Cache-Control", "no-store")
        render json: { error: { code: code, message: message, fields: fields, request_id: request.request_id } }, status: status
      end
    end
  end
end
