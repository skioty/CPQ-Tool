module Platform
  class AccountEvent < ApplicationRecord
    self.table_name = "public.platform_account_events"
    def readonly? = persisted?
  end
end
