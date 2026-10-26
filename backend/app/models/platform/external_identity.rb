module Platform
  class ExternalIdentity < ApplicationRecord
    self.table_name = "public.platform_external_identities"
    def account
      (account_scope == "administrator" ? Administrator : TenantAccess::User).find(account_id)
    end
  end
end
