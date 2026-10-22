# Architecture

## Member 3 implemented increment

The user selected same-origin Devise cookie sessions plus CSRF. Public-qualified administrator/management records are excluded from Apartment. Tenant schema keys are server-generated and immutable. Provisioning schema DDL and registry/settings/audit share one PostgreSQL transaction; failed attempts leave no partial registry/schema, with post-rollback failure history where the process/database remain available. TenantContext authorizes trusted tenant identity, checks readiness/lifecycle policy/migration versions, block-switches via Apartment and restores public context. No public fallback for tenant tables, schema header elevator or public-table cloning. [Full handoff](member3-auth-tenancy.md) records migration boundaries and limits; older proposed sections below remain historical planning context.

## Agreed direction

One monorepo contains Angular UI (`frontend/`), Rails REST modular monolith (`backend/`), documentation, local infrastructure and GitHub Actions. PostgreSQL schema-level separation uses Apartment. Devise supplies authentication; authorization is enforced in Rails. Node.js serves Angular tooling only. Local Docker Compose is independent of future Azure/Kubernetes resources.

## Foundation facts

Member 2 adds public-qualified management models and closed-by-default CRUD handlers. Devise, authorization and Apartment remain Member 3 integration points. [Backend handoff](member2-backend.md) describes the proposed synchronous provisioning transaction and crash/recovery limitations. Shared placement/exclusions require Member 3 review before integration.

The remote was empty at inspection. Generated applications and a health route are foundation work; no tenant domain models, administrator login, policies or tenant switching are implemented by this setup. Installed gems are dependencies, not proof of functioning authentication or isolation.

## Proposed boundaries

Shared `public` platform records: administrator identities and roles, tenant registry (including internal schema identifier), assignments, contacts, branding/subscription metadata, provisioning state and lifecycle audit. Keeping management records shared permits platform administrators to manage tenants without selecting a tenant business schema. Review this placement before migrations.

Tenant schemas hold future CPQ business records, e.g. catalogues and quotes. Member 3 will configure explicit excluded shared models and migrations after agreement with Member 2. Do not derive schema names directly from user input or accept an arbitrary client schema header. Resolve a server-owned identifier after authenticating and authorizing the target tenant, then use block-scoped switching with guaranteed cleanup. Background jobs need the same context discipline.

Schema switching does not replace authorization. Shared tables still need assignment checks on lists, details, writes and lifecycle actions. A CPQ Admin must not read or mutate another assignment even though both tenants' metadata is in `public`. Super Admin access is broad only across implemented, approved platform actions.

Proposed provisioning flow: persist a non-ready registry entry, provision schema/migrate, mark ready only after success, and expose recoverable failure state. Database transactions alone cannot be assumed to reverse all provisioning side effects; specify retry idempotency and compensation in the implementation issue. Do not activate an incompletely provisioned tenant.

Session transport is now user-approved: a same-origin cookie session with CSRF protection. API-only Rails now includes explicit session middleware; do not disable CSRF simply to integrate Angular. Cross-origin development must use an explicit proxy/origin policy.
