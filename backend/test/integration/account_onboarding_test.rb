require "test_helper"
require "digest"
require "minitest/mock"
class AccountOnboardingTest < ActionDispatch::IntegrationTest
  setup do
    @password = SecureRandom.base64(24)
    @super = Platform::Administrator.create!(email: "super-#{SecureRandom.hex(8)}@example.invalid", password: @password, role: "super_admin")
    @admin = Platform::Administrator.create!(email: "admin-#{SecureRandom.hex(8)}@example.invalid", password: @password, role: "admin")
    @other = Platform::Administrator.create!(email: "other-#{SecureRandom.hex(8)}@example.invalid", password: @password, role: "admin")
    TenantManagement::ReferenceOption.seed_defaults!
    TenantManagement::ReferenceOption.create!(kind: "industry", code: "sector-#{@admin.id}", label: "Synthetic onboarding sector")
    @previous = Rails.application.config.x.tenant_management.integration
    Rails.application.config.x.tenant_management.integration = -> { Platform::TenantIntegration.new }
    ActionMailer::Base.deliveries.clear
    login(@super)
    post "/api/v1/tenants", params: {tenant: {company_name: "Synthetic onboarding company", company_name_display: true, industry_id: "sector-#{@admin.id}",
      responsible_admin_ids: [@admin.id], contacts: [{name:"Contact",email:"contact@example.invalid",primary:true}],
      subscription: {currency:"BTN",fee:"0",discount:{type:"percentage",value:"0",duration:nil}}}}, as: :json
    assert_response :created
    @tenant = TenantManagement::Tenant.find(response.parsed_body.dig("data","id"))
  end
  teardown do
    Rails.application.config.x.tenant_management.integration = @previous
    Apartment::Tenant.reset
  end
  def login(actor)
    get "/api/v1/session/csrf"
    post "/api/v1/session", params: {administrator: {email: actor.email, password: @password}}, as: :json, headers: {"X-CSRF-Token"=>response.parsed_body["csrf_token"]}
    assert_response :success
    @csrf = response.parsed_body["csrf_token"]
  end
  def token
    ActionMailer::Base.deliveries.last.body.decoded.match(/#token=([A-Za-z0-9_-]+)/)[1]
  end
  def invite(email = "invite-#{SecureRandom.hex(8)}@example.invalid")
    post "/api/v1/tenants/#{@tenant.id}/invitations", params: {email: email}, as: :json
    assert_response :created
    [response.parsed_body.dig("data","id"), token]
  end
  def accept(raw, password = @password)
    post "/api/v1/invitation_acceptance", params: {token:raw,password:password,password_confirmation:password}, as: :json
  end
  test "setup review uses the existing required rules and authorized tenant scope" do
    get "/api/v1/tenants/#{@tenant.id}/setup_review"
    assert_response :success
    assert response.parsed_body.dig("data","complete")
    assert response.parsed_body.dig("data","can_activate")
    assert_equal 6, response.parsed_body.dig("data","checks").length
    @tenant.subscription.update_column(:fee, nil)
    get "/api/v1/tenants/#{@tenant.id}/setup_review"
    assert_not response.parsed_body.dig("data","complete")
    assert_not response.parsed_body.dig("data","can_activate")
    login(@other)
    get "/api/v1/tenants/#{@tenant.id}/setup_review"
    assert_response :not_found
  end
  test "only Super Admin manages staff and assigned admins cannot be disabled" do
    login(@admin)
    get "/api/v1/administrators"
    assert_response :forbidden
    login(@super)
    patch "/api/v1/administrators/#{@super.id}", params: {administrator:{enabled:false}}, as: :json
    assert_response :forbidden
    patch "/api/v1/administrators/#{@admin.id}", params: {administrator:{enabled:false}}, as: :json
    assert_response :conflict
    assert @admin.reload.enabled?
    patch "/api/v1/administrators/#{@other.id}", params: {administrator:{name:"Optional display name",enabled:false,role:"super_admin"}}, as: :json
    assert_response :no_content
    assert_not @other.reload.enabled?
    assert_equal "admin", @other.role
    patch "/api/v1/administrators/#{@other.id}", params: {administrator:{enabled:true}}, as: :json
    assert_response :no_content
    assert @other.reload.enabled?
  end
  test "staff activation sends email stores only a digest and consumes the link once" do
    email = "staff-#{SecureRandom.hex(8)}@example.invalid"
    post "/api/v1/administrators", params: {administrator:{email:email,name:"Invited staff"}}, as: :json
    assert_response :created
    raw=token
    account=Platform::Administrator.find_by!(email:email)
    assert_not account.enabled?
    record=Platform::Invitation.find(response.parsed_body.dig("invitation","id"))
    assert_equal Digest::SHA256.hexdigest(raw), record.token_digest
    assert_not_equal raw, record.token_digest
    assert_equal [email], ActionMailer::Base.deliveries.last.to
    assert_in_delta 72.hours, record.expires_at-Time.current, 30
    accept(raw, "short")
    assert_response :unprocessable_entity
    assert_nil record.reload.accepted_at
    accept(raw)
    assert_response :success
    assert account.reload.enabled?
    assert account.valid_password?(@password)
    accept(raw)
    assert_response :gone
    login(account)
    get "/api/v1/administrators"
    assert_response :forbidden
  end
  test "tenant invitations require assigned access and never create contact accounts automatically" do
    assert_equal 0, TenantAccess::User.count
    login(@other)
    post "/api/v1/tenants/#{@tenant.id}/invitations", params:{email:"contact@example.invalid"}, as: :json
    assert_response :not_found
    login(@admin)
    id, raw=invite("contact@example.invalid")
    assert_equal 0, TenantAccess::User.count
    assert_equal 0, TenantAccess::Membership.count
    accept(raw)
    assert_response :success
    assert_equal 1, TenantAccess::User.count
    assert_equal "tenant_admin", TenantAccess::Membership.first.role
    get "/api/v1/tenants/#{@tenant.id}/invitations"
    assert_response :success
    assert_equal "accepted", response.parsed_body.fetch("data").find { |r|r["id"]==id }["state"]
  end
  test "resend rotates tokens revoked and expired links cannot be used" do
    id, old=invite
    post "/api/v1/invitations/#{id}/resend", as: :json
    assert_response :success
    fresh=token
    assert_not_equal old, fresh
    accept(old)
    assert_response :gone
    record=Platform::Invitation.find_by!(token_digest:Digest::SHA256.hexdigest(fresh))
    post "/api/v1/invitations/#{record.id}/revoke", as: :json
    assert_response :no_content
    accept(fresh)
    assert_response :gone
    _, expiring=invite
    record=Platform::Invitation.find_by!(token_digest:Digest::SHA256.hexdigest(expiring))
    record.update!(expires_at:1.minute.ago)
    accept(expiring)
    assert_response :gone
  end
  test "existing tenant accounts must prove their password and it is never reset by an invitation" do
    user=TenantAccess::User.create!(email:"existing-#{SecureRandom.hex(8)}@example.invalid",password:@password)
    _,raw=invite(user.email)
    accept(raw,SecureRandom.base64(24))
    assert_response :unauthorized
    assert_equal 0,TenantAccess::Membership.count
    assert user.reload.valid_password?(@password)
    accept(raw)
    assert_response :success
    assert user.reload.valid_password?(@password)
  end
  test "delivery failure is visible and missing SMTP cannot report success" do
    delivery=Object.new
    def delivery.deliver_now; raise IOError,"Synthetic delivery failure";end
    Platform::InvitationMailer.stub(:invitation,delivery) do
      post "/api/v1/tenants/#{@tenant.id}/invitations",params:{email:"failed@example.invalid"},as: :json
      assert_response :service_unavailable
    end
    assert_equal "failed",Platform::Invitation.last.delivery_status
    assert_equal 0,TenantAccess::User.count
    Platform::Invitations.stub(:configured?,false) do
      assert_no_difference "Platform::Invitation.count" do
        post "/api/v1/tenants/#{@tenant.id}/invitations",params:{email:"blocked@example.invalid"},as: :json
        assert_response :service_unavailable
      end
    end
  end
  test "tenant sign in is separate and inactive suspended and archived workspaces are denied" do
    _,raw=invite
    email=Platform::Invitation.last.email
    accept(raw)
    assert_response :success
    post "/api/v1/tenant_session",params:{tenant_user:{email:email,password:@password}},as: :json
    assert_response :success
    get "/api/v1/tenants"
    assert_response :unauthorized
    %w[inactive suspended archived].each do |status|
      @tenant.update_column(:lifecycle_status,status)
      get "/api/v1/my_workspaces/#{@tenant.id}"
      assert_response :conflict
      assert_equal "public",Apartment::Tenant.current
    end
    @tenant.update_column(:lifecycle_status,"active")
    get "/api/v1/my_workspaces/#{@tenant.id}"
    assert_response :success
    assert_equal @tenant.company_name,response.parsed_body.dig("data","company_name")
    assert_nil response.parsed_body.dig("data","subscription")
    get "/api/v1/my_workspaces/#{SecureRandom.uuid}"
    assert_response :not_found
    assert_equal "public",Apartment::Tenant.current
    delete "/api/v1/tenant_session"
    get "/api/v1/my_workspaces"
    assert_response :unauthorized
  end
  test "tenant membership switching uses trusted schemas and restores context after errors" do
    _,raw=invite
    accept(raw)
    @tenant.update_column(:lifecycle_status,"active")
    user=TenantAccess::User.first
    assert_raises(RuntimeError) do
      Platform::TenantContext.with_membership(user:user,tenant_id:@tenant.id) do
        assert_equal @tenant.schema_key,Apartment::Tenant.current
        raise "Synthetic workspace failure"
      end
    end
    assert_equal "public",Apartment::Tenant.current
    TenantAccess::Membership.first.update!(enabled:false)
    assert_raises(ActiveRecord::RecordNotFound) {Platform::TenantContext.with_membership(user:user,tenant_id:@tenant.id){flunk}}
    assert_equal "public",Apartment::Tenant.current
  end
  test "one invited tenant account alternates between two real schemas without leaking records" do
    _,raw=invite
    email=Platform::Invitation.last.email
    accept(raw)
    user=TenantAccess::User.find_by!(email:email)
    login(@super)
    post "/api/v1/tenants", params:{tenant:{company_name:"Second synthetic company",company_name_display:true,industry_id:"sector-#{@admin.id}",responsible_admin_ids:[@admin.id],contacts:[{name:"Contact",email:"second@example.invalid",primary:true}],subscription:{currency:"BTN",fee:"0",discount:{type:"percentage",value:"0",duration:nil}}}},as: :json
    assert_response :created
    second=TenantManagement::Tenant.find(response.parsed_body.dig("data","id"))
    post "/api/v1/tenants/#{second.id}/invitations",params:{email:email},as: :json
    assert_response :created
    accept(token)
    assert_response :success
    [@tenant,second].each_with_index do |tenant,index|
      tenant.update_column(:lifecycle_status,"active")
      Platform::TenantContext.with_membership(user:user,tenant_id:tenant.id) {TenantData::IsolationMarker.create!(value:"marker-#{index}")}
    end
    [@tenant,second,@tenant,second].each_with_index do |tenant,index|
      values=Platform::TenantContext.with_membership(user:user,tenant_id:tenant.id) {TenantData::IsolationMarker.pluck(:value)}
      assert_equal ["marker-#{index%2}"],values
      assert_equal "public",Apartment::Tenant.current
    end
  end

  test "invitation acceptance enforces CSRF and no public registration is routed" do
    _,raw=invite
    previous=ApplicationController.allow_forgery_protection
    ApplicationController.allow_forgery_protection=true
    accept(raw)
    assert_response :unprocessable_entity
    assert_nil Platform::Invitation.find_by!(token_digest:Digest::SHA256.hexdigest(raw)).accepted_at
    assert_not Rails.application.routes.routes.any? { |route| route.path.spec.to_s.include?("sign_up") }
  ensure
    ApplicationController.allow_forgery_protection=previous
  end
end
