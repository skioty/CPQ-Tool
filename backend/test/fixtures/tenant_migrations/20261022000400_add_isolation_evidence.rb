# Test-only forward migration for existing-schema upgrade/retry evidence.
class AddIsolationEvidence < ActiveRecord::Migration[8.1]
  def change
    add_column :isolation_markers, :evidence, :string
  end
end
