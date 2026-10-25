module Platform
  class AdministratorsController < ManagementController
    before_action :super_admin!
    def index
      accounts = Administrator.order(:email).map do |account|
        { id: account.id, name: account.name, email: account.email, role: account.role, enabled: account.enabled,
          activated: account.activated_at.present?, assigned_tenants: TenantManagement::Assignment.where(administrator_id: account.id.to_s).count,
          invitation: Invitation.where(administrator_id: account.id).order(created_at: :desc).first&.summary }
      end
      render json: {data: accounts, invitation_delivery: "manual_link"}
    end
    def create
      attributes = params.require(:administrator).permit(:email, :name)
      account = nil
      Administrator.transaction do
        account = Administrator.create!(attributes.merge(role: "admin", enabled: false, password: SecureRandom.base64(32)))
        account_event!("staff_account_created", account)
        @invitation = Invitations.issue!(actor: @actor, kind: "staff", email: account.email, administrator: account)
      end
      render json: {id: account.id, invitation: @invitation.summary, invitation_token: @invitation.issued_token}, status: 201
    end
    def invite
      account = Administrator.find(params[:id])
      unless account.role == "admin" && account.activated_at.nil?
        raise TenantManagement::Error.new("conflict", "Only pending CPQ Admin accounts can receive activation invitations", status: 409)
      end
      record = Invitations.issue!(actor: @actor, kind: "staff", email: account.email, administrator: account)
      render json: {data: record.summary, invitation_token: record.issued_token}
    end
    def update
      account = Administrator.find(params[:id])
      raise TenantManagement::Error.new("forbidden", "Super Admin accounts are managed through controlled provisioning", status: 403) unless account.role == "admin" && account.id != @actor.id
      changes = params.require(:administrator).permit(:name, :enabled).to_h
      if changes.key?("enabled") && ![true, false].include?(changes["enabled"])
        raise TenantManagement::Error.new("validation_failed", "Enabled must be true or false")
      end
      account.with_lock do
        if changes["enabled"] == true && account.activated_at.nil?
          raise TenantManagement::Error.new("conflict", "The account owner must accept the activation invitation first", status: 409)
        end
        if changes["enabled"] == false && TenantManagement::Assignment.exists?(administrator_id: account.id.to_s)
          raise TenantManagement::Error.new("conflict", "Reassign this administrator's tenants before disabling the account", status: 409)
        end
        account.update!(changes)
        account_event!("staff_account_updated", account)
      end
      head :no_content
    end
  end
end
