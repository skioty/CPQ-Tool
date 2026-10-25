# Raw activation links must not be written into mailer debug logs.
Rails.application.config.action_mailer.logger = nil
unless Rails.env.test?
  Rails.application.config.action_mailer.delivery_method = :smtp
  Rails.application.config.action_mailer.raise_delivery_errors = true
  Rails.application.config.action_mailer.smtp_settings = {
    address: ENV["SMTP_ADDRESS"], port: ENV.fetch("SMTP_PORT", "587").to_i,
    domain: ENV["SMTP_DOMAIN"], user_name: ENV["SMTP_USERNAME"], password: ENV["SMTP_PASSWORD"],
    authentication: ENV["SMTP_USERNAME"].present? ? ENV.fetch("SMTP_AUTHENTICATION", "plain").to_sym : nil,
    enable_starttls_auto: ENV.fetch("SMTP_TLS_MODE", "starttls") == "starttls",
    ssl: ENV["SMTP_TLS_MODE"] == "tls", open_timeout: 10, read_timeout: 10
  }.compact
end
