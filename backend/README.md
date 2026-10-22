# Rails API foundation

Created with the official Rails API/PostgreSQL generator, then updated to the supported Rails 8.1.4 runtime/defaults before feature work, using Ruby 3.3.10. Devise 5.0.4 and ros-apartment 3.4.4 are dependencies for subsequent implementation, without login, tenant models or schema switching configuration.

Use the root [README](../README.md) for Compose startup and test commands. `db:prepare` prepares the selected database; no domain migrations or demo accounts exist. Foundation integration tests exercise `/up` and PostgreSQL test connectivity. Planned feature tests are in [test plan](../docs/test-plan.md).

Member 2 owns business models/APIs; Member 3 owns authentication, policies and schema tenancy. Coordinate shared/tenant migration placement before adding migrations here. Never commit `config/master.key` or provision passwords in seeds.
