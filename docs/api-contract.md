# API contract

Tenant workspace branding refinement: the existing authenticated `/api/v1/my_workspaces/:id` response additionally includes optional saved `display_name` and uses `Cache-Control: no-store`. Tenant membership, Active-status and asset authorization remain unchanged. See [tenant dashboard branding](tenant-branding-dashboard.md).

> Current tenant setup and seat policy: [implemented contract and migration notes](tenant-setup-and-capacity.md). User limits are now approved and enforced; older statements that seat limits are unavailable are superseded. Primary-contact access still requires explicit invitation acceptance.


> Current design/account-security update: see [Figma integration and approved policy changes](figma-integration.md). This supersedes historical statements below that exclude 2FA, Microsoft linking, or guarded development deletion. Microsoft credentials and production deletion approval remain pending.


## Approved-rule increment (current)

This section supersedes the historical gated/proposed sections below. The complete approved policy is in [decisions](decisions.md).

- Tenant POST/PATCH now enforce required company/industry/currency/contact/assignment/subscription rules. Create defaults to inactive, ready only after atomic provisioning. Exactly one enabled CPQ Admin is required. Super Admin alone may create, reassign and change commercial fields. Assigned CPQ Admin can update company/contact/branding fields.
- PATCH retains ETag/If-Match concurrency protection. Omitted keys preserve; explicit null clears optional values. New optional `contacts[].phone` and `subscription.payment_method_description`; payment method Other requires description. Subscription fee and percentage values are decimal strings with two decimal places maximum. Discount duration is a string containing positive whole monthly cycles when applied. `billing_interval: "monthly"` is response-only.
- Currency changes are rejected when the trusted subscription `first_invoiced_at` marker is set. There is no invoice creation or payment processing endpoint; future billing must set this marker atomically when issuing the first invoice.
- Detail/list responses include `permitted_actions` from the server. POST `/api/v1/tenants/:id/lifecycle` accepts `{ "action": "activate|deactivate|suspend|reactivate|archive|restore" }` (one action string). It locks/rechecks status and permissions, audits success and returns full detail/ETag. `reactivate` and `restore` return inactive. Invalid transition is 409; forbidden role 403. No DELETE tenant route exists.
- GET `/api/v1/reference_options` returns `{data:[{id,kind,code,label,enabled}],admins:[{id,label}],typography:[{id,label,fontFamily}]}`. Enabled options only, unless Super Admin requests `include_disabled=true`. POST accepts `{option:{kind,code,label}}`; PATCH `/:id` accepts `{option:{label,enabled}}`. Mutations require Super Admin. Codes are immutable; disable instead of delete. Industry values must be supplied by SELISE. `db:seed` idempotently inserts approved currency/payment options.
- POST `/api/v1/brand_assets` is multipart with `file`, `kind` (`logo`/`favicon`) and optional `tenant_id` for existing tenants. New-tenant staging requires Super Admin; existing-tenant upload requires assignment/update access. Returns `{id,url}`. GET `/:id` enforces tenant read access (staged asset: uploader only), serves validated image content with nosniff/no-store. Client-supplied filenames/MIME do not establish validity.
- Staged assets bind to tenant/kind under lock inside successful tenant persistence. Failed validation rolls back binding and retains prior branding. Unreferenced/staged bytes are retained; cleanup requires an explicit reviewed retention operation. Archive never deletes assets or schemas.



The Member 1 typed adapter and draft form are now included on the integration branch. [Form handoff](member1-forms.md) still records missing product/reference/upload decisions; inclusion does not approve those contracts.

## Member 4 frontend integration

Implemented clients consume session, tenant list and detail APIs. Search/pagination follow the handler contract below. The form gateway captures ETag, requires it for PATCH and preserves unchanged nullable values and assets. Empty versus explicit clearing needs Member 1/2 review before enabling writes. Status filters and lifecycle actions remain unavailable until an approved catalogue/policy is supplied. No upload/reference-data endpoint is assumed.

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

