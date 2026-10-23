# Rails 8.1 PostgreSQL schema-only dumps explicitly recreate public; PostgreSQL
# already creates it in fresh databases. Normalize only that statement, preserving
# all domain tables, functions and constraint triggers for db:prepare/test loading.
require "active_record/tasks/postgresql_database_tasks"
module ReloadablePublicSchemaDump
  def structure_dump(filename, extra_flags)
    super
    text = File.binread(filename)
    File.binwrite(filename, text.sub(/^CREATE SCHEMA public;$/, "CREATE SCHEMA IF NOT EXISTS public;"))
  end
end
ActiveRecord::Tasks::PostgreSQLDatabaseTasks.prepend(ReloadablePublicSchemaDump)
