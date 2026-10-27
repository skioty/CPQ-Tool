# Never log message bodies: invitation fragments contain bearer credentials.
Rails.application.config.action_mailer.logger = nil
Rails.application.config.after_initialize { ActionMailer::Base.logger = nil }
Rails.application.config.action_mailer.raise_delivery_errors = true
Rails.application.config.action_mailer.delivery_method = :smtp unless Rails.env.test?
Rails.application.config.action_mailer.smtp_settings = {
  address: ENV["SMTP_ADDRESS"], port: ENV.fetch("SMTP_PORT", "587").to_i,
  user_name: ENV["SMTP_USERNAME"], password: ENV["SMTP_PASSWORD"],
  authentication: ENV.fetch("SMTP_AUTHENTICATION", "plain").to_sym,
  enable_starttls_auto: true, open_timeout: 10, read_timeout: 10
}.compact unless Rails.env.test?