PATCH requires `If-Match: "<lock_version>"` copied from latest ETag. Missing/malformed -> 428, stale -> 409. Member 4 added ETag capture and this header to the shared form gateway; Member 1 reviews that compatibility change. All responses use Cache-Control: no-store. Update reauthorizes under lock.

The payload below is implemented structurally, with business approval still required. Scalars are string/null except company_name_display (boolean/null) and primary (boolean). Decimal fee/discount value must be finite decimal strings, not JSON floats; blank becomes null. Serialization preserves precision, not textual trailing zeroes. No inferred required fields/bounds/units/currency rules. Contacts required on create; supplied arrays must have exactly one primary, owned IDs and no duplicates. Unknown fields -> 422. Nested supplied keys merge; clear individual scalars with null. No automatic contact accounts.

Full detail includes id, company fields, lifecycle_status (nullable pending policy), provisioning_status, lock_version, contacts with IDs, responsible_admin_ids, every branding key and complete subscription/discount keys. No schema identifiers. Error envelope adds server request_id: `{"error":{"code":"validation_failed","message":"Review the highlighted fields","fields":{"contacts":["Exactly one primary contact is required"]},"request_id":"correlation-id"}}`. Other codes: unauthenticated 401, forbidden 403, not_found 404, invalid_filter 400, precondition_required 428, stale_version/persistence_failed 409, integration_unavailable/provisioning_failed/provisioning_recovery_required/policy_unavailable 503, sanitized internal_error 500. No raw SQL or submitted values in database errors. Automatic idempotent create retries are not implemented.

## Foundation

`GET /up` is the generated Rails health route. It checks application boot, not database readiness, authorization or tenant isolation. Authentication is implemented in Member 3's increment above.

## Proposed REST contract for review

The historical planning contract below remains proposed wherever it differs from the implemented increments above. Authentication transport and session/CSRF handling are now resolved as described above. Use Devise login/logout, no registration routes, and a server-verified role/assignment on every domain request. An anonymous request must fail before tenant data access. Super Admin can use approved implemented platform actions; CPQ Admin can access assigned tenants only. Decide whether unauthorized identifiers produce 403 or concealed 404 consistently.

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

## Tenant activity (implemented local application increment)

`GET /api/v1/tenants/:id/activity?page=1&per_page=20` requires the same administrator authentication, assigned-tenant scope and read authorization as tenant details. Out-of-scope/malformed tenant IDs return 404; anonymous requests return 401. `page` is a positive integer; `per_page` is 1–100, default 20; invalid values return 400. Response is no-store. Events are ordered by created_at descending, then ID descending, and pagination is applied server-side.

```json
{"data":[{"id":"event UUID","action":"updated","occurred_at":"ISO-8601 timestamp","changed_fields":["branding"]}],"meta":{"page":1,"per_page":20,"total_count":1,"total_pages":1}}
```

The example illustrates the shape, not a seeded event. `changed_fields` contains allowlisted top-level names only. No actor identity, correlation/request ID, values, schemas or arbitrary metadata are returned. Existing audit recording is unchanged. There is no write/delete history endpoint. Angular loads the timeline on demand with loading, empty, retry and pagination states. This is a read-only addition to the implemented tenant-management scope.

## Implemented account onboarding API extension

Same-origin cookie sessions and CSRF apply to all writes, including invitation preview/acceptance. Fetch the existing `/api/v1/session/csrf` first; return its token in `X-CSRF-Token`. No public registration endpoint exists. The following are implemented, not future contracts.

