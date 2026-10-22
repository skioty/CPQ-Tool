# Runtime adapters remain closed until Member 3 and business-contract review.
# Callable resolves reloadable classes per request; no test adapter is loaded here.
Rails.application.config.x.tenant_management.integration = -> { Platform::TenantIntegration.new }
Rails.application.config.x.tenant_management.workspace_access = ->(_tenant) { false }
