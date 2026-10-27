module Platform
  class AccountSecurity
    def self.enforced? = Rails.application.config.x.account_security.enforce == true
    def self.encryptor
      ActiveSupport::MessageEncryptor.new(Rails.application.key_generator.generate_key("cpq-account-totp-v1", 32), cipher: "aes-256-gcm")
    end
    def self.secret(account) = account.totp_secret_ciphertext.present? ? encryptor.decrypt_and_verify(account.totp_secret_ciphertext) : nil
    def self.digest(code)
      OpenSSL::HMAC.hexdigest("SHA256", Rails.application.key_generator.generate_key("cpq-recovery-codes-v1",32), code.to_s.delete(" -").downcase)
    end
    def self.begin!(controller, scope, account)
      controller.send(:reset_session)
      pending = {"scope"=>scope, "id"=>account.id, "started"=>Time.current.to_i}
      pending["secret"] = ROTP::Base32.random_base32 unless account.totp_secret_ciphertext.present?
      controller.session[:pending_factor] = pending
      {challenge: true, csrf_token: controller.send(:form_authenticity_token)}
    end
    def self.account(pending)
      klass = {"administrator"=>Administrator, "tenant_user"=>TenantAccess::User}[pending["scope"]]
      raise TenantManagement::Error.new("unauthenticated", "Sign in again to continue", status:401) unless klass && Time.current.to_i-pending["started"].to_i < 10.minutes
      record = klass.find_by(id: pending["id"])
      raise TenantManagement::Error.new("unauthenticated", "Sign in again to continue", status:401) unless record&.active_for_authentication?
      record
    end
    def self.confirm!(account, pending, code)
      recovery_codes = nil
      valid = true
      account.with_lock do
        if account.totp_locked_until && account.totp_locked_until > Time.current
          seconds = (account.totp_locked_until - Time.current).ceil
          raise TenantManagement::Error.new("factor_locked", "Too many attempts. Try again in #{seconds} seconds. If this sign-in expires, cancel and sign in again.",status:429)
        end
        # An elapsed lock starts a new attempt window. Do not immediately relock
        # the account on its first typo after the waiting period.
        if account.totp_locked_until
          account.totp_failed_attempts = 0
          account.totp_locked_until = nil
        end
        enrolling = account.totp_secret_ciphertext.blank?
        key = enrolling ? pending["secret"] : secret(account)
        match = key && ROTP::TOTP.new(key, issuer:"CPQ Console").verify(code.to_s, drift_behind:30, drift_ahead:30, after:account.totp_last_used_at)
        codes = account.recovery_code_digests.dup
        recovery = !enrolling && codes.find { |stored| ActiveSupport::SecurityUtils.secure_compare(stored, digest(code)) }
        unless match || recovery
          attempts = account.totp_failed_attempts + 1
          account.update!(totp_failed_attempts: attempts, totp_locked_until: attempts >= 5 ? 10.minutes.from_now : nil)
          valid = false
          next
        end
        attrs = {totp_failed_attempts:0,totp_locked_until:nil}
        if enrolling
          recovery_codes = Array.new(10) { SecureRandom.hex(8) }
          attrs[:totp_secret_ciphertext] = encryptor.encrypt_and_sign(key)
          attrs[:recovery_code_digests] = recovery_codes.map { |raw| digest(raw) }
        elsif recovery
          codes.delete(recovery)
          attrs[:recovery_code_digests] = codes
        end
        attrs[:totp_last_used_at] = match if match
        account.update!(attrs)
        AccountEvent.create!(actor_id:account.id,subject_id:account.id,action:enrolling ? "two_factor_enrolled" : recovery ? "recovery_code_used" : "two_factor_verified",created_at:Time.current)
      end
      {valid:valid,recovery_codes:recovery_codes}
    end
  end
end
