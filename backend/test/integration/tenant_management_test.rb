require "test_helper"
require_relative "../support/tenant_management_adapter"

class TenantManagementTest < ActionDispatch::IntegrationTest
  setup do
    @previous = Rails.application.config.x.tenant_management.integration
    @adapter = TenantManagementTestAdapter.new
    Rails.application.config.x.tenant_management.integration = -> { @adapter }
  end

  teardown do
    Rails.application.config.x.tenant_management.integration = @previous
  end

  def payload
    { company_name: "Synthetic tenant", company_name_display: true, description: "Sample",
      industry_id: nil, responsible_admin_ids: ["eligible-admin"],
      contacts: [{ name: "Contact", email: "contact@example.invalid", primary: true }],
      branding: { primary_colour: "#123456", logo_attachment_id: "authorized-test-asset" },
      subscription: { currency: nil, fee: "123456789.123456789", payment_method: nil,
        discount: { type: nil, value: nil, duration: nil } } }
  end

  def create_tenant(changes = {})
    post "/api/v1/tenants", params: { tenant: payload.merge(changes) }, as: :json
    assert_response :created
    response.parsed_body.fetch("data")
  end

  test "creation persists settings contacts assignments and sanitized audit atomically" do
    data = create_tenant
    assert_equal "ready", data["provisioning_status"]
    assert_nil data["lifecycle_status"]
    assert_equal "123456789.123456789", data.dig("subscription", "fee")
    assert_equal "authorized-test-asset", data.dig("branding", "logo_attachment_id")
    assert_equal ["eligible-admin"], data["responsible_admin_ids"]
    assert_equal 1, data["contacts"].count { |contact| contact["primary"] }
    event = TenantManagement::Tenant.find(data["id"]).audit_events.sole
    assert_equal "created", event.action
    assert_equal "test-super-admin", event.actor_id
    assert_not_includes event.attributes.to_json, "contact@example.invalid"
    assert_not_includes event.attributes.to_json, "123456789"
    assert response.headers["ETag"]
  end

  test "zero or multiple primary contacts roll back creation" do
    [[], [{ primary: false }], [{ primary: true }, { primary: true }]].each do |contacts|
      assert_no_difference ["TenantManagement::Tenant.count", "TenantManagement::AuditEvent.count"] do
        post "/api/v1/tenants", params: { tenant: payload.merge(contacts: contacts) }, as: :json
      end
      assert_response :unprocessable_entity
      assert response.parsed_body.dig("error", "fields", "contacts")
    end
  end

  test "missing contacts and unknown or malformed values are rejected" do
    [payload.except(:contacts), payload.merge(schema_name: "other"), payload.merge(company_name_display: "true"),
      payload.merge(subscription: { fee: "NaN" }), payload.merge(subscription: { fee: 12.3 }),
      payload.merge(contacts: "wrong"), payload.merge(responsible_admin_ids: ["duplicate", "duplicate"])].each do |invalid|
      post "/api/v1/tenants", params: { tenant: invalid }, as: :json
      assert_response :unprocessable_entity
    end
  end

  test "business validation and administrator eligibility are authoritative and atomic" do
    @adapter.business_failure = true
    post "/api/v1/tenants", params: { tenant: payload }, as: :json
    assert_response :unprocessable_entity
    assert_equal 0, TenantManagement::Tenant.count
    @adapter.business_failure = false
    post "/api/v1/tenants", params: { tenant: payload.merge(responsible_admin_ids: ["ineligible"]) }, as: :json
    assert_response :unprocessable_entity
    assert_equal 0, TenantManagement::Tenant.count
  end

  test "update preserves omitted settings and asset references and checks version" do
    data = create_tenant
    etag = response.headers["ETag"]
    patch "/api/v1/tenants/#{data['id']}", params: { tenant: { description: "Changed" } }, headers: { "If-Match" => etag }, as: :json
    assert_response :success
    updated = response.parsed_body["data"]
    assert_equal "Changed", updated["description"]
    assert_equal data["contacts"], updated["contacts"]
    assert_equal data["branding"], updated["branding"]
    assert_not_equal etag, response.headers["ETag"]
    patch "/api/v1/tenants/#{data['id']}", params: { tenant: { description: "Stale" } }, headers: { "If-Match" => etag }, as: :json
    assert_response :conflict
    assert_equal "Changed", TenantManagement::Tenant.find(data["id"]).description
  end

  test "update requires a version and rejects foreign or duplicate contact identifiers" do
    first = create_tenant
    first_etag = response.headers["ETag"]
    second = create_tenant
    patch "/api/v1/tenants/#{first['id']}", params: { tenant: { description: "Missing version" } }, as: :json
    assert_response 428
    contacts = second["contacts"]
    patch "/api/v1/tenants/#{first['id']}", params: { tenant: { contacts: contacts } }, headers: { "If-Match" => first_etag }, as: :json
    assert_response :unprocessable_entity
    assert_equal first["contacts"].first["id"], TenantManagement::Tenant.find(first["id"]).contacts.sole.id
  end

  test "primary replacement and removal are atomic and retain existing contact identity" do
    data = create_tenant
    contacts = [data["contacts"].first.merge("primary" => false), { name: "Second", primary: true }]
    patch "/api/v1/tenants/#{data['id']}", params: { tenant: { contacts: contacts } }, headers: { "If-Match" => response.headers["ETag"] }, as: :json
    assert_response :success
    changed = response.parsed_body["data"]
    assert_equal 2, changed["contacts"].size
    assert_includes changed["contacts"].map { |contact| contact["id"] }, data["contacts"].first["id"]
    etag = response.headers["ETag"]
    patch "/api/v1/tenants/#{data['id']}", params: { tenant: { contacts: [{ primary: false }] } }, headers: { "If-Match" => etag }, as: :json
    assert_response :unprocessable_entity
    assert_equal 2, TenantManagement::Tenant.find(data["id"]).contacts.count
  end

  test "unchanged primary contact survives full-form resubmission" do
    data = create_tenant
    patch "/api/v1/tenants/#{data['id']}", params: { tenant: { contacts: data["contacts"] } }, headers: { "If-Match" => response.headers["ETag"] }, as: :json
    assert_response :success
    assert_equal data["contacts"], response.parsed_body.dig("data", "contacts")
  end

  test "scoped list search pagination and detail cannot expose another tenant" do
    first = create_tenant(company_name: "Alpha %literal")
    second = create_tenant(company_name: "Other")
    @adapter.visible_ids = [first["id"]]
    get "/api/v1/tenants", params: { q: "%literal", per_page: 1 }
    assert_response :success
    assert_equal [first["id"]], response.parsed_body["data"].map { |tenant| tenant["id"] }
    assert_equal 1, response.parsed_body.dig("meta", "total_count")
    get "/api/v1/tenants/#{second['id']}"
    assert_response :not_found
    patch "/api/v1/tenants/#{second['id']}", params: { tenant: { description: "Forbidden" } }, headers: { "If-Match" => '"1"' }, as: :json
    assert_response :not_found
  end

  test "invalid pagination and unapproved statuses fail explicitly" do
    [{ page: 0 }, { per_page: 101 }, { page: "1 OR 1=1" }, { status: "invented" }].each do |query|
      get "/api/v1/tenants", params: query
      assert_response :bad_request
    end
  end

  test "authentication and action denials happen before data exposure" do
    @adapter.actor = nil
    get "/api/v1/tenants"
    assert_response :unauthorized
    @adapter.actor = TenantManagementTestAdapter::Actor.new("restricted-admin")
    @adapter.denied_actions = [:create, :list]
    post "/api/v1/tenants", params: { tenant: payload }, as: :json
    assert_response :forbidden
    get "/api/v1/tenants"
    assert_response :forbidden
    assert_equal 0, TenantManagement::Tenant.count
  end

  test "unconfigured integration does not trust spoofed role headers" do
    Rails.application.config.x.tenant_management.integration = -> { TenantManagement::Integration.new }
    get "/api/v1/tenants", headers: { "X-Role" => "super_admin", "X-Admin-Id" => "pretend" }
    assert_response :unauthorized
  end

  test "provisioning failure returns failure without tenant settings or audit remnants" do
    @adapter.provision_failure = true
    assert_no_difference ["TenantManagement::Tenant.count", "TenantManagement::Contact.count", "TenantManagement::AuditEvent.count"] do
      post "/api/v1/tenants", params: { tenant: payload }, as: :json
    end
    assert_response :service_unavailable
    assert_equal "provisioning_failed", response.parsed_body.dig("error", "code")
  end

  test "unapproved asset references roll back all persistence" do
    @adapter.asset_failure = true
    post "/api/v1/tenants", params: { tenant: payload }, as: :json
    assert_response :unprocessable_entity
    assert_equal 0, TenantManagement::Tenant.count
    assert_empty @adapter.provisioned
  end

  test "lifecycle is gated and no delete route is supplied" do
    data = create_tenant
    post "/api/v1/tenants/#{data['id']}/lifecycle", params: { action: "suspend" }, as: :json
    assert_response :service_unavailable
    tenant = TenantManagement::Tenant.find(data["id"])
    assert_nil tenant.lifecycle_status
    assert_equal 1, tenant.audit_events.count
    assert_not tenant.destroy
    assert_not Rails.application.routes.routes.any? { |route| route.verb == "DELETE" && route.path.spec.to_s.include?("tenants") }
  end
end
