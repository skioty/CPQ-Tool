# Public structure only; tenant schemas are built from db/tenant_migrate.
ActiveRecord::Tasks::DatabaseTasks.structure_dump_flags = { postgresql: ["--schema=public"] }
