# API contract

Member 1 implements an isolated **proposed-contract** adapter and draft UI; this does not approve the contract. See [form handoff](member1-forms.md) for complete-response, reference-data, uploads, session and navigation coordination gates.

## Implemented foundation

`GET /up` is the generated Rails health route. It checks application boot, not database readiness, authorization or tenant isolation. No tenant or authentication endpoints are implemented yet.

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
