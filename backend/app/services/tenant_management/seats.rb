module TenantManagement
  # Every capacity-changing operation locks the same platform tenant row.
  class Seats
    def self.emails(tenant)
      active = TenantAccess::Membership.joins(:user).where(tenant_id:tenant.id, enabled:true,
        "public.tenant_access_users"=>{enabled:true}).pluck("public.tenant_access_users.email")
      pending = Platform::Invitation.where(tenant_id:tenant.id,kind:"tenant",accepted_at:nil,revoked_at:nil,delivery_status:"sent")
        .where("expires_at > ?",Time.current).pluck(:email)
      primary = tenant.contacts.where(primary:true).pluck(:email)
      (active + pending + primary).map { |e| e.to_s.strip.downcase }.reject(&:blank?).uniq
    end
    def self.ensure_room!(tenant, email)
      occupied = emails(tenant)
      return if occupied.include?(email.to_s.strip.downcase)
      if tenant.user_limit.nil? || occupied.length >= tenant.user_limit
        raise Error.new("seat_limit_exceeded","The tenant user limit is full. Increase the limit before inviting or enabling another user.",status:409)
      end
    end
    def self.validate!(tenant)
      count = emails(tenant).length
      if tenant.user_limit && count > tenant.user_limit
        raise Error.new("validation_failed","Review the highlighted fields",fields:{user_limit:["Cannot be less than #{count} occupied seats"]})
      end
    end
  end
end
