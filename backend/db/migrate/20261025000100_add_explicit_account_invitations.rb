class AddExplicitAccountInvitations < ActiveRecord::Migration[8.1]
  def change
    add_column "public.platform_administrators", :name, :string
    add_column "public.platform_administrators", :activated_at, :datetime
    reversible { |dir| dir.up { execute "UPDATE public.platform_administrators SET activated_at = created_at" } }
    create_table "public.tenant_access_users", id: :uuid do |t|
      t.string :email, null: false
      t.string :encrypted_password, null: false
      t.boolean :enabled, null: false, default: true
      t.timestamps
    end
    add_index "public.tenant_access_users", "lower(email)", unique: true, name: "unique_tenant_access_email"
    create_table "public.tenant_access_memberships", id: :uuid do |t|
      t.uuid :user_id, null: false
      t.uuid :tenant_id, null: false
      t.string :role, null: false, default: "tenant_admin"
      t.boolean :enabled, null: false, default: true
      t.timestamps
    end
    add_foreign_key "public.tenant_access_memberships", "public.tenant_access_users", column: :user_id
    add_foreign_key "public.tenant_access_memberships", "public.platform_tenants", column: :tenant_id
    add_index "public.tenant_access_memberships", [:user_id, :tenant_id], unique: true, name: "unique_tenant_access_membership"
    add_check_constraint "public.tenant_access_memberships", "role = 'tenant_admin'", name: "tenant_membership_role"
    create_table "public.platform_invitations", id: :uuid do |t|
      t.string :kind, null: false
      t.string :email, null: false
      t.string :token_digest, null: false
      t.uuid :tenant_id
      t.uuid :administrator_id
      t.uuid :invited_by_id, null: false
      t.string :delivery_status, null: false, default: "pending"
      t.datetime :expires_at, null: false
      t.datetime :accepted_at
      t.datetime :revoked_at
      t.timestamps
    end
    add_index "public.platform_invitations", :token_digest, unique: true
    add_index "public.platform_invitations", [:tenant_id, :email]
    add_foreign_key "public.platform_invitations", "public.platform_tenants", column: :tenant_id
    add_foreign_key "public.platform_invitations", "public.platform_administrators", column: :administrator_id
    add_foreign_key "public.platform_invitations", "public.platform_administrators", column: :invited_by_id
    add_check_constraint "public.platform_invitations", "(kind = 'staff' AND administrator_id IS NOT NULL AND tenant_id IS NULL) OR (kind = 'tenant' AND tenant_id IS NOT NULL AND administrator_id IS NULL)", name: "invitation_target_kind"
    add_check_constraint "public.platform_invitations", "delivery_status IN ('pending','sent','failed')", name: "invitation_delivery_status"
    create_table "public.platform_account_events", id: :uuid do |t|
      t.string :actor_id, null: false
      t.string :subject_id, null: false
      t.string :action, null: false
      t.datetime :created_at, null: false
    end
  end
end
