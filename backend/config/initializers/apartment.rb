Apartment.configure do |config|
  config.use_schemas = true
  config.use_sql = false
  config.default_tenant = "public"
  # Deliberately no public fallback for tenant business tables.
  config.persistent_schemas = []
  config.excluded_models = %w[Platform::Invitation Platform::AccountEvent TenantAccess::User TenantAccess::Membership Platform::Administrator Platform::ProvisioningFailure
    TenantManagement::Tenant TenantManagement::Contact TenantManagement::Branding
    TenantManagement::Subscription TenantManagement::Assignment TenantManagement::AuditEvent
    TenantManagement::ReferenceOption TenantManagement::BrandAsset]
  config.database_schema_file = nil # Never clone public management tables into tenants.
  config.seed_after_create = false
  config.db_migrate_tenants = false # Use the explicit tenant-only migration task.
  config.tenant_names = -> { TenantManagement::Tenant.where(provisioning_status: "ready").pluck(:schema_key) }
end
