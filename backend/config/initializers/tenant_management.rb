Rails.application.config.x.tenant_management.integration = -> { Platform::TenantIntegration.new }
# TenantContext is currently platform staff only. Tenant-user onboarding remains out of scope.
Rails.application.config.x.tenant_management.workspace_access = ->(tenant) { tenant.lifecycle_status == "active" }
