require "test_helper"
class TenantSetupAndSeatsTest < ActionDispatch::IntegrationTest
  setup do
    @previous=Rails.application.config.x.tenant_management.integration
    Rails.application.config.x.tenant_management.integration=-> {Platform::TenantIntegration.new}
    @password=SecureRandom.base64(24)
    @super=Platform::Administrator.create!(email:"setup-#{SecureRandom.hex(6)}@example.invalid",password:@password,role:"super_admin")
    @admin=Platform::Administrator.create!(email:"owner-#{SecureRandom.hex(6)}@example.invalid",password:@password,role:"admin")
    TenantManagement::ReferenceOption.seed_defaults!
    login(@super)
  end
  teardown {Rails.application.config.x.tenant_management.integration=@previous;Apartment::Tenant.reset}
  def login(actor)
    get "/api/v1/session/csrf"
    post "/api/v1/session",params:{administrator:{email:actor.email,password:@password}},as: :json,headers:{"X-CSRF-Token"=>response.parsed_body["csrf_token"]}
    assert_response :success
  end
  def payload
    {company_name:"Setup acceptance",user_limit:2,primary_contact_role:"tenant_admin",country:"BT",time_zone:"Asia/Thimphu",company_name_display:true,industry_id:"services",responsible_admin_ids:[@admin.id],contacts:[{name:"Primary",email:"primary@example.invalid",primary:true}],subscription:{currency:"BTN",fee:"0",discount:{type:"percentage",value:"0",duration:nil}}}
  end
  def create_tenant(changes={})
    post "/api/v1/tenants",params:{tenant:payload.merge(changes)},as: :json
    assert_response :created
    TenantManagement::Tenant.find(response.parsed_body.dig("data","id"))
  end
  test "reference data includes countries real IANA offsets and approved industries" do
    get "/api/v1/reference_options"
    assert_response :success
    data=response.parsed_body
    assert_equal TZInfo::Country.all.map(&:code).sort,data["countries"].map{|c|c["id"]}.sort
    assert_equal TZInfo::Timezone.all_identifiers.sort,data["time_zones"].map{|z|z["id"]}.sort
    assert_equal ["Asia/Thimphu"],data["country_time_zones"]["BT"]
    assert_includes data["country_time_zones"]["US"],"America/New_York"
    assert_includes data["countries"],{"id"=>"BT","label"=>"Bhutan"}
    assert data["time_zones"].any? { |z|z["id"]=="Asia/Thimphu" && z["label"].include?("UTC+06:00") }
    %w[raw_materials services manufacturing].each { |code|assert data["data"].any?{|o|o["kind"]=="industry"&&o["code"]==code} }
  end
  test "custom industries are trimmed unique and platform permission controlled" do
    post "/api/v1/reference_options",params:{option:{kind:"industry",code:"custom_test",label:"  Aerospace Test  "}},as: :json
    assert_response :created
    assert_equal "Aerospace Test",response.parsed_body.dig("data","label")
    tenant=create_tenant(industry_id:"custom_test")
    get "/api/v1/tenants/#{tenant.id}"
    assert_equal "custom_test",response.parsed_body.dig("data","industry_id")
    post "/api/v1/reference_options",params:{option:{kind:"industry",code:"different",label:" aerospace test "}},as: :json
    assert_response :unprocessable_entity
    login(@admin)
    post "/api/v1/reference_options",params:{option:{kind:"industry",code:"forbidden",label:"Private"}},as: :json
    assert_response :forbidden
  end
  test "required capacity role and geographic values persist through editing" do
    [nil,0,-1,1.5,"2"].each { |limit|post "/api/v1/tenants",params:{tenant:payload.merge(user_limit:limit)},as: :json;assert_response :unprocessable_entity }
    post "/api/v1/tenants",params:{tenant:payload.merge(primary_contact_role:"super_admin")},as: :json
    assert_response :unprocessable_entity
    tenant=create_tenant
    assert_equal "BT",tenant.country
    assert_equal "Asia/Thimphu",tenant.time_zone
    assert_equal "tenant_admin",tenant.primary_contact_role
    assert_equal 1,TenantManagement::Seats.emails(tenant).length
    patch "/api/v1/tenants/#{tenant.id}",params:{tenant:{user_limit:3,country:"IN",time_zone:"Asia/Kolkata"}},as: :json,headers:{"If-Match"=>%Q("#{tenant.lock_version}")}
    assert_response :success
    assert_equal 3,tenant.reload.user_limit
    assert_equal "Asia/Kolkata",tenant.time_zone
  end
  test "primary reservation pending invitations resend and acceptance count once" do
    tenant=create_tenant(user_limit:1)
    record=Platform::Invitations.issue!(actor:@super,kind:"tenant",email:"primary@example.invalid",tenant:tenant)
    assert_equal 1,TenantManagement::Seats.emails(tenant).length
    assert_raises(TenantManagement::Error){Platform::Invitations.issue!(actor:@super,kind:"tenant",email:"extra@example.invalid",tenant:tenant)}
    fresh=Platform::Invitations.issue!(actor:@super,kind:"tenant",email:"PRIMARY@example.invalid",tenant:tenant)
    assert record.reload.revoked_at
    Platform::Invitations.accept!(token:fresh.issued_token,password:@password,confirmation:@password,name:"Synthetic recipient")
    assert_equal 1,TenantManagement::Seats.emails(tenant).length
    user=TenantAccess::User.find_by!(email:"primary@example.invalid")
    assert_equal "tenant_admin",TenantAccess::Membership.find_by!(tenant_id:tenant.id,user_id:user.id).role
  end
  test "limit cannot be reduced below occupancy and activation cannot bypass capacity" do
    tenant=create_tenant
    invite=Platform::Invitations.issue!(actor:@super,kind:"tenant",email:"pending@example.invalid",tenant:tenant)
    patch "/api/v1/tenants/#{tenant.id}",params:{tenant:{user_limit:1}},as: :json,headers:{"If-Match"=>%Q("#{tenant.reload.lock_version}")}
    assert_response :unprocessable_entity
    assert_equal 2,tenant.reload.user_limit
    user=TenantAccess::User.create!(email:"disabled@example.invalid",password:@password,enabled:false)
    TenantAccess::Membership.create!(tenant:tenant,user:user,role:"tenant_admin",enabled:true)
    assert_raises(TenantManagement::Error){user.update!(enabled:true)}
    invite.update!(revoked_at:Time.current)
    user.reload.update!(enabled:true)
    assert_equal 2,TenantManagement::Seats.emails(tenant).length
    other=TenantAccess::User.create!(email:"other@example.invalid",password:@password)
    assert_raises(TenantManagement::Error){TenantAccess::Membership.create!(tenant:tenant,user:other,role:"tenant_admin",enabled:true)}
  end
  test "acceptance is tenant scoped and expired or revoked invitations release seats" do
    tenant=create_tenant
    pending=Platform::Invitations.issue!(actor:@super,kind:"tenant",email:"invited@example.invalid",tenant:tenant)
    assert_equal 2,TenantManagement::Seats.emails(tenant).length
    pending.update!(expires_at:1.second.ago)
    assert_equal 1,TenantManagement::Seats.emails(tenant).length
    fresh=Platform::Invitations.issue!(actor:@super,kind:"tenant",email:"invited@example.invalid",tenant:tenant)
    Platform::Invitations.accept!(token:fresh.issued_token,password:@password,confirmation:@password,name:"Synthetic recipient")
    assert_equal 2,TenantManagement::Seats.emails(tenant).length
    user=TenantAccess::User.find_by!(email:"invited@example.invalid")
    first=TenantAccess::Membership.find_by!(tenant_id:tenant.id,user_id:user.id)
    before=first.attributes
    other=create_tenant(company_name:"Second scope")
    other_invite=Platform::Invitations.issue!(actor:@super,kind:"tenant",email:user.email,tenant:other)
    Platform::Invitations.accept!(token:other_invite.issued_token,password:@password,confirmation:nil)
    assert_equal before,first.reload.attributes
    assert_equal "tenant_admin",TenantAccess::Membership.find_by!(tenant_id:other.id,user_id:user.id).role
  end
  test "pricing configuration permissions overlap validation and optimistic concurrency" do
    get "/api/v1/subscription_pricing"
    assert_response :success
    version = response.parsed_body.dig("data","lock_version")
    tiers = [{currency:"BTN",min_users:1,max_users:25,fee:"100.00"}]
    patch "/api/v1/subscription_pricing",params:{pricing:{tiers:tiers,lock_version:version}},as: :json
    assert_response :success
    patch "/api/v1/subscription_pricing",params:{pricing:{tiers:tiers,lock_version:version}},as: :json
    assert_response :conflict
    version = TenantManagement::SubscriptionPricing.current!.lock_version
    patch "/api/v1/subscription_pricing",params:{pricing:{tiers:tiers+[{currency:"BTN",min_users:25,max_users:50,fee:"200"}],lock_version:version}},as: :json
    assert_response :unprocessable_entity
    assert_equal 1,TenantManagement::SubscriptionPricing.current!.tiers.length
    login(@admin)
    get "/api/v1/subscription_pricing"
    assert_response :forbidden
    patch "/api/v1/subscription_pricing",params:{pricing:{tiers:[],lock_version:version}},as: :json
    assert_response :forbidden
  end
  test "automatic fee is authoritative and custom pricing survives capacity changes" do
    TenantManagement::SubscriptionPricing.current!.update!(tiers:[{currency:"BTN",min_users:1,max_users:25,fee:"100.00"},{currency:"BTN",min_users:26,max_users:50,fee:"180.00"}])
    tenant=create_tenant(subscription:payload[:subscription].merge(pricing_mode:"automatic",fee:"1",payment_method:"other",payment_method_description:"Synthetic test only"))
    assert_equal BigDecimal("100"),tenant.subscription.fee
    assert_equal "automatic",TenantManagement::Serializer.detail(tenant)[:subscription][:pricing_mode]
    patch "/api/v1/tenants/#{tenant.id}",params:{tenant:{user_limit:26}},as: :json,headers:{"If-Match"=>%Q("#{tenant.reload.lock_version}")}
    assert_response :success
    assert_equal BigDecimal("180"),tenant.subscription.reload.fee
    patch "/api/v1/tenants/#{tenant.id}",params:{tenant:{user_limit:51}},as: :json,headers:{"If-Match"=>%Q("#{tenant.reload.lock_version}")}
    assert_response :unprocessable_entity
    assert_equal 26,tenant.reload.user_limit
    patch "/api/v1/tenants/#{tenant.id}",params:{tenant:{subscription:{pricing_mode:"custom",fee:"321.45",discount:{type:"percentage",value:"10",duration:"3"}}}},as: :json,headers:{"If-Match"=>%Q("#{tenant.reload.lock_version}")}
    assert_response :success
    patch "/api/v1/tenants/#{tenant.id}",params:{tenant:{user_limit:51}},as: :json,headers:{"If-Match"=>%Q("#{tenant.reload.lock_version}")}
    assert_response :success
    assert_equal BigDecimal("321.45"),tenant.subscription.reload.fee
    assert_equal BigDecimal("10"),tenant.subscription.discount_value
    assert_equal "3",tenant.subscription.discount_duration.to_s
  end

  test "currency quotes country defaults and saved automatic conversion use the authoritative snapshot" do
    get "/api/v1/reference_options"
    assert_response :success
    assert_equal ["INR"],response.parsed_body.dig("country_currencies","IN")
    assert_equal "BTN",response.parsed_body.dig("country_currencies","BT").first
    assert_equal ["USD"],response.parsed_body.dig("country_currencies","US")
    TenantManagement::SubscriptionPricing.current!.update!(tiers:[{currency:"BTN",min_users:26,max_users:50,fee:"4500.00"}])
    book=TenantManagement::ExchangeRateBook.current!
    book.update!(rates:{"USD"=>"1","BTN"=>"90","INR"=>"90","EUR"=>"0.9"},rate_time:Time.current,fetched_at:Time.current)
    get "/api/v1/subscription_quote",params:{user_limit:50,currency:"USD"}
    assert_response :success
    assert_equal "50.00",response.parsed_body.dig("data","fee")
    assert_equal "BTN",response.parsed_body.dig("data","source_currency")
    tenant=create_tenant(user_limit:50,country:"US",time_zone:"America/New_York",subscription:payload[:subscription].merge(pricing_mode:"automatic",currency:"USD",fee:"1",payment_method:"bank_transfer",discount:{type:"percentage",value:"15",duration:"3"}))
    assert_equal BigDecimal("50"),tenant.subscription.fee
    assert_equal "BTN",tenant.subscription.pricing_conversion["source_currency"]
    assert_equal "4500.00",tenant.subscription.pricing_conversion["source_fee"]
    get "/api/v1/tenants/#{tenant.id}"
    assert_equal "USD",response.parsed_body.dig("data","subscription","currency")
    assert_equal "BTN",response.parsed_body.dig("data","subscription","pricing_conversion","source_currency")
    login(@admin)
    get "/api/v1/subscription_quote",params:{source_currency:"BTN",currency:"USD",amount:"4500"}
    assert_response :forbidden
    patch "/api/v1/tenants/#{tenant.id}",params:{tenant:{subscription:{currency:"EUR"}}},as: :json,headers:{"If-Match"=>%Q("#{tenant.reload.lock_version}")}
    assert_response :forbidden
    login(@super)
    book.update!(rate_time:3.days.ago,last_attempt_at:Time.current)
    get "/api/v1/subscription_quote",params:{user_limit:50,currency:"USD"}
    assert_response :unprocessable_entity
    assert_equal "exchange_rate_unavailable",response.parsed_body.dig("error","code")
    get "/api/v1/subscription_quote",params:{source_currency:"BTN",currency:"USD",amount:"-1"}
    assert_response :unprocessable_entity
  end

end
