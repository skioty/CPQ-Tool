module Platform
  class TenantMigrator
    PATH = Rails.root.join("db/tenant_migrate").to_s

    def self.migrate_current!(paths: PATH)
      raise "Refusing tenant migrations in public" if Apartment::Tenant.current == "public"
      # Schema-qualified migration metadata avoids stale Rails connection memoization.
      connection = ActiveRecord::Base.connection
      schema = Apartment::Tenant.current
      migration_table = "#{connection.quote_table_name(schema)}.tenant_schema_versions"
      connection.execute("CREATE TABLE IF NOT EXISTS #{migration_table} (version bigint PRIMARY KEY)")
      ActiveRecord::MigrationContext.new(paths).migrations.each do |migration|
        next if connection.select_value("SELECT 1 FROM #{migration_table} WHERE version = #{migration.version.to_i}")
        connection.transaction(requires_new: true) do
          migration.migrate(:up)
          connection.execute("INSERT INTO #{migration_table} (version) VALUES (#{migration.version.to_i})")
        end
      end
      true
    end

    def self.current?(paths: PATH)
      connection = ActiveRecord::Base.connection
      table = "#{connection.quote_table_name(Apartment::Tenant.current)}.tenant_schema_versions"
      return false unless connection.data_source_exists?("#{Apartment::Tenant.current}.tenant_schema_versions")
      expected = ActiveRecord::MigrationContext.new(paths).migrations.map(&:version).sort
      connection.select_values("SELECT version FROM #{table} ORDER BY version").map(&:to_i) == expected
    end
  end
end
