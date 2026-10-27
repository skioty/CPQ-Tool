class ExtendInvitationDelivery < ActiveRecord::Migration[8.1]
  def change
    add_column "public.platform_invitations", :email_delivery_status, :string, null: false, default: "not_requested"
    add_column "public.platform_invitations", :recipient_name, :string
    add_column "public.tenant_access_users", :name, :string
    add_check_constraint "public.platform_invitations", "email_delivery_status IN ('not_requested','sending','sent','failed','unconfigured')", name: "invitation_email_delivery_status"
  end
end
