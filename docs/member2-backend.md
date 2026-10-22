# Member 2 backend handoff

## Inspection

Verified remote skioty/CPQ-Tool, default main, clean starting tree and no repository AGENTS.md. Read README, CONTRIBUTING and all requested planning documents. Main still contains only the bootstrap README; setup PR #16 is open. `feat/tenant-api` starts from verified main and fast-forwards through the setup dependency. Member 1 commits remain on feat/tenant-forms / PR #17 and are not overwritten. Switching branches changes source shown by local containers. No existing migration was rewritten or dependency version changed.

Coordination notes are on actual issues #6, #8, #5 and #11. Member 3 reviews backend/migration placement; Members 1/4 must review payload, concurrency and list behavior before integration. No usernames are guessed.

## Implemented increment

Six public-qualified UUID models/tables: Tenant (company fields, lifecycle and provisioning state), Contact, Branding, Subscription, Assignment and AuditEvent. The new forward migration is `20261022000100_create_platform_tenant_records`. Public placement is a **proposed design pending Member 3 review**, not an approved shared migration strategy. Model qualification prevents ordinary search-path switching from selecting similarly named tenant tables; it does not replace authorization or prove isolation. Member 3 must exclude these six models from Apartment tenant copying/migrations and coordinate public-only migration execution before development application.

All requested fields have storage. Opaque industry/admin/asset identifiers do not fabricate catalogues or identity models. Subscription money/discount values use unconstrained PostgreSQL numeric / Rails decimal and decimal-string transport. No guessed currency scale, interval, sign bounds, conversion, discount type or duration units. Blank decimal strings become null. Duration is uninterpreted pending rules.

Exactly one primary contact uses structural validation, a partial unique index (at most one), deferred constraint triggers (at least one at commit), and parent row locks serializing contact writes. Contacts cannot move between tenants. Full-array replacement preserves owned contact IDs; omission preserves existing contacts. Removing a primary without explicit replacement fails. Database constraints are forced before successful service completion.

Create/update services persist registry/settings/contacts/assignments and audit atomically. Audits contain actor ID, tenant ID, action, server time, request ID and submitted top-level field names only. No before/after values, contact details, secrets or payment data. Persisted audit records are read-only through the model; this is not database-role-level tamper resistance. Retention and expanded audit scope are open. Request tenant bodies are filtered from Rails parameter logs.

No delete route, model destruction refused, restricted parent foreign keys. Lifecycle route returns explicit unavailable after access checks without mutation. These are policy gates, not implemented archive/lifecycle features.

## Closed integration interfaces

`config.x.tenant_management.integration` is a callable resolving a collaborator per request. Default `TenantManagement::Integration` denies authentication with 401; all other methods raise 503. No role header, parameter, demo identity or environment bypass exists. Synthetic adapters load only in tests.

Member 3 supplies:

| Method | Required behavior |
| --- | --- |
| authenticate!(controller) | Devise/session actor with stable id; nil denied. Integrate chosen CSRF/session before writes. |
| scope!(actor) | TenantManagement::Tenant relation restricted by server roles and assignments, including list/detail/update. |
| authorize!(actor, action, tenant=nil) | True or sanitized domain error; actions list/read/create/update/lifecycle. Recheck eligibility/assignment under update lock. |
| validate_assignments!(actor, ids, tenant) | True only for eligible administrators, approved cardinality and permitted reassignment. Add real identity FK in a forward migration when the identity table exists. |
| provision!(tenant) | Invoke agreed Apartment service; return opaque receipt only after schema/migrations are ready. No client schema name or schema identifier in API. |
| compensate!(receipt) | Idempotently clean only this attempt's external effects; true on success, failure requires operator recovery. |

Members 1/2 and the team supply reviewed `validate_business!(actor, submitted_attributes, tenant)`, `initial_lifecycle!`, `filter_status!(status)` and `validate_assets!(actor, changed_asset_ids, tenant)` through this collaborator or delegation. Approval methods must return **true**; nil/false fails closed. Business validation must evaluate effective saved plus submitted state, required/reference/decimal/discount rules and effective assignments even on unrelated edits. Use TenantManagement::Error with stable dotted field paths. No fabricated default policy is shipped.

## Transactions, provisioning and files

Create opens a DB transaction, authorizes, validates, persists pending registry/settings, checks contact constraints, invokes synchronous provisioning, marks ready, audits and commits. Provisioning/validation failure rolls metadata back. If provision! raises before returning a receipt, its adapter must clean partial effects itself. If later persistence/commit fails after a receipt, Writer calls compensate!. Failed compensation returns provisioning_recovery_required, never success.

This synchronous proposal is not a durable distributed transaction. Process termination between provisioning and DB commit/compensation can leave orphans. Durable attempt tracking/reconciliation, failed registry state, automatic retry and idempotency keys are not implemented; Member 3 must agree recovery before enabling creation. Do not automatically retry ambiguous 500/lost-create responses; investigate request ID. No asynchronous 202 success is implemented.

Update locks the parent, reauthorizes, checks If-Match version, validates and writes supplied settings plus audit in one transaction. No provisioning on update. Omitted assets/settings/collections remain unchanged. Full responses contain every form field. Contact arrays replace atomically; new contacts get server IDs. Version changes even for child-only edits.

No file/upload operation or Active Storage tables are added. Opaque asset IDs require an approved ownership/restriction validator. No guessed MIME, size, dimensions, SVG or storage rules. Upload finalization and orphan expiry/cleanup need Member 1/2 agreement; DB rollback cannot be assumed to remove blobs. Payment method is configuration only; no card data/secrets.

## Remaining decisions/features

User clarified administrator control for lifecycle/deletion/discounts, but not exact CPQ Admin/Super Admin permissions, transitions, deletion versus archive, retention or discount semantics. Those remain open, along with required fields, assignment count, reference catalogues, monetary precision/bounds, session transport and upload policy.

Lifecycle mutations/audits, archive retention/recovery, permanent deletion, reference-data/upload endpoints, real eligibility/access implementation, Devise sessions, Apartment schema creation/isolation and automatic reconciliation are **not implemented**. Synthetic test success is not proof of these integrations. Frontend saving is not enabled by this branch.

## Verification

Only the separate test database was migrated. PostgreSQL constraints/functions require SQL schema format; Docker/CI now install PostgreSQL 17 client tools. Rebuild backend images before tests; native users need matching pg_dump/psql on PATH. The migration passed initially, but schema dump failed because pg_dump was absent; this prompted the infrastructure fix. The rebuilt image passed schema dump, normal db:prepare, 28 Rails tests (143 assertions) and zeitwerk:check. A separate fresh-database SQL-load check is recorded in the PR. Expected database constraint-failure tests emit PostgreSQL rollback warnings; Ruby/minitest also emits its existing mutex_m deprecation warning. Initial CI failed to find PostgreSQL 17 in Ubuntu default sources; CI now configures the official PostgreSQL apt repository. Final CI status is recorded in the PR. No development migration/reset, demo provisioning or schema deletion was performed. Member 3 must review placement before applying to development.

Tests use real PostgreSQL plus synthetic auth/policy/provisioning collaborators. They validate plumbing, atomicity and constraints, not real Devise/Apartment. Design references: [PostgreSQL deferred constraint triggers](https://www.postgresql.org/docs/17/sql-createtrigger.html) and [Rails schema formats](https://guides.rubyonrails.org/active_record_migrations.html#types-of-schema-dumps).
