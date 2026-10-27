# Legacy domain fixtures exercise password sessions. Dedicated account-security tests enable and prove the mandatory second factor.
Rails.application.config.x.account_security.enforce = !Rails.env.test?
Rails.application.config.filter_parameters += [:code, :recovery_code, :setup_key, :totp_secret, :client_secret, :review_note]
