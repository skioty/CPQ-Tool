class AddSubscriptionPricing < ActiveRecord::Migration[8.1]
  def change
    add_column "public.platform_tenant_subscriptions", :pricing_mode, :string, null: false, default: "custom"
    add_check_constraint "public.platform_tenant_subscriptions", "pricing_mode IN ('custom','automatic')", name: "subscription_pricing_mode"
    create_table "public.platform_subscription_pricings" do |t|
      t.jsonb :tiers, null: false, default: []
      t.integer :lock_version, null: false, default: 0
      t.timestamps
    end
    reversible do |dir|
      dir.up { execute "INSERT INTO public.platform_subscription_pricings (id,tiers,created_at,updated_at) VALUES (1,'[]',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)" }
    end
    add_check_constraint "public.platform_subscription_pricings", "id = 1", name: "single_subscription_pricing"
  end
end
