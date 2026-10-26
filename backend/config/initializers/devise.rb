Devise.setup do |config|
  require "devise/orm/active_record"
  config.parent_controller = "ApplicationController"
  config.navigational_formats = []
  config.skip_session_storage = [:http_auth, :params_auth]
  config.sign_out_via = :delete
  config.timeout_in = 30.minutes
  config.password_length = 12..128
  config.stretches = Rails.env.test? ? 1 : 12
  config.paranoid = true
  config.case_insensitive_keys = [:email]
  config.strip_whitespace_keys = [:email]
end
