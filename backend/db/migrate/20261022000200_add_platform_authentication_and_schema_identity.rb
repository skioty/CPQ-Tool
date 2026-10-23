class AddPlatformAuthenticationAndSchemaIdentity < ActiveRecord::Migration[8.1]
  def up
    create_table "public.platform_administrators", id: :uuid do |t|
      t.string :email, null: false
      t.string :encrypted_password, null: false
      t.string :role, null: false
      t.boolean :enabled, null: false, default: true
      t.timestamps
    end
    add_index "public.platform_administrators", "lower(email)", unique: true, name: "unique_platform_administrator_email"
    add_check_constraint "public.platform_administrators", "role IN ('super_admin', 'admin')", name: "platform_administrator_role"
    add_column "public.platform_tenants", :schema_key, :string
    execute "UPDATE public.platform_tenants SET schema_key = 'cpq_t_' || replace(gen_random_uuid()::text, '-', '')"
    change_column_default "public.platform_tenants", :schema_key, -> { "'cpq_t_' || replace(gen_random_uuid()::text, '-', '')" }
    change_column_null "public.platform_tenants", :schema_key, false
    add_index "public.platform_tenants", :schema_key, unique: true
    add_check_constraint "public.platform_tenants", "schema_key ~ '^cpq_t_[0-9a-f]{32}$'", name: "platform_schema_key_format"
    # Existing assignment IDs must be reconciled by Member 2 before this FK can apply.
    # Identity uses UUID textual IDs to match the existing string assignment column.
    execute <<~SQL
      ALTER TABLE public.platform_administrators ADD CONSTRAINT administrator_id_text_unique UNIQUE (id);
      CREATE FUNCTION public.immutable_platform_schema_key() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN
        IF NEW.schema_key IS DISTINCT FROM OLD.schema_key THEN
          RAISE EXCEPTION 'Schema identity is immutable' USING ERRCODE = '23514';
        END IF;
        RETURN NEW;
      END;
      $$;
      CREATE TRIGGER immutable_platform_schema_key BEFORE UPDATE ON public.platform_tenants
      FOR EACH ROW EXECUTE FUNCTION public.immutable_platform_schema_key();
    SQL
    create_table "public.platform_provisioning_failures", id: :uuid do |t|
      t.uuid :tenant_id, null: false
      t.string :request_id, null: false
      t.string :error_code, null: false
      t.datetime :created_at, null: false
    end
    # Intentionally no tenant FK: failed atomic creation has no remaining registry row.
  end

  def down
    drop_table "public.platform_provisioning_failures"
    execute "DROP TRIGGER immutable_platform_schema_key ON public.platform_tenants"
    execute "DROP FUNCTION public.immutable_platform_schema_key()"
    remove_column "public.platform_tenants", :schema_key
    drop_table "public.platform_administrators"
  end
end
