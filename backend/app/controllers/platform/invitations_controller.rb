module Platform
  class InvitationsController < ManagementController
    def index
      tenant = tenant!
      members = TenantAccess::Membership.includes(:user).where(tenant_id: tenant.id).map { |member| {id: member.id, email: member.user.email, role: member.role, enabled: member.enabled && member.user.enabled} }
      render json: {data: Invitation.where(tenant_id: tenant.id).order(created_at: :desc).limit(100).map(&:summary), members: members, invitation_delivery: "manual_link",
        user_limit:tenant.user_limit,occupied_seats:TenantManagement::Seats.emails(tenant).length,
        primary_contact:tenant.contacts.find_by(primary:true)&.attributes&.slice("email","name"),primary_contact_role:tenant.primary_contact_role}
    end
    def create
      tenant = tenant!
      record = Invitations.issue!(actor: @actor, kind: "tenant", email: params.require(:email), tenant: tenant)
      render json: {data: record.summary, invitation_token: record.issued_token}, status: 201
    end
    def resend
      record = authorized_invitation!
      if record.accepted_at
        raise TenantManagement::Error.new("conflict", "An accepted invitation cannot be resent", status: 409)
      end
      account = record.administrator_id && Administrator.find(record.administrator_id)
      if account&.activated_at
        raise TenantManagement::Error.new("conflict", "This staff account is already activated", status: 409)
      end
      fresh = Invitations.issue!(actor: @actor, kind: record.kind, email: record.email,
        tenant: record.tenant_id && TenantManagement::Tenant.find(record.tenant_id), administrator: account)
      render json: {data: fresh.summary, invitation_token: fresh.issued_token}
    end
    def revoke
      record = authorized_invitation!
      record.with_lock do
        raise TenantManagement::Error.new("conflict", "Accepted invitations cannot be revoked; account access is separate", status: 409) if record.accepted_at
        record.update!(revoked_at: Time.current)
        account_event!("invitation_revoked", record)
      end
      head :no_content
    end
    private
    def authorized_invitation!
      record = Invitation.find(params[:id])
      if record.kind == "staff"
        super_admin!
      else
        tenant = Access.new.scope(@actor).find(record.tenant_id)
        Access.new.authorize!(@actor, :read, tenant)
      end
      record
    end
  end
end
