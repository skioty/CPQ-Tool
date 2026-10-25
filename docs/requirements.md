# Tenant prototype requirements

## Confirmed

The one-week semester prototype manages tenants for a reusable multi-tenant CPQ SaaS. Remaining CPQ modules are next-semester work. Angular, Rails REST, PostgreSQL schemas, Apartment, Devise and a modular monolith are agreed. Figma is the design tool; Scrum-style work uses one short sprint.

Create/edit captures primary and secondary theme colours, typography, logo, favicon, company name display, description, multiple contacts with exactly one primary contact, responsible SELISE CPQ Admin, industry, currency, subscription fee, payment method, discount and discount duration. Requiredness and business semantics are now approved in the final table in [decisions](decisions.md). Historical planning below is superseded by that table.

Lifecycle actions: create, view/edit, activate/deactivate, suspend/reactivate, and delete or archive subject to policy. Supporting views: tenant list, search/status filters, details, forms, confirmation dialogs and branding preview. Inactive, suspended and archived block tenant-user access; authorized platform staff retain management access. Archive and restore retain records and schema; permanent deletion is unavailable.

Minimum access: Devise administrator login/logout, controlled development/demo provisioning, CPQ Super Admin access to all implemented platform actions, CPQ Admin access restricted to assigned tenants, server-side enforcement and no public self-signup. Contacts are not active Tenant Admin accounts. Account access requires explicit invitation and role assignment; implementing onboarding remains out of scope.

## Proposed acceptance criteria (review before implementation)

- Create persists agreed fields and exactly one primary contact atomically, returns validation errors without a partial tenant and permits an authorized user to view the result.
- Edit preserves unchanged settings and rejects invalid contacts. Branding previews match persisted approved assets.
- List/search/filter and direct detail requests expose only authorized tenants. Direct API calls cannot bypass UI permissions.
- Lifecycle transitions follow the approved transition/permission matrix, show confirmation and create an audit record. Destructive actions remain unavailable until policy is agreed.
- Provisioning failure is visible and recoverable without exposing another schema. Two tenant contexts retain isolation on success and exceptions.
- All members can start the same foundation from a clean clone and demonstrate acceptance evidence.

## Excluded from setup and current sprint unless separately agreed

Full quoting/pricing/catalogue modules, real payment processing or card storage, production hardening, Azure resources, Kubernetes deployment, public self-registration and automatic Tenant Admin activation. Azure and Kubernetes remain the full-project deployment direction. This setup adds no tenant business feature.

See [decisions](decisions.md) for unresolved rules and [test plan](test-plan.md) for planned evidence.

## Approved onboarding scope extension

Guided persisted setup review, Super Admin staff management, and explicit Tenant Admin email invitations are now implemented locally under the approved policies in [account onboarding](account-onboarding.md). Earlier invitation exclusions are historical. Tenant-side user administration and password recovery remain outside this increment. Contacts never grant access automatically. Live SMTP delivery remains unverified.
