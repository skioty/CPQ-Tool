module Platform
  class InvitationDelivery
    def self.configured?
      Rails.env.test? || (ENV["SMTP_ADDRESS"].present? && ENV["MAIL_FROM"].present? && ENV["APP_PUBLIC_URL"].present?)
    end
    def self.send!(record)
      # Synchronous delivery avoids placing raw tokens in job payloads or storage.
      # A retry issues a new token and invalidates the previous invitation.
      unless configured?
        record.update!(email_delivery_status: "unconfigured")
        AccountEvent.create!(actor_id: record.invited_by_id, subject_id: record.id, action: "invitation_email_unconfigured", created_at:Time.current)
        return
      end
      record.update!(email_delivery_status: "sending")
      begin
        InvitationMailer.tenant_invitation(record, record.issued_token).deliver_now
        record.update!(email_delivery_status: "sent")
      rescue StandardError
        record.update!(email_delivery_status: "failed")
        # Do not log SMTP exceptions, addresses, message bodies or tokens.
      end
      AccountEvent.create!(actor_id: record.invited_by_id, subject_id: record.id,
        action: "invitation_email_#{record.email_delivery_status}", created_at: Time.current)
    end
  end
end
