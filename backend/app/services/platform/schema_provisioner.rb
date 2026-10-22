module Platform
  class SchemaProvisioner
    KEY = /\Acpq_t_[0-9a-f]{32}\z/

    def self.provision!(tenant)
      connection = ActiveRecord::Base.connection
      unless connection.transaction_open? && tenant.persisted? && tenant.schema_key.match?(KEY)
        raise TenantManagement::Error.new("provisioning_failed", "Provisioning requires a registry transaction", status: 503)
      end
      key = tenant.schema_key
      if connection.schema_exists?(key)
        # Existing schema may belong to an earlier committed ready tenant; never clone/drop it.
        if tenant.provisioning_status == "ready"
          Apartment::Tenant.switch(key) { raise "Tenant schema migrations pending" unless TenantMigrator.current? }
          return { tenant_id: tenant.id, schema_key: key }
        end
        raise TenantManagement::Error.new("schema_conflict", "Schema provisioning requires operator review", status: 409)
      end
      connection.transaction(requires_new: true) do
        Apartment::Tenant.create(key) { TenantMigrator.migrate_current! }
      end
      { tenant_id: tenant.id, schema_key: key }
    rescue TenantManagement::Error
      raise
    rescue StandardError
      raise TenantManagement::Error.new("provisioning_failed", "Tenant schema provisioning failed", status: 503)
    ensure
      Apartment::Tenant.reset
    end

    def self.compensate!(receipt)
      # CREATE SCHEMA and tenant tables use the SAME PostgreSQL transaction as registry.
      # After rollback there is nothing to drop; never delete on ambiguous commit failure.
      return true unless ActiveRecord::Base.connection.schema_exists?(receipt.fetch(:schema_key))
      raise TenantManagement::Error.new("provisioning_recovery_required", "Provisioning requires operator review", status: 503)
    end
  end
end
