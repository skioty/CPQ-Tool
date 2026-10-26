class AddAccountSecurity < ActiveRecord::Migration[8.1]
  def change
    %w[public.platform_administrators public.tenant_access_users].each do |table|
      add_column table, :totp_secret_ciphertext, :text
      add_column table, :totp_last_used_at, :bigint
      add_column table, :totp_failed_attempts, :integer, null: false, default: 0
      add_column table, :totp_locked_until, :datetime
      add_column table, :recovery_code_digests, :jsonb, null: false, default: []
    end
    create_table "public.platform_external_identities", id: :uuid do |t|
      t.string :issuer, null: false
      t.string :subject, null: false
      t.string :account_scope, null: false
      t.uuid :account_id, null: false
      t.datetime :created_at, null: false
    end
    add_index "public.platform_external_identities", [:issuer,:subject], unique: true, name: "unique_platform_external_subject"
    add_index "public.platform_external_identities", [:account_scope,:account_id], unique: true, name: "unique_platform_account_external_identity"
    add_check_constraint "public.platform_external_identities", "account_scope IN ('administrator','tenant_user')", name: "external_identity_scope"
  end
end
