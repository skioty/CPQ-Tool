require "test_helper"
require "base64"
class ApprovedTenantRulesTest < ActionDispatch::IntegrationTest
  setup do
    @previous = Rails.application.config.x.tenant_management.integration
    Rails.application.config.x.tenant_management.integration = -> { Platform::TenantIntegration.new }
    TenantManagement::ReferenceOption.seed_defaults!
    TenantManagement::ReferenceOption.create!(kind: "industry", code: "test-sector", label: "Synthetic sector")
    @password = SecureRandom.base64(24)
    @super = Platform::Administrator.create!(email: "#{SecureRandom.hex(8)}@example.invalid", password: @password, role: "super_admin")
    @admin = Platform::Administrator.create!(email: "#{SecureRandom.hex(8)}@example.invalid", password: @password, role: "admin")
    @other = Platform::Administrator.create!(email: "#{SecureRandom.hex(8)}@example.invalid", password: @password, role: "admin")
    login(@super)
  end
  teardown { Rails.application.config.x.tenant_management.integration = @previous; Apartment::Tenant.reset }
  def login(actor)
    get "/api/v1/session/csrf"
    post "/api/v1/session", params: { administrator: {email: actor.email, password: @password} }, as: :json
    assert_response :success
  end
  def payload
    {company_name: "Synthetic approved tenant", industry_id: "test-sector", company_name_display: true,
      responsible_admin_ids: [@admin.id], contacts: [{name: "Contact", email: "contact@example.invalid", phone: nil, primary: true}],
      subscription: {currency: "BTN", fee: "0", payment_method: nil, discount: {type: "percentage", value: "0", duration: nil}}}
  end
  def create_tenant
    post "/api/v1/tenants", params: {tenant: payload}, as: :json
    assert_response :created
    response.parsed_body.fetch("data")
  end
  def transition(id, action, status = :success)
    post "/api/v1/tenants/#{id}/lifecycle", params: {action: action}, as: :json
    assert_response status
  end
  def patch_tenant(id, changes, status = :success)
    get "/api/v1/tenants/#{id}"
    etag = response.headers["ETag"]
    patch "/api/v1/tenants/#{id}", params: {tenant: changes}, headers: {"If-Match" => etag}, as: :json
    assert_response status
  end
  test "activity is tenant authorized paginated ordered and contains no private audit data" do
    data = create_tenant
    transition(data["id"], "activate")
    get "/api/v1/tenants/#{data['id']}/activity", params: { page: 1, per_page: 1 }
    assert_response :success
    body = response.parsed_body
    assert_equal 2, body.dig("meta", "total_count")
    assert_equal "activate", body.fetch("data").first.fetch("action")
    assert_equal %w[action changed_fields id occurred_at], body.fetch("data").first.keys.sort
    assert_equal "no-store", response.headers["Cache-Control"]
    get "/api/v1/tenants/#{data['id']}/activity", params: { page: 2, per_page: 1 }
    assert_equal "created", response.parsed_body.fetch("data").first.fetch("action")
    get "/api/v1/tenants/#{data['id']}/activity", params: { per_page: 101 }
    assert_response :bad_request
    login(@admin)
    get "/api/v1/tenants/#{data['id']}/activity"
    assert_response :success
    login(@other)
    get "/api/v1/tenants/#{data['id']}/activity"
    assert_response :not_found
    get "/api/v1/tenants/not-a-uuid/activity"
    assert_response :not_found
    delete "/api/v1/session"
    get "/api/v1/tenants/#{data['id']}/activity"
    assert_response :unauthorized
  end

  test "real creation defaults persistence required values decimal and exactly one assignment" do
    data = create_tenant
    assert_equal "inactive", data["lifecycle_status"]
    assert_equal "monthly", data.dig("subscription", "billing_interval")
    assert_equal "#17365D", data.dig("branding", "primary_colour")
    assert_equal 1, data["contacts"].count { |c| c["primary"] }
    assert ActiveRecord::Base.connection.schema_exists?(TenantManagement::Tenant.find(data["id"]).schema_key)
    [payload.merge(company_name: ""), payload.merge(responsible_admin_ids: []),
      payload.deep_merge(subscription: {fee: "-1"}), payload.deep_merge(subscription: {fee: "1.001"}),
      payload.deep_merge(subscription: {discount: {value: "100.01"}}),
      payload.deep_merge(subscription: {discount: {value: "10", duration: "0"}}),
      payload.deep_merge(subscription: {fee: "1", payment_method: "other", payment_method_description: ""})].each do |invalid|
      assert_no_difference "TenantManagement::Tenant.count" do
        post "/api/v1/tenants", params: {tenant: invalid}, as: :json
        assert_response :unprocessable_entity
      end
    end
  end
  test "assigned admin can edit company but cannot change commercial terms assignment or another tenant" do
    data = create_tenant
    login(@admin)
    patch_tenant(data["id"], {description: "Updated"})
    patch_tenant(data["id"], {subscription: {fee: "10"}}, :forbidden)
    patch_tenant(data["id"], {responsible_admin_ids: [@other.id]}, :forbidden)
    %w[suspend reactivate archive restore].each { |action| transition(data["id"], action, :forbidden) }
    transition(data["id"], "activate")
    transition(data["id"], "deactivate")
    login(@other)
    get "/api/v1/tenants/#{data['id']}"
    assert_response :not_found
  end
  test "approved transition matrix archive retention audit and separate activation" do
    data = create_tenant
    record = TenantManagement::Tenant.find(data["id"])
    key = record.schema_key
    transition(record.id, "activate")
    transition(record.id, "activate", :conflict)
    transition(record.id, "suspend")
    transition(record.id, "activate", :conflict)
    transition(record.id, "reactivate")
    assert_equal "inactive", record.reload.lifecycle_status
    transition(record.id, "archive")
    transition(record.id, "restore")
    assert_equal "inactive", record.reload.lifecycle_status
    assert ActiveRecord::Base.connection.schema_exists?(key)
    assert_equal 1, record.contacts.count
    assert_equal "0.0", record.subscription.fee.to_s("F")
    assert_equal %w[created activate suspend reactivate archive restore], record.audit_events.order(:created_at).pluck(:action)
    assert_not record.destroy
  end
  test "activation requires complete settings and ready provisioning" do
    data = create_tenant
    record = TenantManagement::Tenant.find(data["id"])
    record.update!(provisioning_status: "pending")
    transition(record.id, "activate", :conflict)
    record.update!(provisioning_status: "ready", company_name: nil)
    transition(record.id, "activate", :unprocessable_entity)
  end
  test "every approved super admin transition works and disabled assignment blocks activation" do
    data = create_tenant
    tenant = TenantManagement::Tenant.find(data["id"])
    TenantManagement::Lifecycle::TRANSITIONS.each do |action, (sources, target)|
      sources.each do |source|
        tenant.update!(lifecycle_status: source)
        transition(tenant.id, action)
        assert_equal target, tenant.reload.lifecycle_status
      end
    end
    tenant.update!(lifecycle_status: "inactive")
    @admin.update!(enabled: false)
    transition(tenant.id, "activate", :unprocessable_entity)
  end
  test "image decoder enforces allowed formats sizes and dimensions" do
    %w[png jpeg webp].each do |format|
      bytes = IO.popen(["convert", "-size", "32x32", "xc:blue", "#{format}:-"], "rb", &:read)
      assert_equal bytes, TenantManagement::ImageValidator.read!(StringIO.new(bytes), "logo").first
    end
    %w[png ico].each do |format|
      bytes = IO.popen(["convert", "-size", "32x32", "xc:blue", "#{format}:-"], "rb", &:read)
      assert_equal bytes, TenantManagement::ImageValidator.read!(StringIO.new(bytes), "favicon").first
    end
    [["logo", "x" * (2 * 1024 * 1024 + 1)], ["favicon", "x" * (500 * 1024 + 1)], ["logo", "<svg></svg>"]].each do |kind, bytes|
      assert_raises(TenantManagement::Error) { TenantManagement::ImageValidator.read!(StringIO.new(bytes), kind) }
    end
    [["favicon", "30x30"], ["logo", "2049x1"]].each do |kind, size|
      bytes = IO.popen(["convert", "-size", size, "xc:blue", "png:-"], "rb", &:read)
      assert_raises(TenantManagement::Error) { TenantManagement::ImageValidator.read!(StringIO.new(bytes), kind) }
    end
  end
  test "currency locks after first invoice and optional values can clear" do
    data = create_tenant
    patch_tenant(data["id"], {description: "Before"})
    patch_tenant(data["id"], {description: nil})
    assert_nil response.parsed_body.dig("data", "description")
    TenantManagement::Tenant.find(data["id"]).subscription.update!(first_invoiced_at: Time.current)
    patch_tenant(data["id"], {subscription: {currency: "USD"}}, :unprocessable_entity)
  end
  test "reference controls disable without deleting history" do
    data = create_tenant
    option = TenantManagement::ReferenceOption.find_by!(kind: "industry", code: "test-sector")
    patch "/api/v1/reference_options/#{option.id}", params: {option: {enabled: false}}, as: :json
    assert_response :success
    patch_tenant(data["id"], {description: "Historical reference retained"})
    post "/api/v1/tenants", params: {tenant: payload}, as: :json
    assert_response :unprocessable_entity
    login(@admin)
    post "/api/v1/reference_options", params: {option: {kind: "industry", code: "forbidden", label: "Forbidden"}}, as: :json
    assert_response :forbidden
  end
  test "upload validates bytes dimensions ownership replacement and archive retention" do
    bytes = IO.popen(["convert", "-size", "32x32", "xc:red", "png:-"], "rb", &:read)
    file = Tempfile.new(["test", ".png"]); file.binmode; file.write(bytes); file.rewind
    upload = Rack::Test::UploadedFile.new(file.path, "image/png")
    post "/api/v1/brand_assets", params: {kind: "logo", file: upload}
    assert_response :created
    asset = response.parsed_body.fetch("id")
    data = create_tenant
    patch_tenant(data["id"], {branding: {logo_attachment_id: asset}})
    assert_equal data["id"], TenantManagement::BrandAsset.find(asset).tenant_id
    get "/api/v1/brand_assets/#{asset}"
    assert_response :success
    login(@other)
    get "/api/v1/brand_assets/#{asset}"
    assert_response :not_found
    login(@super)
    patch_tenant(data["id"], {branding: {logo_attachment_id: nil}})
    assert_nil response.parsed_body.dig("data", "branding", "logo_attachment_id")
    assert TenantManagement::BrandAsset.exists?(asset)
    file.rewind; file.truncate(0); file.write("not an image"); file.flush
    post "/api/v1/brand_assets", params: {kind: "logo", file: Rack::Test::UploadedFile.new(file.path, "image/png")}
    assert_response :unprocessable_entity
  ensure
    file&.close!
  end
end
