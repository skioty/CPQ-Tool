# Database design

## Existing facts

Before setup: no schema, migrations, seeds or application existed. The foundation uses PostgreSQL and Rails database tasks; it introduces no tenant tables or demo accounts. Rails migrations and seeds belong in `backend/db/`.

## Proposed entities (not approved migrations)

| Entity | Proposed responsibility | Outstanding choices |
| --- | --- | --- |
| Platform administrator | Devise identity, platform role | session transport, controlled provisioning process |
| Tenant registry | stable ID, internal schema key, company name/display, description, industry, lifecycle and provisioning states | required fields, identifiers, initial status, transitions |
| Tenant contact | tenant reference, contact details, primary flag | contact fields/requiredness; exactly one primary is confirmed |
| Tenant branding | primary/secondary colours, typography, logo/favicon references | formats, sizes, font restrictions, defaults |
| Subscription settings | currency, fee, payment method descriptor, discount, duration | billing interval, precision, discount type/unit, duration semantics |
| Admin assignment | tenant and platform administrator references | one or many responsible admins |
| Audit event | actor, tenant, action, previous/next state, timestamp | retention and which changes are audited |

Proposed invariant: atomically update contacts with the tenant; a partial unique index can enforce at most one primary, but application/transaction validation is also required to guarantee at least one. Do not claim the index alone enforces exactly one.

Use separate lifecycle and provisioning states; their enum values and allowed transitions require approval. Preserve inactive vs suspended as unresolved concepts. Do not implement deletion, cascading drops or archive flags until retention/recovery policy is agreed.

Proposed metadata tables reside in `public`; future CPQ business tables reside in tenant schemas. Validate this boundary before migrations. Money must use a reviewed decimal/minor-unit representation with currency precision; no floating point or assumed billing interval. Payment method means configuration only until agreed; do not store payment card secrets.

Member 3 coordinates shared vs tenant migrations and schema version evidence with Member 2. Test new databases, existing schemas, partial provisioning and retry/recovery before adopting a migration process.
