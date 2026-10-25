module Platform
  class InvitationMailer < ActionMailer::Base
    def invitation(record, token)
      base = (ENV["APP_PUBLIC_URL"].presence || (Rails.env.test? ? "http://localhost:4200" : "")).delete_suffix("/")
      link = "#{base}/invitations/accept#token=#{token}"
      purpose = record.kind == "staff" ? "activate your CPQ Admin account" : "accept Tenant Admin access"
      mail(to: record.email, from: (ENV["SMTP_FROM"].presence || (Rails.env.test? ? "noreply@example.invalid" : nil)), subject: "Your SELISE CPQ invitation",
        content_type: "text/plain", body: "You have been invited to #{purpose}.\n\n#{link}\n\nThis single-use link expires in 72 hours. Existing tenant users must use their existing password. Tenant workspace access requires an Active tenant. If you did not expect this invitation, do not use it.")
    end
  end
end
