class AddTenantCapacityAndContactRole < ActiveRecord::Migration[8.1]
  def up
    add_column "public.platform_tenants", :user_limit, :integer
    add_column "public.platform_tenants", :primary_contact_role, :string, default:"tenant_admin", null:false
    execute <<~SQL
      UPDATE public.platform_tenants t SET user_limit = GREATEST(1, (
        SELECT COUNT(DISTINCT lower(btrim(email))) FROM (
          SELECT c.email FROM public.platform_tenant_contacts c WHERE c.tenant_id=t.id AND c.primary=true
          UNION ALL SELECT u.email FROM public.tenant_access_memberships m JOIN public.tenant_access_users u ON u.id=m.user_id WHERE m.tenant_id=t.id AND m.enabled AND u.enabled
          UNION ALL SELECT i.email FROM public.platform_invitations i WHERE i.tenant_id=t.id AND i.kind='tenant' AND i.accepted_at IS NULL AND i.revoked_at IS NULL AND i.expires_at > CURRENT_TIMESTAMP AND i.delivery_status='sent'
        ) occupied
      ))
    SQL
    # Flush the existing deferred primary-contact triggers before table DDL.
    execute "SET CONSTRAINTS ALL IMMEDIATE"
    change_column_null "public.platform_tenants", :user_limit, false
    add_check_constraint "public.platform_tenants", "user_limit > 0",name:"positive_tenant_user_limit"
    add_check_constraint "public.platform_tenants", "primary_contact_role = 'tenant_admin'",name:"tenant_primary_contact_role"
    add_index "public.platform_reference_options", "lower(btrim(label))", unique:true, where:"kind = 'industry'", name:"unique_industry_name"
    {"raw_materials"=>"Raw Materials","services"=>"Services","manufacturing"=>"Manufacturing"}.each do |code,label|
      execute "INSERT INTO public.platform_reference_options (id,kind,code,label,enabled,created_at,updated_at) SELECT gen_random_uuid(),'industry',#{quote(code)},#{quote(label)},true,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP WHERE NOT EXISTS (SELECT 1 FROM public.platform_reference_options WHERE kind='industry' AND (code=#{quote(code)} OR lower(btrim(label))=lower(#{quote(label)})))"
    end
  end
  def down
    remove_index "public.platform_reference_options",name:"unique_industry_name"
    remove_column "public.platform_tenants",:primary_contact_role
    remove_column "public.platform_tenants",:user_limit
  end
end
