class AddTenantMetadataAndRetention < ActiveRecord::Migration[8.1]
  def change
    add_column "public.platform_tenants", :display_name, :string
    add_column "public.platform_tenants", :country, :string
    add_column "public.platform_tenants", :time_zone, :string
    add_column "public.platform_tenants", :archived_at, :datetime
    # Null means unknown, deliberately blocks permanent deletion.
    %i[legal_hold billing_resolved contracts_resolved retention_records_approved].each do |column|
      add_column "public.platform_tenants", column, :boolean
    end
    add_column "public.platform_tenants", :retention_policy_reference, :string
    create_table "public.platform_tenant_retention_events", id: :uuid do |t|
      t.uuid :tenant_id, null: false
      t.string :actor_id, null: false
      t.string :action, null: false
      t.jsonb :details, null: false, default: {}
      t.datetime :created_at, null: false
    end
    add_index "public.platform_tenant_retention_events", :tenant_id
    # No FK: minimal retention/deletion evidence must survive deletion of the registry.
  end
end
