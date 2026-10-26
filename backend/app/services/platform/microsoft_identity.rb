require "net/http"
require "digest"
module Platform
  class MicrosoftIdentity
    def self.configured?
      tenant = ENV["MICROSOFT_TENANT_ID"].to_s
      client = ENV["MICROSOFT_CLIENT_ID"].to_s
      uri = URI.parse(ENV["MICROSOFT_REDIRECT_URI"].to_s)
      guid = /\A[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\z/i
      tenant.match?(guid) && client.match?(guid) && ENV["MICROSOFT_CLIENT_SECRET"].present? && uri.host.present? && uri.userinfo.nil? && uri.query.nil? && uri.fragment.nil? &&
        uri.path == "/api/v1/microsoft/callback" && (uri.scheme == "https" || Rails.env.development? && uri.scheme == "http" && %w[localhost 127.0.0.1].include?(uri.host))
    rescue URI::InvalidURIError
      false
    end
    def self.ready!
      raise TenantManagement::Error.new("identity_unavailable","Microsoft sign-in is not configured. Use your password and authenticator.",status:503) unless configured?
    end
    def self.base = "https://login.microsoftonline.com/#{ENV.fetch('MICROSOFT_TENANT_ID')}"
    def self.issuer = "#{base}/v2.0"
    def self.start!(scope:,account_id:nil)
      ready!
      raise TenantManagement::Error.new("validation_failed","Invalid account scope") unless %w[administrator tenant_user].include?(scope)
      data = {"scope"=>scope,"account_id"=>account_id,"state"=>SecureRandom.urlsafe_base64(32),"nonce"=>SecureRandom.urlsafe_base64(32),"verifier"=>SecureRandom.urlsafe_base64(48),"started"=>Time.current.to_i}
      query = {client_id:ENV.fetch("MICROSOFT_CLIENT_ID"),response_type:"code",redirect_uri:ENV.fetch("MICROSOFT_REDIRECT_URI"),response_mode:"query",scope:"openid profile",state:data["state"],nonce:data["nonce"],code_challenge:Base64.urlsafe_encode64(Digest::SHA256.digest(data["verifier"]),padding:false),code_challenge_method:"S256"}
      [data,"#{base}/oauth2/v2.0/authorize?#{URI.encode_www_form(query)}"]
    end
    def self.exchange(code,verifier)
      ready!
      uri = URI("#{base}/oauth2/v2.0/token")
      request = Net::HTTP::Post.new(uri)
      request.set_form_data(client_id:ENV.fetch("MICROSOFT_CLIENT_ID"),client_secret:ENV.fetch("MICROSOFT_CLIENT_SECRET"),code:code,grant_type:"authorization_code",redirect_uri:ENV.fetch("MICROSOFT_REDIRECT_URI"),code_verifier:verifier)
      response = Net::HTTP.start(uri.host,uri.port,use_ssl:true,open_timeout:10,read_timeout:10){|http|http.request(request)}
      raise TenantManagement::Error.new("identity_failed","Microsoft sign-in could not be verified",status:401) unless response.is_a?(Net::HTTPSuccess)
      JSON.parse(response.body).fetch("id_token")
    end
    def self.keys
      uri = URI("#{base}/discovery/v2.0/keys")
      response = Net::HTTP.start(uri.host,uri.port,use_ssl:true,open_timeout:10,read_timeout:10){|http|http.get(uri.request_uri)}
      raise TenantManagement::Error.new("identity_failed","Microsoft signing keys are unavailable",status:503) unless response.is_a?(Net::HTTPSuccess)
      JSON.parse(response.body)
    end
    def self.verify(token,nonce)
      ready!
      payload, = JWT.decode(token,nil,true,algorithms:["RS256"],jwks:keys,iss:issuer,verify_iss:true,aud:ENV.fetch("MICROSOFT_CLIENT_ID"),verify_aud:true,required_claims:%w[exp iat nbf iss aud sub nonce tid])
      valid = payload["tid"] == ENV["MICROSOFT_TENANT_ID"] && payload["sub"].is_a?(String) && payload["sub"].present? &&
        payload["nonce"].is_a?(String) && ActiveSupport::SecurityUtils.secure_compare(payload["nonce"],nonce.to_s) &&
        payload["iat"].is_a?(Numeric) && payload["iat"].between?(10.minutes.ago.to_i,30.seconds.from_now.to_i)
      raise TenantManagement::Error.new("identity_failed","Microsoft identity claims did not match",status:401) unless valid
      payload
    rescue JWT::DecodeError, KeyError, JSON::ParserError
      raise TenantManagement::Error.new("identity_failed","Microsoft sign-in could not be verified",status:401)
    end
    def self.consume!(flow,state,code)
      raise TenantManagement::Error.new("identity_failed","Microsoft sign-in expired. Start again.",status:401) unless flow && Time.current.to_i-flow["started"].to_i < 10.minutes && state.is_a?(String) && ActiveSupport::SecurityUtils.secure_compare(flow["state"],state) && code.is_a?(String) && code.present?
      verify(exchange(code,flow["verifier"]),flow["nonce"])
    end
  end
end
