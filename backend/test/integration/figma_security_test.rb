require "test_helper"
require "minitest/mock"

class FigmaSecurityTest < ActionDispatch::IntegrationTest
  setup do
    @previous = Rails.application.config.x.account_security.enforce
    Rails.application.config.x.account_security.enforce = true
    @password = SecureRandom.base64(24)
    @account = Platform::Administrator.create!(email:"security-#{SecureRandom.hex(8)}@example.invalid",password:@password,role:"super_admin")
  end
  teardown { Rails.application.config.x.account_security.enforce = @previous }
  def password_login(scope="administrator", account=@account)
    get "/api/v1/session/csrf"
    csrf = response.parsed_body["csrf_token"]
    post scope == "administrator" ? "/api/v1/session" : "/api/v1/tenant_session", params:{scope=>{email:account.email,password:@password}},as: :json,headers:{"X-CSRF-Token"=>csrf}
    assert_response :accepted
    @csrf = response.parsed_body["csrf_token"]
    get "/api/v1/factor"
    assert_response :success
    @setup = response.parsed_body.fetch("data")
  end
  def enroll(scope="administrator",account=@account)
    password_login(scope,account)
    @secret = @setup.fetch("setup_key")
    post "/api/v1/factor",params:{code:ROTP::TOTP.new(@secret).now},as: :json,headers:{"X-CSRF-Token"=>@csrf}
    assert_response :success
    @codes = response.parsed_body.fetch("recovery_codes")
    @csrf = response.parsed_body.fetch("csrf_token")
  end
  test "password alone cannot access platform actions and verified enrollment returns recovery codes once" do
    password_login
    assert @setup["enrollment"]
    secret = @setup["setup_key"]
    get "/api/v1/tenants"
    assert_response :unauthorized
    post "/api/v1/factor",params:{code:ROTP::TOTP.new(secret).now},as: :json
    assert_response :success
    codes = response.parsed_body.fetch("recovery_codes")
    assert_equal 10,codes.length
    assert_equal 10,@account.reload.recovery_code_digests.length
    assert_not_equal secret,@account.totp_secret_ciphertext
    assert_equal secret,Platform::AccountSecurity.secret(@account)
    assert (codes & @account.recovery_code_digests).empty?
    get "/api/v1/tenants"
    assert_response :success
    get "/api/v1/factor"
    assert_response :unauthorized
  end
  test "authenticator codes cannot be replayed and recovery codes work only once" do
    enroll
    used = ROTP::TOTP.new(@secret).at(@account.reload.totp_last_used_at)
    password_login
    assert_not @setup["enrollment"]
    assert_nil @setup["setup_key"]
    post "/api/v1/factor",params:{code:used},as: :json
    assert_response :unprocessable_entity
    post "/api/v1/factor",params:{code:@codes.first},as: :json
    assert_response :success
    assert_nil response.parsed_body["recovery_codes"]
    password_login
    post "/api/v1/factor",params:{code:@codes.first},as: :json
    assert_response :unprocessable_entity
    get "/api/v1/tenants"
    assert_response :unauthorized
  end
  test "failed factor attempts are persisted and restarting sign in does not bypass lockout" do
    password_login
    5.times do
      post "/api/v1/factor",params:{code:"invalid"},as: :json
      assert_response :unprocessable_entity
    end
    assert_equal 5,@account.reload.totp_failed_attempts
    assert @account.totp_locked_until > Time.current
    password_login
    post "/api/v1/factor",params:{code:ROTP::TOTP.new(@setup["setup_key"]).now},as: :json
    assert_response :too_many_requests
  end
    test "expired lock starts a fresh attempt window and accepts a valid code" do
      @account.update!(totp_failed_attempts:5,totp_locked_until:1.second.ago)
      password_login
      post "/api/v1/factor",params:{code:"invalid"},as: :json
      assert_response :unprocessable_entity
      assert_equal 1,@account.reload.totp_failed_attempts
      assert_nil @account.totp_locked_until
      post "/api/v1/factor",params:{code:ROTP::TOTP.new(@setup["setup_key"]).now},as: :json
      assert_response :success
      assert_equal 0,@account.reload.totp_failed_attempts
      assert_nil @account.totp_locked_until
    end
    test "expired and disabled account challenges do not create sessions" do
    password_login
    travel 11.minutes do
      get "/api/v1/factor"
      assert_response :unauthorized
    end
    password_login
    @account.update!(enabled:false)
    post "/api/v1/factor",params:{code:ROTP::TOTP.new(@setup["setup_key"]).now},as: :json
    assert_response :unauthorized
  end
  test "tenant identities require their own factor and never acquire platform permissions" do
    tenant_user=TenantAccess::User.create!(email:"tenant-factor-#{SecureRandom.hex(8)}@example.invalid",password:@password)
    enroll("tenant_user",tenant_user)
    get "/api/v1/my_workspaces"
    assert_response :success
    get "/api/v1/tenants"
    assert_response :unauthorized
    assert tenant_user.reload.totp_secret_ciphertext.present?
  end
  test "pre-existing password sessions cannot bypass newly required two factor" do
    Rails.application.config.x.account_security.enforce=false
    get "/api/v1/session/csrf"
    post "/api/v1/session",params:{administrator:{email:@account.email,password:@password}},as: :json,headers:{"X-CSRF-Token"=>response.parsed_body["csrf_token"]}
    assert_response :success
    Rails.application.config.x.account_security.enforce=true
    get "/api/v1/session"
    assert_response :unauthorized
    get "/api/v1/tenants"
    assert_response :unauthorized
  end
  test "factor verification rejects missing CSRF and accepts the current token" do
    previous=ApplicationController.allow_forgery_protection
    ApplicationController.allow_forgery_protection=true
    password_login
    code=ROTP::TOTP.new(@setup["setup_key"]).now
    post "/api/v1/factor",params:{code:code},as: :json
    assert_response :unprocessable_entity
    assert_nil @account.reload.totp_secret_ciphertext
    post "/api/v1/factor",params:{code:code},as: :json,headers:{"X-CSRF-Token"=>@csrf}
    assert_response :success
  ensure
    ApplicationController.allow_forgery_protection=previous
  end

  test "Microsoft identities never link by email and linked sign in still requires local two factor" do
    env=%w[MICROSOFT_TENANT_ID MICROSOFT_CLIENT_ID MICROSOFT_CLIENT_SECRET MICROSOFT_REDIRECT_URI].to_h{|key|[key,ENV[key]]}
    ENV["MICROSOFT_TENANT_ID"]="11111111-1111-1111-1111-111111111111"
    ENV["MICROSOFT_CLIENT_ID"]="22222222-2222-2222-2222-222222222222"
    ENV["MICROSOFT_CLIENT_SECRET"]=SecureRandom.base64(24)
    ENV["MICROSOFT_REDIRECT_URI"]="https://cpq.example.invalid/api/v1/microsoft/callback"
    key=OpenSSL::PKey::RSA.new(2048);jwk=JWT::JWK.new(key)
    callback=lambda do
      query=URI.decode_www_form(URI(response.parsed_body.fetch("authorization_url")).query).to_h
      claims={"iss"=>Platform::MicrosoftIdentity.issuer,"aud"=>ENV["MICROSOFT_CLIENT_ID"],"tid"=>ENV["MICROSOFT_TENANT_ID"],"sub"=>"synthetic-linked-subject","preferred_username"=>@account.email,"nonce"=>query["nonce"],"iat"=>Time.current.to_i,"nbf"=>1.minute.ago.to_i,"exp"=>10.minutes.from_now.to_i}
      token=JWT.encode(claims,key,"RS256",kid:jwk.kid)
      Platform::MicrosoftIdentity.stub(:exchange,token) do
        Platform::MicrosoftIdentity.stub(:keys,{keys:[jwk.export]}) do
          get "/api/v1/microsoft/callback",params:{state:query["state"],code:"synthetic-provider-authorization-code"}
        end
      end
    end
    post "/api/v1/microsoft/start",params:{account_scope:"administrator"},as: :json
    assert_response :success
    assert_no_difference "Platform::ExternalIdentity.count" do
      callback.call
    end
    assert_redirected_to "/security/identity-error"
    get "/api/v1/tenants"
    assert_response :unauthorized
    enroll
    post "/api/v1/microsoft/link",params:{password:"incorrect"},as: :json
    assert_response :unauthorized
    post "/api/v1/microsoft/link",params:{password:@password},as: :json
    assert_response :success
    callback.call
    assert_redirected_to "/security/account?linked=1"
    assert_equal @account.id,Platform::ExternalIdentity.find_by!(subject:"synthetic-linked-subject").account_id
    post "/api/v1/microsoft/start",params:{account_scope:"administrator"},as: :json
    assert_response :success
    callback.call
    assert_redirected_to "/security/verify"
    get "/api/v1/tenants"
    assert_response :unauthorized
    post "/api/v1/factor",params:{code:@codes.first},as: :json
    assert_response :success
    get "/api/v1/tenants"
    assert_response :success
  ensure
    env&.each{|name,value|value.nil? ? ENV.delete(name) : ENV[name]=value}
  end

