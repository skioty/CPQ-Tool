require "test_helper"
require "timeout"
require "minitest/mock"

class PlatformSecurityTest < ActionDispatch::IntegrationTest
  self.use_transactional_tests = false

  class FixtureIntegration < Platform::TenantIntegration
    # Only unresolved product validation is synthetic; auth/policy/provisioning are real.
    def validate_business!(*args) = true
    def initial_lifecycle! = nil
  end

  setup do
    @ids, @accounts = [], []
    @previous_integration = Rails.application.config.x.tenant_management.integration
    @previous_policy = Rails.application.config.x.tenant_management.workspace_access
    @previous_csrf = ActionController::Base.allow_forgery_protection
    @api_csrf = ApplicationController.allow_forgery_protection
    ApplicationController.allow_forgery_protection = true
    @password = SecureRandom.base64(24)
    @super = administrator("super_admin")
    @admin = administrator("admin")
    Rails.application.config.x.tenant_management.integration = -> { FixtureIntegration.new }
    # Synthetic permission to exercise isolation; no production lifecycle rule is approved.
    Rails.application.config.x.tenant_management.workspace_access = ->(tenant) { tenant.lifecycle_status.nil? }
  end

  teardown do
    Rails.application.config.x.tenant_management.integration = @previous_integration
    Rails.application.config.x.tenant_management.workspace_access = @previous_policy
    ApplicationController.allow_forgery_protection = @api_csrf
    Apartment::Tenant.reset
    @ids.each do |id|
      record = TenantManagement::Tenant.find_by(id: id)
      key = record&.schema_key
      # Only this test's generated synthetic schemas; never a supplied browser schema.
      Apartment::Tenant.drop(key) if key && key.match?(Platform::SchemaProvisioner::KEY) && ActiveRecord::Base.connection.schema_exists?(key)
    end
    TenantManagement::Tenant.transaction do
      ActiveRecord::Base.connection.execute("SET CONSTRAINTS ALL DEFERRED")
      [TenantManagement::AuditEvent, TenantManagement::Assignment, TenantManagement::Subscription,
        TenantManagement::Branding, TenantManagement::Contact].each { |model| model.where(tenant_id: @ids).delete_all }
      TenantManagement::Tenant.where(id: @ids).delete_all
    end
    Platform::ProvisioningFailure.where(tenant_id: @ids).delete_all
    Platform::Administrator.where(id: @accounts).delete_all
  end

  def administrator(role)
    account = Platform::Administrator.create!(email: "#{SecureRandom.hex(8)}@example.invalid", password: @password, role: role)
    @accounts << account.id
    account
  end

  def login(account = @super, browser = self)
    browser.get "/api/v1/session/csrf"
    token = browser.response.parsed_body.fetch("csrf_token")
    browser.post "/api/v1/session", params: { administrator: { email: account.email, password: @password } }, headers: { "X-CSRF-Token" => token }, as: :json
    assert_equal 200, browser.response.status, browser.response.body
    browser.response.parsed_body.fetch("csrf_token")
  end

  def fixture_tenant(label, assigned: nil)
    integration = FixtureIntegration.new
    record = TenantManagement::Writer.new(integration: integration, actor: @super, request_id: SecureRandom.uuid).create(
      { "company_name" => label, "contacts" => [{ "primary" => true }], "responsible_admin_ids" => assigned ? [assigned.id] : [] })
    @ids << record.id
    Platform::TenantContext.with(actor: @super, tenant_id: record.id) { TenantData::IsolationMarker.create!(value: label) }
    record
  end

  test "login logout bad password and CSRF use real Devise cookie sessions" do
    get "/api/v1/tenants"
    assert_response :unauthorized
    post "/api/v1/session", params: { administrator: { email: @super.email, password: @password } }, as: :json
    assert_response :unprocessable_entity
    token = login
    assert response.headers["Set-Cookie"].downcase.include?("httponly")
    get "/api/v1/session"
    assert_equal @super.id, response.parsed_body.dig("data", "id")
    delete "/api/v1/session", headers: { "X-CSRF-Token" => token }, as: :json
    assert_response :no_content
    get "/api/v1/tenants"
    assert_response :unauthorized
    get "/api/v1/session/csrf"
    token = response.parsed_body["csrf_token"]
    post "/api/v1/session", params: { administrator: { email: @super.email, password: SecureRandom.hex(20) } }, headers: { "X-CSRF-Token" => token }, as: :json
    assert_response :unauthorized
    assert_not Rails.application.routes.routes.any? { |route| route.path.spec.to_s.include?("sign_up") }
  end

  test "assigned admin list detail and direct mutation cannot cross assignments" do
    first = fixture_tenant("Assigned", assigned: @admin)
    second = fixture_tenant("Unassigned")
    token = login(@admin)
    get "/api/v1/tenants"
    assert_response :success
    assert_equal [first.id], response.parsed_body["data"].map { |tenant| tenant["id"] }
    get "/api/v1/tenants/#{first.id}"
    assert_response :success
    etag = response.headers["ETag"]
    patch "/api/v1/tenants/#{first.id}", params: { tenant: { description: "Allowed" } }, headers: { "X-CSRF-Token" => token, "If-Match" => etag }, as: :json
    assert_response :success
    get "/api/v1/tenants/#{second.id}"
    assert_response :not_found
    patch "/api/v1/tenants/#{second.id}", params: { tenant: { description: "Denied" } }, headers: { "X-CSRF-Token" => token, "If-Match" => '"1"' }, as: :json
    assert_response :not_found
    assert_nil second.reload.description
    post "/api/v1/tenants", params: { tenant: { contacts: [{ primary: true }] } }, headers: { "X-CSRF-Token" => token }, as: :json
    assert_response :forbidden
  end

  test "super admin sees both tenants and schema names never appear in responses" do
    first, second = fixture_tenant("First"), fixture_tenant("Second")
    login
    get "/api/v1/tenants"
    assert_equal [first.id, second.id].sort, response.parsed_body["data"].map { |t| t["id"] }.sort
    assert_not_includes response.body, first.schema_key
    assert_not_includes response.body, second.schema_key
    connection = ActiveRecord::Base.connection
    assert_raises(ActiveRecord::StatementInvalid) do
      connection.execute("UPDATE public.platform_tenants SET schema_key = #{connection.quote("cpq_t_#{SecureRandom.hex(16)}")} WHERE id = #{connection.quote(first.id)}")
    end
  end

  test "alternating requests read tenant-local data and ignore browser schema headers" do
    first, second = fixture_tenant("First", assigned: @admin), fixture_tenant("Second")
    login
    [first, second, first, second].each do |tenant|
      get "/api/v1/tenants/#{tenant.id}/isolation-probe", headers: { "X-Tenant-Schema" => "public" }
      assert_response :success
      assert_equal [tenant.company_name], response.parsed_body["data"]
      assert_equal "public", Apartment::Tenant.current
      assert_equal "public", ActiveRecord::Base.connection.select_value("SELECT current_schema()")
    end
    login(@admin)
    get "/api/v1/tenants/#{second.id}/isolation-probe", headers: { "X-Tenant-Schema" => first.schema_key }
    assert_response :not_found
    assert_equal "public", Apartment::Tenant.current
  end

  test "context restores after request exception and a later request sees correct data" do
    first, second = fixture_tenant("First"), fixture_tenant("Second")
    login
    assert_raises(RuntimeError) { get "/api/v1/tenants/#{first.id}/isolation-probe", params: { fail: "true" } }
    assert_equal "public", Apartment::Tenant.current
    get "/api/v1/tenants/#{second.id}/isolation-probe"
    assert_equal ["Second"], response.parsed_body["data"]
  end

  test "concurrent authenticated requests use separate connections without leaking context" do
    first, second = fixture_tenant("First"), fixture_tenant("Second")
    browsers = [open_session, open_session]
    browsers.each { |browser| login(@super, browser) }
    gate, results = Queue.new, Queue.new
    threads = [first, second].zip(browsers).map do |tenant, browser|
      Thread.new do
        gate.pop
        3.times do
          browser.get "/api/v1/tenants/#{tenant.id}/isolation-probe"
          results << [browser.response.status, browser.response.parsed_body["data"], Apartment::Tenant.current]
        end
      rescue StandardError => error
        results << error
      end
    end
    2.times { gate << true }
    Timeout.timeout(20) { threads.each(&:join) }
    values = []
    values << results.pop until results.empty?
    assert_equal 6, values.size, values.inspect
    assert_equal 3, values.count { |row| row == [200, ["First"], "public"] }, values.inspect
    assert_equal 3, values.count { |row| row == [200, ["Second"], "public"] }, values.inspect
  end

  test "inactive suspended archived and unknown workspace rules remain closed" do
    record = fixture_tenant("Status")
    Rails.application.config.x.tenant_management.workspace_access = @previous_policy
    login
    [nil, "inactive", "suspended", "archived", "unknown"].each do |status|
      record.update!(lifecycle_status: status)
      get "/api/v1/tenants/#{record.id}/isolation-probe"
      assert_response :service_unavailable
      assert_equal "public", Apartment::Tenant.current
    end
  end

  test "failed provisioning rolls back schema and registry records and retry succeeds" do
    before = TenantManagement::Tenant.count
    key = nil
    original = Platform::TenantMigrator.method(:migrate_current!)
    failure = -> { key = Apartment::Tenant.current; raise "Synthetic migration failure" }
    Platform::TenantMigrator.stub(:migrate_current!, failure) do
      error = assert_raises(TenantManagement::Error) { fixture_tenant("Fail") }
      assert_equal "provisioning_failed", error.code
    end
    assert_equal before, TenantManagement::Tenant.count
    assert_not ActiveRecord::Base.connection.schema_exists?(key)
    failure_record = Platform::ProvisioningFailure.order(:created_at).last
    assert_equal "provisioning_failed", failure_record.error_code
    @ids << failure_record.tenant_id
    record = fixture_tenant("Retry")
    record.with_lock { Platform::SchemaProvisioner.provision!(record) }
    assert_equal before + 1, TenantManagement::Tenant.count
    assert_equal "public", Apartment::Tenant.current
    assert original
  end

  test "tenant migration rerun is idempotent and never copies public management tables" do
    record = fixture_tenant("Migrations")
    record.with_lock do
      Apartment::Tenant.switch(record.schema_key) do
        2.times { Platform::TenantMigrator.migrate_current! }
        assert Platform::TenantMigrator.current?
        assert_equal 1, TenantData::IsolationMarker.count
        names = ActiveRecord::Base.connection.select_values("SELECT tablename FROM pg_tables WHERE schemaname = '#{record.schema_key}'")
        assert_equal %w[isolation_markers tenant_schema_versions], names.sort
        assert_equal @super.id, Platform::Administrator.find(@super.id).id
      end
    end
  end
end
