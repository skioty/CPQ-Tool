# Member 3 authentication and schema tenancy

## Inspection and dependencies

Verified skioty/CPQ-Tool remote, default main, both existing worktrees clean, no repository AGENTS.md. Read the requested source and planning documents. Main still contains the bootstrap README; setup #16 and Member 2 #18 remain dependency PRs. This branch starts from verified main and fast-forwards through Member 2's backend. Member 1 work/preview remains in the original checkout. No old migration or dependency lockfile is rewritten. Coordination notes are on issues #4/#5/#7/#8. Member 2 reviews this increment; Member 4 reviews Compose/proxy support.

Pinned Ruby 3.3.10, Rails 8.1.4, Devise 5.0.4, ros-apartment 3.4.4 and PostgreSQL 17.11 remain. The maintained Apartment fork is configured using its installed v3 APIs, not v4 documentation. Tests must demonstrate compatibility; installing gems alone proves nothing.

## Confirmed session decision and implemented flow

The user selected same-origin Devise cookie sessions with CSRF and approved a test-only isolation endpoint. Rails API explicitly includes cookie/session middleware, Devise helpers and request-forgery protection. The session cookie is HttpOnly, SameSite=Lax, with a 30-minute expiry/Devise idle timeout; Secure is enabled in production. These security defaults are reviewable configuration choices. Local HTTP is loopback development only. Production HTTPS, secret management and deployment are unconfigured.

| Endpoint | Behavior |
| --- | --- |
| GET /api/v1/session/csrf | starts/uses session and returns csrf_token; no-store |
| POST /api/v1/session | administrator.email/password, X-CSRF-Token from same browser session; returns actor id/role plus fresh csrf_token; generic 401 on bad credentials |
| GET /api/v1/session | current actor id/role, or 401 |
| DELETE /api/v1/session | X-CSRF-Token required; sign out/reset cookie session, 204 |

Login resets the session before sign-in to avoid fixation. Clients retain the CSRF token in memory and send X-CSRF-Token on POST/PATCH/DELETE; obtain a fresh token after login/logout/session expiry. No token in localStorage, URL, committed environment or logs. No public registration, reset-password, invitation or role-administration routes. A primary contact is never a user. Role/header/schema parameters are not credentials. Copied encrypted cookies are not individually revocable through a server-side session table; idle/absolute cookie expiry and password changes provide existing Devise limits. Broader revocation, login abuse throttling and production hardening remain follow-up work.

