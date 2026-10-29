require "digest"
module Platform
  class Invitations
    def self.issue!(actor:, kind:, email:, tenant: nil, administrator: nil, replace: true)
      normalized = email.to_s.strip.downcase
      raise TenantManagement::Error.new("validation_failed", "Enter a valid email address", fields: {email: ["Enter a valid email address"]}) unless normalized.match?(URI::MailTo::EMAIL_REGEXP)
      if tenant
        Access.new.authorize!(actor, :read, tenant)
        user = TenantAccess::User.find_by("lower(email) = ?", normalized)
        if user && TenantAccess::Membership.exists?(user_id: user.id, tenant_id: tenant.id, enabled: true)
          raise TenantManagement::Error.new("conflict", "This account already has access to the tenant", status: 409)
        end
      end
      token = SecureRandom.urlsafe_base64(32)
      record = nil
      Invitation.transaction do
        # Serialize issuance for the same target; a resend revokes prior unused links.
        target = tenant || administrator
        target.lock!
        Access.new.authorize!(actor, :read, tenant) if tenant
        if tenant && (tenant.lifecycle_status != "active" || tenant.provisioning_status != "ready")
          # Existing setup flow permits invitations for Inactive tenants, but not
          # suspended/archived or failed provisioning. Access still requires Active.
          unless tenant.lifecycle_status == "inactive" && tenant.provisioning_status == "ready"
            raise TenantManagement::Error.new("tenant_unavailable", "Invitations require an Active or Inactive, ready tenant", status: 409)
          end
        end
        if tenant && (user = TenantAccess::User.find_by("lower(email) = ?", normalized)) && TenantAccess::Membership.exists?(user_id:user.id,tenant_id:tenant.id,enabled:true)
          raise TenantManagement::Error.new("conflict", "This account already has access to the tenant", status:409)
        end
        TenantManagement::Seats.ensure_room!(tenant,normalized) if tenant
        scope = Invitation.where(kind: kind, email: normalized, tenant_id: tenant&.id, administrator_id: administrator&.id, accepted_at: nil, revoked_at: nil)
        if !replace && scope.where("expires_at > ?", Time.current).exists?
          raise TenantManagement::Error.new("conflict", "A pending invitation already exists. Use resend to replace its link.", status:409)
        end
        scope.update_all(revoked_at: Time.current)
        record = Invitation.create!(kind: kind, email: normalized, tenant_id: tenant&.id, administrator_id: administrator&.id,
          invited_by_id: actor.id, token_digest: Digest::SHA256.hexdigest(token), expires_at: 72.hours.from_now,
          delivery_status: "sent")
        if tenant
          tenant.audit_events.create!(actor_id: actor.id, action: "tenant_user_invited", request_id: SecureRandom.uuid,
            changed_fields: [], created_at: Time.current)
        end
      end
      # Keep the existing database enum for compatibility: 'sent' means issued.
      # Only the issuing administrator receives this token, once. No mail or stored raw link.
      record.issued_token = token
      record
    end
    def self.find_token!(token)
      raise TenantManagement::Error.new("invalid_invitation", "This invitation is invalid, expired or already used. Request a new invitation.", status: 410) unless token.is_a?(String) && token.length.between?(32, 128)
      record = Invitation.find_by(token_digest: Digest::SHA256.hexdigest(token))
      if record && !record.usable?
        reason = record.accepted_at ? "already_used" : record.revoked_at ? "revoked" : record.expires_at <= Time.current ? "expired" : "unavailable"
        raise TenantManagement::Error.new("invitation_#{reason}", "This invitation is #{reason.tr('_',' ')}. Request a replacement invitation if needed.", status:410)
      end
      raise TenantManagement::Error.new("invalid_invitation", "This invitation is invalid. Request a new invitation.", status: 410) unless record
      record
    end
    def self.validate_new_password!(password, confirmation)
      unless password.length.between?(12,128) && password == confirmation
        raise TenantManagement::Error.new("validation_failed", "Use matching passwords with 12–128 characters", fields: {password: ["Use matching passwords with 12–128 characters"]})
      end
    end
    private_class_method :validate_new_password!
    def self.accept!(token:, password:, confirmation:, name: nil, authenticated_user: nil)
      unless password.is_a?(String) && (confirmation.nil? || confirmation.is_a?(String))
        raise TenantManagement::Error.new("validation_failed", "Enter a valid password")
      end
      record = find_token!(token)
      result = nil
      acceptor_id = nil
      Invitation.transaction do
        tenant = record.tenant_id && TenantManagement::Tenant.lock.find(record.tenant_id)
        record.lock!
        unless record.usable?
          reason = record.accepted_at ? "already_used" : record.revoked_at ? "revoked" : "expired"
          raise TenantManagement::Error.new("invitation_#{reason}", "This invitation is #{reason.tr('_',' ')}", status:410)
        end
        if record.kind == "staff"
          account = Administrator.lock.find(record.administrator_id)
          raise TenantManagement::Error.new("conflict", "This account has already been activated", status: 409) if account.activated_at || account.role != "admin"
          validate_new_password!(password, confirmation)
          account.update!(password: password, password_confirmation: confirmation, enabled: true, activated_at: Time.current)
          result = "staff"
          acceptor_id = account.id
        else
          unless %w[active inactive].include?(tenant.lifecycle_status) && tenant.provisioning_status == "ready"
            raise TenantManagement::Error.new("tenant_unavailable", "This tenant cannot accept invitations now", status:409)
          end
          TenantManagement::Seats.ensure_room!(tenant,record.email)
          user = TenantAccess::User.find_by("lower(email) = ?", record.email)
          if user
            if AccountSecurity.enforced? && (!authenticated_user || authenticated_user.id != user.id)
              raise TenantManagement::Error.new("sign_in_required", "Sign in with the invited email and verify MFA before accepting this invitation", status:401)
            end
            unless user.enabled? && user.valid_password?(password.to_s)
              raise TenantManagement::Error.new("invalid_credentials", "Use your existing tenant account password", status: 401)
            end
          else
            validate_new_password!(password, confirmation)
            if name.to_s.strip.blank? || name.to_s.strip.length > 120
              raise TenantManagement::Error.new("validation_failed", "Enter your name", fields:{name:["Enter your name"]})
            end
            user = TenantAccess::User.create!(email: record.email, name:name.to_s.strip.presence, password: password, password_confirmation: confirmation)
          end
          member = TenantAccess::Membership.find_or_initialize_by(user_id: user.id, tenant_id: record.tenant_id)
          if member.persisted? && member.role != "tenant_admin"
            raise TenantManagement::Error.new("conflict", "An existing membership requires administrator review",status:409)
          end
          member.update!(role: "tenant_admin", enabled: true)
          tenant = TenantManagement::Tenant.find(record.tenant_id)
          tenant.audit_events.create!(actor_id: user.id, action: "tenant_invitation_accepted", request_id: SecureRandom.uuid, changed_fields: [], created_at: Time.current)
          result = "tenant"
          acceptor_id = user.id
        end
        record.update!(accepted_at: Time.current)
        AccountEvent.create!(actor_id: acceptor_id, subject_id: record.id, action: "invitation_accepted", created_at: Time.current)
      end
      result
    end
  end
end
