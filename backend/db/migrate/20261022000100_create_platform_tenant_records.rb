class CreatePlatformTenantRecords < ActiveRecord::Migration[8.1]
  def up
    create_table "public.platform_tenants", id: :uuid do |t|
      t.string :company_name
      t.boolean :company_name_display
      t.text :description
      t.string :industry_id
      t.string :lifecycle_status
      t.string :provisioning_status, null: false, default: "pending"
      t.integer :lock_version, null: false, default: 0
      t.timestamps
    end
    create_table "public.platform_tenant_contacts", id: :uuid do |t|
      t.uuid :tenant_id, null: false
      t.string :name
      t.string :email
      t.boolean :primary, null: false, default: false
      t.timestamps
    end
    create_table "public.platform_tenant_brandings", id: :uuid do |t|
      t.uuid :tenant_id, null: false
      t.string :primary_colour
      t.string :secondary_colour
      t.string :typography
      t.string :logo_attachment_id
      t.string :favicon_attachment_id
      t.timestamps
    end
    create_table "public.platform_tenant_subscriptions", id: :uuid do |t|
      t.uuid :tenant_id, null: false
      t.string :currency
      # Unconstrained PostgreSQL numeric: no guessed currency scale or rounding.
      t.decimal :fee
      t.string :payment_method
      t.string :discount_type
      t.decimal :discount_value
      t.string :discount_duration
      t.timestamps
    end
    create_table "public.platform_tenant_assignments", id: :uuid do |t|
      t.uuid :tenant_id, null: false
      # Opaque Member 3 identity; no competing administrator/user model.
      t.string :administrator_id, null: false
      t.timestamps
    end
    create_table "public.platform_tenant_audit_events", id: :uuid do |t|
      t.uuid :tenant_id, null: false
      t.string :actor_id, null: false
      t.string :action, null: false
      t.string :request_id, null: false
      t.jsonb :changed_fields, null: false, default: []
      t.datetime :created_at, null: false
    end
    %w[contacts brandings subscriptions assignments audit_events].each do |suffix|
      table = "public.platform_tenant_#{suffix}"
      add_foreign_key table, "public.platform_tenants", column: :tenant_id, on_delete: :restrict
      add_index table, :tenant_id, unique: %w[brandings subscriptions].include?(suffix)
    end
    add_index "public.platform_tenant_assignments", [:tenant_id, :administrator_id], unique: true, name: "unique_platform_tenant_admin"
    add_index "public.platform_tenant_contacts", :tenant_id, unique: true, where: '"primary" = true', name: "one_platform_primary_contact"
    add_check_constraint "public.platform_tenants", "provisioning_status IN ('pending', 'ready')", name: "platform_provisioning_status"

    # Parent locks serialize direct contact writers as well as the Rails service.
    execute <<~SQL
      CREATE FUNCTION public.lock_platform_contact_parent() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN
        IF TG_OP <> 'INSERT' THEN
          PERFORM id FROM public.platform_tenants WHERE id = OLD.tenant_id FOR UPDATE;
        END IF;
        IF TG_OP <> 'DELETE' THEN
          IF TG_OP = 'UPDATE' AND NEW.tenant_id <> OLD.tenant_id THEN
            RAISE EXCEPTION 'Contact tenant cannot change' USING ERRCODE = '23514';
          END IF;
          PERFORM id FROM public.platform_tenants WHERE id = NEW.tenant_id FOR UPDATE;
          RETURN NEW;
        END IF;
        RETURN OLD;
      END;
      $$;
      CREATE TRIGGER lock_platform_contact_parent BEFORE INSERT OR UPDATE OR DELETE
        ON public.platform_tenant_contacts FOR EACH ROW EXECUTE FUNCTION public.lock_platform_contact_parent();

      CREATE FUNCTION public.check_platform_primary_contact() RETURNS trigger LANGUAGE plpgsql AS $$
      DECLARE target uuid;
      BEGIN
        IF TG_TABLE_NAME = 'platform_tenants' THEN target := NEW.id;
        ELSIF TG_OP = 'DELETE' THEN target := OLD.tenant_id;
        ELSE target := NEW.tenant_id;
        END IF;
        IF EXISTS (SELECT 1 FROM public.platform_tenants WHERE id = target) AND
          (SELECT count(*) FROM public.platform_tenant_contacts WHERE tenant_id = target AND "primary") <> 1 THEN
          RAISE EXCEPTION 'Exactly one primary contact is required' USING ERRCODE = '23514', CONSTRAINT = 'platform_exactly_one_primary';
        END IF;
        RETURN NULL;
      END;
      $$;
      CREATE CONSTRAINT TRIGGER platform_exactly_one_primary_tenant AFTER INSERT OR UPDATE
        ON public.platform_tenants DEFERRABLE INITIALLY DEFERRED FOR EACH ROW
        EXECUTE FUNCTION public.check_platform_primary_contact();
      CREATE CONSTRAINT TRIGGER platform_exactly_one_primary_contact AFTER INSERT OR UPDATE OR DELETE
        ON public.platform_tenant_contacts DEFERRABLE INITIALLY DEFERRED FOR EACH ROW
        EXECUTE FUNCTION public.check_platform_primary_contact();
    SQL
  end

  def down
    %w[audit_events assignments subscriptions brandings contacts].each { |suffix| drop_table "public.platform_tenant_#{suffix}" }
    drop_table "public.platform_tenants"
    execute "DROP FUNCTION public.check_platform_primary_contact()"
    execute "DROP FUNCTION public.lock_platform_contact_parent()"
  end
end
