Rails.application.config.x.tenant_management.integration = -> { Platform::TenantIntegration.new }
# Platform staff and explicitly invited tenant users share the same checked schema-switching service.
Rails.application.config.x.tenant_management.workspace_access = ->(tenant) { tenant.lifecycle_status == "active" }
