class CreateIsolationMarkers < ActiveRecord::Migration[8.1]
  def change
    create_table :isolation_markers, id: :uuid do |t|
      t.string :value, null: false
    end
  end
end