end

class MicrosoftIdentityVerificationTest < ActiveSupport::TestCase
  setup do
    @env=%w[MICROSOFT_TENANT_ID MICROSOFT_CLIENT_ID MICROSOFT_CLIENT_SECRET MICROSOFT_REDIRECT_URI].to_h{|key|[key,ENV[key]]}
    ENV["MICROSOFT_TENANT_ID"]="11111111-1111-1111-1111-111111111111"
    ENV["MICROSOFT_CLIENT_ID"]="22222222-2222-2222-2222-222222222222"
    ENV["MICROSOFT_CLIENT_SECRET"]=SecureRandom.base64(24)
    ENV["MICROSOFT_REDIRECT_URI"]="https://cpq.example.invalid/api/v1/microsoft/callback"
    @key=OpenSSL::PKey::RSA.new(2048)
    @jwk=JWT::JWK.new(@key)
    @claims={"iss"=>Platform::MicrosoftIdentity.issuer,"aud"=>ENV["MICROSOFT_CLIENT_ID"],"tid"=>ENV["MICROSOFT_TENANT_ID"],"sub"=>"synthetic-provider-subject","nonce"=>"synthetic-nonce","iat"=>Time.current.to_i,"nbf"=>1.minute.ago.to_i,"exp"=>10.minutes.from_now.to_i}
  end
  teardown { @env.each{|key,value|value.nil? ? ENV.delete(key) : ENV[key]=value} }
  def signed(changes={}) = JWT.encode(@claims.merge(changes),@key,"RS256",kid:@jwk.kid)
  def verify(token,nonce="synthetic-nonce")
    Platform::MicrosoftIdentity.stub(:keys,{keys:[@jwk.export]}) {Platform::MicrosoftIdentity.verify(token,nonce)}
  end
  test "configured organizational signatures verify without trusting email or browser tenant input" do
    assert Platform::MicrosoftIdentity.configured?
    assert_equal @claims["sub"],verify(signed)["sub"]
    flow,url=Platform::MicrosoftIdentity.start!(scope:"administrator")
    query=URI.decode_www_form(URI(url).query).to_h
    assert_equal "S256",query["code_challenge_method"]
    assert_equal Base64.urlsafe_encode64(Digest::SHA256.digest(flow["verifier"]),padding:false),query["code_challenge"]
    assert_equal flow["state"],query["state"]
    assert_not url.include?(ENV["MICROSOFT_CLIENT_SECRET"])
  end
  test "wrong signature algorithm issuer audience nonce tenant and expired tokens are rejected" do
    [{"iss"=>"https://untrusted.example.invalid"},{"aud"=>"another-client"},{"tid"=>"another-tenant"},{"nonce"=>"another-nonce"},{"exp"=>1.minute.ago.to_i}].each do |changes|
      assert_raises(TenantManagement::Error){verify(signed(changes))}
    end
    assert_raises(TenantManagement::Error){verify(JWT.encode(@claims,nil,"none"))}
    other=OpenSSL::PKey::RSA.new(2048)
    assert_raises(TenantManagement::Error){verify(JWT.encode(@claims,other,"RS256",kid:@jwk.kid))}
  end
  test "wrong state and expired flows fail before exchanging an authorization code" do
    flow,=Platform::MicrosoftIdentity.start!(scope:"tenant_user")
    called=false
    Platform::MicrosoftIdentity.stub(:exchange,->(*){called=true;raise "must not exchange"}) do
      assert_raises(TenantManagement::Error){Platform::MicrosoftIdentity.consume!(flow,"wrong-state","code")}
      flow["started"]=11.minutes.ago.to_i
      assert_raises(TenantManagement::Error){Platform::MicrosoftIdentity.consume!(flow,flow["state"],"code")}
    end
    assert_not called
  end
  test "missing provider configuration is unavailable rather than simulated" do
    ENV.delete("MICROSOFT_CLIENT_SECRET")
    assert_not Platform::MicrosoftIdentity.configured?
    assert_raises(TenantManagement::Error){Platform::MicrosoftIdentity.start!(scope:"administrator")}
  end
