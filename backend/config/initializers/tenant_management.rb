# Runtime adapters remain closed until Member 3 and business-contract review.
# Callable resolves reloadable classes per request; no test adapter is loaded here.
Rails.application.config.x.tenant_management.integration = -> { TenantManagement::Integration.new }
