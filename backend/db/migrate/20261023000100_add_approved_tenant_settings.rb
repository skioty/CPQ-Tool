class AddApprovedTenantSettings < ActiveRecord::Migration[8.1]
  def change
    add_column "public.platform_tenant_subscriptions", :payment_method_description, :text
    add_column "public.platform_tenant_subscriptions", :first_invoiced_at, :datetime
    add_column "public.platform_tenant_contacts", :phone, :string
    create_table "public.platform_reference_options", id: :uuid do |t|
      t.string :kind, null: false
      t.string :code, null: false
      t.string :label, null: false
      t.boolean :enabled, null: false, default: true
      t.timestamps
    end
    add_index "public.platform_reference_options", [:kind, :code], unique: true
    create_table "public.platform_brand_assets", id: :uuid do |t|
      t.uuid :tenant_id
      t.string :owner_id, null: false
      t.string :kind, null: false
      t.string :content_type, null: false
      t.binary :content, null: false
      t.string :storage_key, null: false
      t.timestamps
    end
    add_foreign_key "public.platform_brand_assets", "public.platform_tenants", column: :tenant_id
  end
end