end


class FactorConcurrencyTest < ActiveSupport::TestCase
  self.use_transactional_tests=false
  test "two simultaneous requests cannot consume the same authenticator code" do
    password=SecureRandom.base64(24)
    secret=ROTP::Base32.random_base32
    account=Platform::Administrator.create!(email:"factor-race-#{SecureRandom.hex(8)}@example.invalid",password:password,role:"admin",totp_secret_ciphertext:Platform::AccountSecurity.encryptor.encrypt_and_sign(secret))
    ready=Queue.new;start=Queue.new;results=Queue.new
    code=ROTP::TOTP.new(secret).now
    workers=2.times.map do
      Thread.new do
        ActiveRecord::Base.connection_pool.with_connection do
          actor=Platform::Administrator.find(account.id)
          ready << true;start.pop
          results << Platform::AccountSecurity.confirm!(actor,{},code)[:valid]
        end
      end
    end
    2.times{ready.pop};2.times{start<<true};workers.each(&:join)
    assert_equal 1,2.times.map{results.pop}.count(true)
    assert_equal 1,Platform::AccountEvent.where(subject_id:account.id,action:"two_factor_verified").count
  ensure
    workers&.each{|worker|worker.kill if worker.alive?}
    Platform::AccountEvent.where(subject_id:account.id).delete_all if account
    Platform::Administrator.where(id:account.id).delete_all if account
  end
end
