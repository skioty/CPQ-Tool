# Rails API foundation

Member 3 implements Devise cookie/CSRF endpoints and Apartment provisioning/context services on top of Member 2. See [auth/tenancy handoff](../docs/member3-auth-tenancy.md) before migrating or provisioning accounts. No passwords/seeds or public signup. Product validation/lifecycle rules remain gated. Tenant-only migrations use platform:migrate_tenants, not Apartment's global public migration sweep.

Member 2 adds a new tenant migration, models and integration-gated CRUD handlers. Read [backend handoff](../docs/member2-backend.md) and [API behavior](../docs/api-contract.md). Default requests return 401; no demo login/Apartment implementation. Lifecycle/archive/uploads remain unavailable. SQL schema dump/load requires PostgreSQL 17 client tools, now installed by Docker/CI. Member 3 reviews public placement before development migration.

Created with the official Rails API/PostgreSQL generator, then updated to the supported Rails 8.1.4 runtime/defaults before feature work, using Ruby 3.3.10. Devise 5.0.4 and ros-apartment 3.4.4 are dependencies for subsequent implementation, without login or schema switching configuration; Member 2 now adds tenant models on this branch.

Use the root [README](../README.md) for Compose startup and test commands. `db:prepare` prepares the selected database; the new domain migration requires Member 3 review before development application; no demo accounts exist. Foundation integration tests exercise `/up` and PostgreSQL test connectivity. Planned feature tests are in [test plan](../docs/test-plan.md).

Member 2 owns business models/APIs; Member 3 owns authentication, policies and schema tenancy. Coordinate shared/tenant migration placement before adding migrations here. Never commit `config/master.key` or provision passwords in seeds.
