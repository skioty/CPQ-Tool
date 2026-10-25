module Platform
  class Invitation < ApplicationRecord
    self.table_name = "public.platform_invitations"
    def state
      return "revoked" if revoked_at
      return "accepted" if accepted_at
      return "expired" if expires_at <= Time.current
      delivery_status == "sent" ? "pending acceptance" : "delivery #{delivery_status}"
    end
    def usable? = accepted_at.nil? && revoked_at.nil? && expires_at > Time.current && delivery_status == "sent"
    def summary = { id: id, kind: kind, email: email, expires_at: expires_at, state: state, delivery_status: delivery_status }
  end
end
