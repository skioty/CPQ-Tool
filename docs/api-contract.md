# API contract

The Member 1 typed adapter and draft form are now included on the integration branch. [Form handoff](member1-forms.md) still records missing product/reference/upload decisions; inclusion does not approve those contracts.

## Member 3 authentication / tenancy increment

User approved same-origin Devise cookie sessions with CSRF. Implemented GET /api/v1/session/csrf, POST /api/v1/session (administrator.email/password), GET /api/v1/session and DELETE /api/v1/session. Send X-CSRF-Token from the same cookie session on unsafe requests; login returns a new token. No public registration. Cookie is HttpOnly/SameSite=Lax, Secure in production. Angular Compose /api/** proxy supports same-origin requests. See [Member 3 handoff](member3-auth-tenancy.md) for exact account setup and frontend integration requirements.

Real Devise authentication and role/assignment checks now replace the unavailable Member 3 collaborator. Super Admin can list/read/create/update implemented management actions; CPQ Admin can list/read/update assigned tenants, not create unassigned tenants or change assignments. Product validation and initial lifecycle/filter/upload decisions still block tenant writes until supplied by Member 2; no runtime business bypass. Anonymous safe requests return 401, unsafe requests missing CSRF are rejected 422 before data access. Existing proposed contracts below do not approve unknown business rules.

Schema provisioning uses the same PostgreSQL transaction as the registry, with trusted generated immutable keys never exposed to clients. GET /api/v1/tenants/:id/isolation-probe exists only in test and is absent from development/production routes. Workspace lifecycle policy defaults closed for all statuses; no inactive/suspended/archive semantics have been invented. Session/tenancy tests use real authentication and schemas, with only unresolved product/lifecycle rules supplied as synthetic test policy.

## Member 2 implemented increment (integration gated)

See [backend handoff](member2-backend.md) for interfaces, transactions and limits. At Member 2 delivery, default requests returned 401 and success paths used synthetic collaborators. Member 3 now integrates Devise/Apartment as described above; uploads/reference data remain unavailable.

| Method/path | Implemented handler |
| --- | --- |
| GET /api/v1/tenants | authorized scope, literal case-insensitive company-name substring q, exact approved status; page default 1, per_page default 20/max 100; stable created_at/id order |
| POST /api/v1/tenants | atomic create and synchronous provisioning collaborator; 201 only after completion; full detail + ETag |
| GET /api/v1/tenants/:id | full detail + ETag; out-of-scope/malformed UUID -> 404 after authentication |
| PATCH /api/v1/tenants/:id | partial nested settings; supplied contacts/admin arrays replace collection; omitted collections/assets/settings preserved |
| POST /api/v1/tenants/:id/lifecycle | access checks then 503 policy_unavailable, no mutation |

List behavior remains an engineering proposal for Member 4 review. Response meta contains page, per_page, total_count, total_pages (0 for empty). Invalid pagination/unapproved status -> 400. No statuses invented. No DELETE/upload/reference-data routes.

PATCH requires `If-Match: "<lock_version>"` copied from latest ETag. Missing/malformed -> 428, stale -> 409. **Member 1 must add this header before integrating**. All responses use Cache-Control: no-store. Update reauthorizes under lock.

The payload below is implemented structurally, with business approval still required. Scalars are string/null except company_name_display (boolean/null) and primary (boolean). Decimal fee/discount value must be finite decimal strings, not JSON floats; blank becomes null. Serialization preserves precision, not textual trailing zeroes. No inferred required fields/bounds/units/currency rules. Contacts required on create; supplied arrays must have exactly one primary, owned IDs and no duplicates. Unknown fields -> 422. Nested supplied keys merge; clear individual scalars with null. No automatic contact accounts.

Full detail includes id, company fields, lifecycle_status (nullable pending policy), provisioning_status, lock_version, contacts with IDs, responsible_admin_ids, every branding key and complete subscription/discount keys. No schema identifiers. Error envelope adds server request_id: `{"error":{"code":"validation_failed","message":"Review the highlighted fields","fields":{"contacts":["Exactly one primary contact is required"]},"request_id":"correlation-id"}}`. Other codes: unauthenticated 401, forbidden 403, not_found 404, invalid_filter 400, precondition_required 428, stale_version/persistence_failed 409, integration_unavailable/provisioning_failed/provisioning_recovery_required/policy_unavailable 503, sanitized internal_error 500. No raw SQL or submitted values in database errors. Automatic idempotent create retries are not implemented.

## Foundation

`GET /up` is the generated Rails health route. It checks application boot, not database readiness, authorization or tenant isolation. Authentication is implemented in Member 3's increment above.

## Proposed REST contract for review

All domain endpoints below are proposed. Authentication transport and session/CSRF handling remain open. Use Devise login/logout, no registration routes, and a server-verified role/assignment on every domain request. An anonymous request must fail before tenant data access. Super Admin can use approved implemented platform actions; CPQ Admin can access assigned tenants only. Decide whether unauthorized identifiers produce 403 or concealed 404 consistently.

| Method and path | Intent | Proposed success |
| --- | --- | --- |
| GET /api/v1/tenants?q=&status=&page= | authorized list, allowlisted filters | 200 with data and pagination metadata |
| POST /api/v1/tenants | create and initiate provisioning | 201, or 202 if asynchronous provisioning is approved |
| GET /api/v1/tenants/:id | authorized details | 200 |
| PATCH /api/v1/tenants/:id | update approved fields | 200 |
| POST /api/v1/tenants/:id/lifecycle | explicit approved transition | 200; invalid transition 409 proposed |

No delete endpoint is agreed. Proposed lifecycle body: `{"action":"suspend"}`; action vocabulary, permissions and transition behavior must be approved before implementation.

Proposed create/update shape (illustrative schema, not defaults or business rules):

```json
{
  "tenant": {
    "company_name": "Example company",
    "company_name_display": true,
    "description": "Example description",
    "industry_id": "reference-id",
    "branding": {
      "primary_colour": "#112233",
      "secondary_colour": "#445566",
      "typography": "approved-font-id",
      "logo_attachment_id": "authorized-upload-id",
      "favicon_attachment_id": "authorized-upload-id"
    },
    "contacts": [{"name":"Example contact","email":"contact@example.invalid","primary":true}],
    "responsible_admin_ids": ["platform-admin-id"],
    "subscription": {
      "currency": "approved-currency-code",
      "fee": "decimal-string",
      "payment_method": "approved-method-code",
      "discount": {"type":"TBD","value":"TBD","duration":"TBD"}
    }
  }
}
```

The display flag, identifiers, reference lists, assignment cardinality and discount structure are proposals. UI labels must not settle unresolved semantics. Required fields, upload transport/restrictions, money precision, full/partial contact replacement and concurrent edit handling remain open. Clients must never send schema names, role grants or provisioning state.

Proposed detail response: `{"data":{"id":"tenant-id","company_name":"Example company","lifecycle_status":"approved-state","provisioning_status":"approved-state"}}` plus authorized settings/contacts. Never expose credentials, raw internal errors or schema identifiers. List responses use `{"data":[],"meta":{"page":1,"total_pages":1}}` (pagination style to review).

Proposed error envelope: `{"error":{"code":"validation_failed","message":"Review the highlighted fields","fields":{"contacts":["Exactly one primary contact is required"]}}}` with 422. Plan 401 for unauthenticated, 403/404 for denied access, 409 for approved conflict cases, and sanitized 5xx errors with a correlation identifier. Resolve async provisioning/retry contract jointly between Members 2 and 3.
