module TenantManagement
  class Lifecycle
    TRANSITIONS = { "activate" => [%w[inactive], "active"], "deactivate" => [%w[active], "inactive"],
      "suspend" => [%w[active inactive], "suspended"], "reactivate" => [%w[suspended], "inactive"],
      "archive" => [%w[active inactive suspended], "archived"], "restore" => [%w[archived], "inactive"] }.freeze
    def self.actions(actor, tenant)
      TRANSITIONS.filter_map do |action, (from, _)|
        next unless from.include?(tenant.lifecycle_status)
        next unless actor.super_admin? || (%w[activate deactivate].include?(action) && Platform::Access.new.scope(actor).exists?(id: tenant.id))
        action
      end
    end
    def self.apply!(actor:, tenant:, action:, request_id:)
      tenant.with_lock do
        Platform::Access.new.authorize!(actor, :read, tenant)
        unless TRANSITIONS.key?(action)
          raise Error.new("validation_failed", "Unknown lifecycle action")
        end
        unless actor.super_admin? || %w[activate deactivate].include?(action)
          raise Error.new("forbidden", "Lifecycle action requires Super Admin", status: 403)
        end
        from, target = TRANSITIONS.fetch(action)
        raise Error.new("invalid_transition", "Refresh tenant status before trying this action", status: 409) unless from.include?(tenant.lifecycle_status)
        if action == "activate"
          BusinessRules.validate!(actor, {}, tenant)
          raise Error.new("tenant_unavailable", "Provisioning must be ready", status: 409) unless tenant.provisioning_status == "ready"
        end
        tenant.update!(lifecycle_status: target)
        tenant.audit_events.create!(actor_id: actor.id, action: action, request_id: request_id,
          changed_fields: ["lifecycle_status"], created_at: Time.current)
        tenant
      end
    end
  end
end
