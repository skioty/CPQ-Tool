namespace :platform do
  desc "Inspect sanitized provisioning failure history (development/test only)"
  task provisioning_failures: :environment do
    abort "Development/test only" unless Rails.env.development? || Rails.env.test?
    Platform::ProvisioningFailure.order(:created_at).find_each do |failure|
      puts({ tenant_id: failure.tenant_id, request_id: failure.request_id,
        code: failure.error_code, created_at: failure.created_at }.to_json)
    end
  end

  desc "Provision one development/demo administrator using runtime environment credentials"
  task provision_admin: :environment do
    abort "Development/test only" unless Rails.env.development? || Rails.env.test?
    email, password, role = ENV.values_at("CPQ_ADMIN_EMAIL", "CPQ_ADMIN_PASSWORD", "CPQ_ADMIN_ROLE")
    abort "Set CPQ_ADMIN_EMAIL, CPQ_ADMIN_PASSWORD and CPQ_ADMIN_ROLE (super_admin/admin)" if [email, password, role].any?(&:blank?)
    abort "Account already exists; use an explicitly reviewed account recovery process" if Platform::Administrator.exists?(email: email.downcase.strip)
    Platform::Administrator.create!(email: email, password: password, password_confirmation: password, role: role)
    puts "Administrator provisioned (credentials omitted)."
  end

  desc "Migrate only registered ready tenant schemas using db/tenant_migrate"
  task migrate_tenants: :environment do
    TenantManagement::Tenant.where(provisioning_status: "ready").find_each do |tenant|
      tenant.with_lock do
        Apartment::Tenant.switch(tenant.schema_key) { Platform::TenantMigrator.migrate_current! }
      ensure
        Apartment::Tenant.reset
      end
    end
  end
end
