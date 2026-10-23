module TenantManagement
  # Member 3 replaces these collaborators with reviewed Devise/policy/Apartment services.
  # Never use an HTTP header, request parameter or environment flag as an administrator.
  class Integration
    def authenticate!(_controller)
      raise Error.new("unauthenticated", "Administrator login is required", status: 401)
    end

    def unavailable!
      raise Error.new("integration_unavailable", "Tenant management integration is not configured", status: 503)
    end

    def scope!(_actor) = unavailable!
    def authorize!(_actor, _action, _tenant = nil) = unavailable!
    def validate_business!(_actor, _attributes, _tenant) = unavailable!
    def validate_assignments!(_actor, _ids, _tenant) = unavailable!
    def validate_assets!(_actor, _ids, _tenant) = unavailable!
    def permitted_actions(_actor, _tenant) = []
    def initial_lifecycle! = unavailable!
    def filter_status!(_status) = unavailable!
    def provision!(_tenant) = unavailable!
    def compensate!(_receipt) = unavailable!
    def record_provisioning_failure!(_tenant_id, _code) = nil
  end
end
