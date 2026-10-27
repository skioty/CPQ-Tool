require "test_helper"
require "minitest/mock"
class TenantRetentionAndMetadataTest < ActionDispatch::IntegrationTest
  setup do
    assert Rails.env.test?, "Deletion fixtures must never run outside the test environment"
    @password=SecureRandom.base64(24)
    @super=Platform::Administrator.create!(email:"retention-super-#{SecureRandom.hex(8)}@example.invalid",password:@password,role:"super_admin")
    @admin=Platform::Administrator.create!(email:"retention-admin-#{SecureRandom.hex(8)}@example.invalid",password:@password,role:"admin")
    @other=Platform::Administrator.create!(email:"retention-other-#{SecureRandom.hex(8)}@example.invalid",password:@password,role:"admin")
    TenantManagement::ReferenceOption.seed_defaults!
    @industry="sector-#{@admin.id}"
    TenantManagement::ReferenceOption.create!(kind:"industry",code:@industry,label:"Synthetic retention test sector")
    @previous=Rails.application.config.x.tenant_management.integration
    Rails.application.config.x.tenant_management.integration=-> {Platform::TenantIntegration.new}
    login(@super)
    @tenant=create_tenant("Synthetic retained tenant",@admin)
  end
  teardown do
    Apartment::Tenant.reset
    Rails.application.config.x.tenant_management.integration=@previous
  end
  def login(actor)
    get "/api/v1/session/csrf"
    post "/api/v1/session",params:{administrator:{email:actor.email,password:@password}},as: :json,headers:{"X-CSRF-Token"=>response.parsed_body["csrf_token"]}
    assert_response :success
  end
  def create_tenant(name,owner)
    post "/api/v1/tenants",params:{tenant:{ user_limit:10, primary_contact_role: "tenant_admin", company_name:name,display_name:"Display #{name}",country:"Bhutan",time_zone:"Asia/Thimphu",company_name_display:true,industry_id:@industry,responsible_admin_ids:[owner.id],contacts:[{name:"Synthetic contact",email:"retention.contact@example.invalid",primary:true}],subscription:{currency:"BTN",fee:"0",discount:{type:"percentage",value:"0",duration:nil}}}},as: :json
    assert_response :created
    TenantManagement::Tenant.find(response.parsed_body.dig("data","id"))
  end
  def archive
    post "/api/v1/tenants/#{@tenant.id}/lifecycle",params:{action:"archive"},as: :json
    assert_response :success
    @tenant.reload
  end
  def review(changes={})
    attrs={legal_hold:false,billing_resolved:true,contracts_resolved:true,retention_records_approved:true,retention_policy_reference:"Synthetic development policy reference"}.merge(changes)
    patch "/api/v1/tenants/#{@tenant.id}/retention",params:{clearances:attrs,review_note:"Synthetic manual records review"},as: :json
  end
  def eligible
    archive
    @tenant.update_column(:archived_at,91.days.ago)
    review
    assert_response :success
    assert response.parsed_body.dig("data","eligible")
  end
  def remove(password=@password,name=@tenant.company_name)
    delete "/api/v1/tenants/#{@tenant.id}/permanent_deletion",params:{password:password,confirmation:name},as: :json
  end
  def schema?(key)
    ActiveRecord::Base.connection.select_value("SELECT EXISTS(SELECT 1 FROM information_schema.schemata WHERE schema_name=#{ActiveRecord::Base.connection.quote(key)})")
  end
  test "optional metadata persists and the workspace identifier is server owned" do
    get "/api/v1/tenants/#{@tenant.id}"
    assert_response :success
    data=response.parsed_body.fetch("data")
    assert_equal "Bhutan",data["country"]
    assert_equal "Asia/Thimphu",data["time_zone"]
    assert_equal @tenant.id,data["workspace_identifier"]
    assert Time.iso8601(data["created_at"])
    version=response.headers["ETag"]
    patch "/api/v1/tenants/#{@tenant.id}",params:{tenant:{time_zone:"not-a-real-time-zone"}},as: :json,headers:{"If-Match"=>version}
    assert_response :unprocessable_entity
    assert response.parsed_body.dig("error","fields","time_zone").present?
    assert_equal "Asia/Thimphu",@tenant.reload.time_zone
    patch "/api/v1/tenants/#{@tenant.id}",params:{tenant:{workspace_identifier:SecureRandom.uuid}},as: :json,headers:{"If-Match"=>version}
    assert_response :unprocessable_entity
  end
  test "directory metrics and filters are derived only from authorized tenant records" do
    other=create_tenant("Other synthetic tenant",@other)
    user=TenantAccess::User.create!(email:"count-#{SecureRandom.hex(8)}@example.invalid",password:@password)
    TenantAccess::Membership.create!(user_id:user.id,tenant_id:@tenant.id)
    login(@admin)
    get "/api/v1/tenants"
    assert_response :success
    assert_equal 1,response.parsed_body.dig("summary","total")
    assert_equal [@tenant.id],response.parsed_body.fetch("data").map{|row|row["id"]}
    assert_equal 1,response.parsed_body.dig("data",0,"user_count")
    get "/api/v1/tenants",params:{q:other.id}
    assert_empty response.parsed_body.fetch("data")
    login(@super)
    get "/api/v1/tenants",params:{q:@tenant.id,industry:@industry}
    assert_response :success
    assert_equal [@tenant.id],response.parsed_body.fetch("data").map{|row|row["id"]}
    assert_equal 2,response.parsed_body.dig("summary","total")
  end
  test "archive records its timestamp and unknown clearances fail closed" do
    archive
    assert @tenant.archived_at
    assert Platform::TenantRetentionEvent.exists?(tenant_id:@tenant.id,action:"archive")
    get "/api/v1/tenants/#{@tenant.id}/retention"
    assert_response :success
    report=response.parsed_body.fetch("data")
    assert_not report["eligible"]
    assert_equal 90,report["retention_days"]
    assert_in_delta @tenant.archived_at+90.days,Time.iso8601(report["eligible_at"]),1
    assert report["blocking_reasons"].any?{|reason|reason.include?("Legal hold")}
    remove
    assert_response :conflict
    assert TenantManagement::Tenant.exists?(@tenant.id)
    assert schema?(@tenant.schema_key)
  end
  test "recent archive and every unresolved clearance block deletion" do
    eligible
    @tenant.reload.update_column(:archived_at,Time.current)
    remove
    assert_response :conflict
    @tenant.update_column(:archived_at,91.days.ago)
    [{legal_hold:true},{legal_hold:nil},{billing_resolved:false},{contracts_resolved:nil},{retention_records_approved:false},{retention_policy_reference:nil}].each do |changes|
      review(changes)
      assert_response :success
      assert_not response.parsed_body.dig("data","eligible")
      remove
      assert_response :conflict
      assert schema?(@tenant.schema_key)
    end
    assert_equal "public",Apartment::Tenant.current
  end
  test "assigned CPQ admins cannot approve clearances or delete and unassigned tenants stay hidden" do
    eligible
    login(@admin)
    review
    assert_response :forbidden
    remove
    assert_response :forbidden
    login(@other)
    get "/api/v1/tenants/#{@tenant.id}/retention"
    assert_response :not_found
  end
  test "reauthentication and exact name confirmation are mandatory" do
    eligible
    remove("incorrect")
    assert_response :unauthorized
    remove(@password,"incorrect name")
    assert_response :unprocessable_entity
    assert TenantManagement::Tenant.exists?(@tenant.id)
    assert schema?(@tenant.schema_key)
  end
  test "successful deletion removes only the target schema and retains audit evidence" do
    other=create_tenant("Unrelated retained tenant",@other)
    key=@tenant.schema_key
    Apartment::Tenant.switch(other.schema_key){TenantData::IsolationMarker.create!(value:"other-tenant-retained")}
    eligible
    remove
    assert_response :no_content
    assert_not TenantManagement::Tenant.exists?(@tenant.id)
    assert_not schema?(key)
    assert schema?(other.schema_key)
    assert_equal ["other-tenant-retained"],Apartment::Tenant.switch(other.schema_key){TenantData::IsolationMarker.pluck(:value)}
    evidence=Platform::TenantRetentionEvent.find_by!(tenant_id:@tenant.id,action:"permanently_deleted")
    assert evidence.details["audit_history"].any?{|entry|entry["action"]=="archive"}
    assert Platform::TenantRetentionEvent.exists?(tenant_id:@tenant.id,action:"retention_clearances_reviewed")
    assert_equal "public",Apartment::Tenant.current
  end
  test "restore retains data and rearchive starts a new retention period" do
    eligible
    post "/api/v1/tenants/#{@tenant.id}/lifecycle",params:{action:"restore"},as: :json
    assert_response :success
    assert_nil @tenant.reload.archived_at
    assert Platform::TenantRetentionEvent.exists?(tenant_id:@tenant.id,action:"restore")
    assert schema?(@tenant.schema_key)
    archive
    assert @tenant.archived_at > 1.minute.ago
  end
  test "commercial edits invalidate prior billing and preservation clearances" do
    eligible
    @tenant.reload
    patch "/api/v1/tenants/#{@tenant.id}",params:{tenant:{subscription:{fee:"1",payment_method:"bank_transfer"}}},as: :json,headers:{"If-Match"=>%Q("#{@tenant.lock_version}")}
    assert_response :success
    assert_nil @tenant.reload.billing_resolved
    assert_nil @tenant.contracts_resolved
    assert_nil @tenant.retention_records_approved
    remove
    assert_response :conflict
    assert schema?(@tenant.schema_key)
  end
  test "invalid retention configuration and production policy never allow deletion" do
    eligible
    previous=ENV["TENANT_RETENTION_DAYS"]
    ENV["TENANT_RETENTION_DAYS"]="invalid"
    remove
    assert_response :conflict
    ENV["TENANT_RETENTION_DAYS"]="90"
    Rails.env.stub(:production?,true) do
      remove
      assert_response :conflict
      assert response.parsed_body.dig("error","message").include?("disabled in production")
    end
    assert schema?(@tenant.schema_key)
  ensure
    previous.nil? ? ENV.delete("TENANT_RETENTION_DAYS") : ENV["TENANT_RETENTION_DAYS"]=previous
  end
end
