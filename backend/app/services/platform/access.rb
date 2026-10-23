module Platform
  class Access
    def scope(actor)
      verified!(actor)
      return TenantManagement::Tenant.all if actor.super_admin?
      TenantManagement::Tenant.where(id: TenantManagement::Assignment.where(administrator_id: actor.id.to_s).select(:tenant_id))
    end

    def authorize!(actor, action, tenant = nil)
      verified!(actor)
      return true if actor.super_admin? && %i[list read create update].include?(action)
      return true if action == :list
      if %i[read update].include?(action) && tenant && scope(actor).exists?(id: tenant.id)
        return true
      end
      raise TenantManagement::Error.new("forbidden", "Action is not permitted", status: 403)
    end

    def verified!(actor)
      unless actor.is_a?(Administrator) && actor.persisted? && actor.reload.enabled? && %w[super_admin admin].include?(actor.role)
        raise TenantManagement::Error.new("unauthenticated", "Administrator login is required", status: 401)
      end
    end
  end
end
