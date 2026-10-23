module TenantData
  # Synthetic isolation evidence only. No future CPQ domain is implemented.
  class IsolationMarker < ApplicationRecord
    self.table_name = "isolation_markers"
  end
end