| Method/path | Access and payload/result |
| --- | --- |
| GET `/api/v1/tenants/:id/setup_review` | Authorized platform staff; `{data:{tenant_id,company_name,lifecycle_status,complete,can_activate,checks:[{key,label,complete,errors}]}}` |
| GET `/api/v1/administrators` | Super Admin; `{data:[{id,name,email,role,enabled,activated,assigned_tenants,invitation}],invitation_delivery}` |
| POST `/api/v1/administrators` | Super Admin; `{administrator:{email,name?}}`; 201 `{id,invitation,invitation_token}` with a one-time `invitation_token`; no password input |
| PATCH `/api/v1/administrators/:id` | Super Admin; `{administrator:{name?,enabled?}}`; 204. Email/role cannot be changed here. Pending accounts cannot be enabled without activation; assigned staff cannot be disabled |
| POST `/api/v1/administrators/:id/invite` | Super Admin; recover pending staff activation, `{data:invitation,invitation_token}` |
| GET `/api/v1/tenants/:tenant_id/invitations` | Super Admin or assigned CPQ Admin; `{data:[invitation],members:[{id,email,role,enabled}],invitation_delivery}`; latest 100 invitations |
| POST same tenant invitations path | Same access; `{email}`; 201 `{data:invitation,invitation_token}` with a one-time `invitation_token` |
| POST `/api/v1/invitations/:id/resend` | Appropriate staff/tenant permission; rotates token and returns `{data:invitation,invitation_token}` |
| POST `/api/v1/invitations/:id/revoke` | Same permission; 204; only unused invitations, not accepted account access |
| POST `/api/v1/invitation_preview` | Token holder with CSRF; `{token}`; `{data:{email,kind,expires_at,company_name,existing_account}}` |
| POST `/api/v1/invitation_acceptance` | `{token,password,password_confirmation?}`; confirmation required for new accounts; existing tenant users authenticate current password; `{data:{kind,accepted:true}}` |
| GET/POST/DELETE `/api/v1/tenant_session` | Separate Tenant Admin session; POST `{tenant_user:{email,password}}`; `{data:{id,email},csrf_token}`. GET returns identity, DELETE 204 |
| GET `/api/v1/my_workspaces` | Enabled signed-in tenant user; `{data:[{id,company_name,status}]}` for own enabled memberships |
| GET `/api/v1/my_workspaces/:id` | Own enabled membership, Active/ready/current schema; `{data:{id,company_name,description,company_name_display,role,branding}}` |
| GET `/api/v1/my_workspaces/:id/assets/:asset_id` | Same access plus asset ownership; binary content, private/no-store and nosniff |

Invitation summaries contain `{id,kind,email,expires_at,state,delivery_status}`; never token or digest. Errors use `{error:{code,message,fields}}`: 401 unauthenticated/invalid credentials, 403 forbidden, 404 inaccessible record, 409 conflicting state, 410 unusable invitation, 422 validation. Delivery is `manual_link`; no SMTP request is made. Raw tokens appear only on create/replace and are absent from history. A lost response requires replacing the link, not creating another account. Acceptance is transactional and single-use under concurrent requests. See [account onboarding](account-onboarding.md) for private sharing, transaction boundaries and verification limits.


## Access and catalogue extension (implemented)

- `DELETE /api/v1/reference_options/:id`: MFA-verified Super Admin only, industry only; 204 if unused, 409 `industry_in_use` if referenced (deactivate via existing PATCH). Deletes and option state changes are audited. Catalogue locks serialize tenant selection with removal/deactivation.
- Tenant invitation create accepts `{email, delivery: "email" | "manual"}`. Duplicate pending creation returns 409; explicit resend replaces the link. Create/resend return existing one-time issuer token and invitation `email_delivery_status`: `not_requested`, `sending`, `sent`, `failed`, `unconfigured`. `sent` means SMTP submission accepted, not inbox receipt; invitation state and enabled account/membership are separate. No persistent queue is claimed.
- Invitation history additionally returns `company_name`, while retaining primary-contact prefill and seat counts. Recipient preview additionally returns `tenant_id`. New recipient acceptance includes `name`, password and password_confirmation; name is trimmed, nonblank, max120 characters. Existing recipient acceptance requires a matching MFA-verified tenant-user session plus existing password and preserves credentials/MFA.
- Token errors distinguish `invalid_invitation`, `invitation_expired`, `invitation_revoked`, and `invitation_already_used` (410). Token fragments and request parameters are never logged; links are single-use, 72hours as previously agreed. Active/Inactive ready tenants can onboard; workspace access still requires Active.
- Authorized workspace response adds country, IANA time_zone and currency metadata. It intentionally excludes commercial subscription and platform-only administrative settings.

Full local configuration and recipient walkthrough: [access and persistence](invitation-delivery-and-persistence.md).
