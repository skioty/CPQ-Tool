class InvitationMailer < ApplicationMailer
  def tenant_invitation(record, token)
    base = (ENV["APP_PUBLIC_URL"].presence || "http://localhost:4200").delete_suffix("/")
    url = "#{base}/invitations/accept#token=#{token}"
    company = TenantManagement::Tenant.find(record.tenant_id).company_name
    mail(to: record.email, from: ENV["MAIL_FROM"].presence || "cpq@example.invalid",
      subject: "Your Tenant Admin invitation") do |format|
      format.text { render plain: "You are invited as Tenant Admin for #{company}.\n\nAccept your invitation: #{url}\n\nThis single-use link expires at #{record.expires_at.utc.iso8601}. If you did not expect this invitation, ignore it. Never share this link publicly." }
    end
  end
end