The Compose Angular proxy routes /api/** to backend:3000 while preserving browser origin. Restart frontend after proxy changes. Native Angular uses a local proxy targeting localhost:3000 instead; do not silently use the Docker DNS name natively. Member 1 still needs a login UI/session service and CSRF header handling; this PR does not enable unapproved tenant-form saving or merge frontend feature branches.

## Accounts and access

Platform::Administrator lives in public, with Devise database authentication/validation/timeout, enabled flag, and fixed super_admin/admin roles. No custom roles or tenant accounts. Provision one account explicitly in development/test by supplying CPQ_ADMIN_EMAIL, CPQ_ADMIN_PASSWORD and CPQ_ADMIN_ROLE at runtime, then running:

```sh
docker compose run --rm backend bundle exec rails platform:provision_admin
```

Compose does not forward these variables by default. Use `docker compose run --rm -e CPQ_ADMIN_EMAIL -e CPQ_ADMIN_PASSWORD -e CPQ_ADMIN_ROLE backend bundle exec rails platform:provision_admin` with values set in your current shell, then clear them. Repeat for each approved role with different runtime credentials. No account is automatically seeded. Existing accounts are not silently overwritten. The task refuses production; never put passwords directly in command history or committed files. Password validation currently requires 12–128 characters. No actual demo accounts were provisioned by this task.

Super Admin can list/read/create/update implemented tenant-management actions. CPQ Admin lists/reads/updates assigned tenants only; creation has no assignment context and is denied. Default assignment changes require Super Admin; CPQ Admin can resubmit an unchanged set. This conservative assignment-change restriction is an engineering proposal for review, not an agreed lifecycle permission matrix. Assignment IDs must resolve to enabled CPQ Admin accounts; cardinality remains Member 2 business validation. Eligibility and authorization run on backend, including direct requests; updates recheck assignment under lock. No management rule relies on schema switching or UI guards. Out-of-scope IDs return 404.

TenantManagement's real integration now authenticates through Devise and delegates policy/provisioning to Platform services. Member 2 business/requiredness/currency/discount/initial lifecycle/status filter/asset validators remain closed until approved. Tests override only those unresolved product validators; real authentication, access and Apartment code run unchanged. No production validation bypass is provided.

## Shared and tenant records

Member 3 reviewed public qualification as appropriate for cross-tenant management. Apartment excludes administrator, provisioning failure and all six Member 2 models. Schema-only mode, no public persistent fallback, no public schema cloning, no automatic seeds and no global automatic Apartment migration sweep. Tenant business lookup cannot fall back to public tables.

New forward migration adds administrators, failure history and schema_key. The server generates cpq_t_ plus random hex; database format/uniqueness and an immutable trigger protect it. Clients cannot submit or retrieve schema keys. Existing registry rows receive unique identities but are not silently provisioned; verify actual schemas before treating older ready rows as usable. Existing opaque assignment strings need reconciliation before a real identity FK can be added safely; this PR does not coerce old IDs or edit Member 2's migration. Service-level eligibility is implemented, database identity FK remains a limitation.

Tenant-local isolation_markers and tenant_schema_versions are created only inside tenant schemas. Markers contain synthetic evidence, not CPQ business data. GET /api/v1/tenants/:id/isolation-probe is routed **only in test**, authenticates and authorizes the tenant, checks provisioning and the workspace policy, then reads local markers. There is no public development/production probe endpoint.

## Provisioning, failures and retry

SchemaProvisioner.provision!(tenant) implements Member 2's receipt interface. It requires a persisted registry inside an open transaction, uses Apartment.create plus tenant-only migrations in a savepoint on the **same PostgreSQL connection/transaction**, and returns an internal receipt only after completion. Registry/settings, schema DDL, local tables and audit commit together. An exception or connection/process termination before commit rolls them all back; no external file/cloud operation exists. This replaces the earlier external-provisioning crash window for this PostgreSQL-only implementation.

Writer captures the tenant UUID before rollback and records provisioning_failed/schema_conflict afterward in public failure history with request ID/code/time only. Failures can be inspected without a partial tenant registry using `bundle exec rails platform:provisioning_failures` in development/test. A hard process crash can leave no failure-history row, but its uncommitted PostgreSQL DDL/metadata roll back together. Failure logging itself can fail on database outage; infrastructure logs/request ID and operator investigation remain necessary. No raw exception text, passwords or schema keys are stored in failure history.

Compensation checks that the rolled-back schema is absent; it never drops a surviving schema on an ambiguous commit outcome. Unexpected existing pending schema yields a conflict requiring operator investigation. Re-provisioning an already-ready registry/schema is idempotent only when tenant migration versions match. A confirmed failed create may be submitted again: the earlier registry/schema are absent, so successful retry leaves one tenant. There is no idempotency-key endpoint: do not blindly retry a lost success response or ambiguous 500; locate the result first. No permanent tenant/schema deletion API is introduced.

## Switching and migrations

TenantContext.with(actor:, tenant_id:) resets entry context, resolves an authorized trusted registry record, checks ready provisioning, checks workspace policy and migration versions, then block-switches through Apartment. Ensure resets physical search_path and adapter context to public after success/errors. Browser schema headers are ignored. Connection checkout remains within the block. Shared models retain public qualification. Jobs must use the same service with a trusted authenticated/authorized principal; no automatic job tenancy is claimed.

Workspace access defaults closed for **all** lifecycle states because inactive versus suspended/archive behavior is unresolved. Tests explicitly verify denial for inactive/suspended/archived/unknown values; this is not an approved state matrix. Synthetic test-only policy permits fixture access solely to prove isolation. Lifecycle mutations remain unavailable.

Public migrations stay in db/migrate and use normal db:prepare; tenant-only migrations stay in db/tenant_migrate. Both remain inside Rails. Shared structure.sql dumps public only. New tenants run all tenant migrations inside provisioning. Existing ready tenants use:

```sh
docker compose run --rm backend bundle exec rails platform:migrate_tenants
```

The task locks each registry, switches to its generated schema, applies missing versions transactionally and stops on failure. Successful versions persist per schema, so rerun resumes; it never reruns public migrations or automatically creates a missing schema. Current request access denies schemas with pending versions. Restart backend and workers after coordinated schema changes to refresh model/schema caches. No automatic destructive down/rollback task. Review tenant migrations jointly with Member 2 and back up development data before intentional schema changes. Apply pending public migration only after PR review; this task uses test data only.

## Review and verification status

Reviewed Member 2's public records, locking/contact constraints and sanitized audits, plus the PostgreSQL client installation used by Docker/CI. Integration changes address real authentication, same-transaction schema provisioning and post-rollback failure evidence. Remaining limitations are business gates, assignment FK, durable create idempotency and lifecycle policy. Review notes do not constitute peer approval of this author's PRs.

Tests cover real Devise sessions/CSRF, roles/assignments/direct requests, two-schema data, alternating/concurrent requests, restored context after errors, rollback/retry and tenant migration reruns. Final local suite: 42 tests, 248 assertions, zero failures/errors/skips. Earlier fresh database verification passed all then-existing 37 tests / 220 assertions; all code also passed zeitwerk:check. CI passed on the initial implementation commit; the expanded final suite is tracked in the PR. Initial test iterations found session persistence/account-switching and rollback-ID/test-CSRF setup issues, all corrected. Existing mutex_m deprecation and expected database rollback warnings remain. Real development HTTP through the Angular proxy returned CSRF 200, missing-CSRF 422 and invalid-login 401; the isolation route returned development 404. Smoke containers were removed and the original frontend/backend returned 200. Browser login UI, production deployment, other operating systems, process-kill injection and multi-process load have not been tested. No actual demo credentials or development data were used.

References: [Devise API mode](https://github.com/heartcombo/devise#rails-api-mode), [pinned Apartment v3.4.4](https://github.com/rails-on-services/apartment/tree/v3.4.4), [Angular proxy](https://angular.dev/tools/cli/serve#proxying-to-a-backend-server).
