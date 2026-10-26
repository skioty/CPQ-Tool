# Tenant console design and account security

This implementation extends the integrated Angular/Rails application. It does not replace its backend, permissions, invitations, schema provisioning or approved billing rules.

## Design and feedback traceability

Source: Figma file `uXMNFzg1nunW95NmWxUQjp`, and the supplied Word feedback. Core reference frames inspected: directory `2:179`, organization `2:180`, registration `2:181`, review `2:182`, overview `2:184`, settings `2:185`, suspension `2:186`, access layout `73:9778`. The connector's quota prevented inspection of the remaining authentication frames; those screens use the available design language, rather than claiming exact reproduction.

| Feedback | Implementation |
| --- | --- |
| Root page without breadcrumbs, aligned creation action | Tenant directory heading and Create tenant action |
| Consistent hierarchy, spacing, buttons and footer | Navy console shell, blue actions, Open Sans, white cards and subtle footer |
| Connected stepper and clearer registration | Organization details → Tenant registration → Review & create; validation before advancing |
| Description and typography controls | Textarea and font dropdown, preserving backend reference choices |
| Branding and billing separation | Separate registration cards; existing upload validation remains authoritative |
| Review rows, section edits and pricing sidebar | Reusable review component with preserved form values and monthly estimate |
| Scalable tenant profile/settings | Overview, Contacts, Branding, Billing, Activity and Retention tabs; grouped edit sections |
| Lifecycle confirmation | Existing authorized lifecycle dialogs retained and restyled |
| Page/module organization | Tenant experience components grouped under `frontend/src/app/features/tenants`; no Figma file was edited |
| Subscription plans | Not fabricated: existing monthly fee, percentage discount and monthly-cycle duration retained |

Six static SVG assets are stored in `frontend/public/design`, retaining source dimensions (56, 40, 16 or 14 pixels). Open Sans is bundled from Google Fonts with its OFL license in `frontend/public/fonts`. Tenant logos remain real uploaded content, not mock organizations from the design. React Code Connect snippets were not introduced into Angular.

## Approved extensions

- Optional saved `display_name`, `country`, `time_zone`; time zones must be valid TZInfo identifiers. Workspace identifier is the immutable server-generated tenant UUID. Seat limits and enabled CPQ modules remain unavailable pending business rules.
- Password login now returns a second-factor challenge. Both platform administrators and Tenant Admins must verify TOTP; first login confirms enrollment and shows ten single-use recovery codes once. No public registration, automatic contact accounts or administrative reset UI.
- TOTP secrets are encrypted using a key derived from Rails `secret_key_base`; recovery codes are keyed digests. Keep the existing secret stable and backed up privately. Losing/changing it can make enrolled secrets unreadable. Recovery/reset operations need an approved operational policy before production.
- Single-organization Microsoft sign-in supports explicit password-verified account linking, state/nonce/PKCE and signed token verification. It never creates an account by matching email. Linked sign-in still requires local TOTP.
- Proposed development deletion policy: configurable 90-day archive retention; manual Super Admin deletion only, password reauthentication and exact company-name confirmation. Unknown retention/hold/billing/contracts/preservation checks block deletion. No scheduler deletes tenants. Production deletion is always disabled pending SELISE approval.
- Retention clearances are manual review attestations, not automated integrations with legal, billing or contract systems. Commercial edits and archive/restore invalidate relevant old clearances. Audit tombstones survive removal of the registry/schema; this is not a complete backup-retention solution.

## Configuration and startup

Forward migrations `20261026000100` and `20261026000200` add metadata, retention evidence and account security to shared platform tables. Existing tenant business schemas and existing account passwords are preserved. Do not reset databases.

For the existing isolated laptop installation, from `CPQ-Tool-integration`:

```powershell
docker compose -p cpq-integration up -d --wait --no-build db backend frontend
docker compose -p cpq-integration exec backend bin/rails db:migrate
# Stop without removing persistent data:
docker compose -p cpq-integration stop
```

Open http://localhost:14207. These ports are the ignored local environment's overrides; fresh installations use README defaults. Rebuild images after dependency changes with `docker compose -p cpq-integration build backend backend-test frontend` before startup. Existing users should enroll their own authenticator and privately save recovery codes; do not share setup keys in screenshots or chat.

Microsoft remains unavailable until an organizational Entra app is registered. Set `MICROSOFT_TENANT_ID`, `MICROSOFT_CLIENT_ID`, `MICROSOFT_CLIENT_SECRET`, and `MICROSOFT_REDIRECT_URI` only in ignored local configuration. The registered callback must exactly match `/api/v1/microsoft/callback` on the backend's browser-accessible origin (normally the same-origin Angular proxy). Use HTTPS except permitted local development loopback HTTP. No credentials or cloud resources were supplied/created. Live Microsoft sign-in has not been verified.

`TENANT_RETENTION_DAYS=90` is the development default. Invalid configuration blocks deletion. Do not treat manual review controls as stakeholder approval for production destruction.

## API additions

| Method/path | Behavior |
| --- | --- |
| GET/POST/DELETE `/api/v1/factor` | Read pending challenge, verify `{code}`, or cancel sign-in |
| GET `/api/v1/microsoft/status` | Configuration availability only |
| POST `/api/v1/microsoft/start` | Start linked login with `{account_scope}` |
| POST `/api/v1/microsoft/link` | Start explicit linking with `{password}` after authenticated MFA |
| GET `/api/v1/microsoft/callback` | Validate provider callback; generic failure grants no access |
| GET `/api/v1/tenants/:id/retention` | Eligibility date and blocking reasons for authorized reader |
| PATCH `/api/v1/tenants/:id/retention` | Super Admin review `{clearances, review_note}` |
| DELETE `/api/v1/tenants/:id/permanent_deletion` | Super Admin `{password, confirmation}`; all policy checks enforced under lock |

Review fields: `legal_hold`, `billing_resolved`, `contracts_resolved`, `retention_records_approved`, and `retention_policy_reference`. Unknown boolean values are not clearance. Existing generic tenant DELETE remains prohibited. Errors retain `{error:{code,message,fields}}`. Mutations require same-origin CSRF. Tenant listing also supports industry filtering and returns authorized summary counts, actual enabled user counts and creation timestamps. No invented seat denominator or payment processor is present.

## Verification

- Rails: **87 tests, 765 assertions, zero failures/errors/skips**, real isolated PostgreSQL test database.
- Angular: **79 tests passed**; production build passed. Two component-style size advisories remain below error thresholds; no budgets were relaxed.
- New tests cover guided review, preserved edit values, API failures, MFA enrollment/replay/recovery/lockout/concurrency, signed synthetic Microsoft tokens/linking, metadata, retention unknowns, authorization, target-schema deletion and retained audit evidence.
- Legacy domain test fixtures explicitly use password sessions; dedicated security tests enable mandatory MFA. This is not a claim that every old domain test exercises MFA.
- Live Microsoft provider, four-laptop fresh setup and stakeholder acceptance remain unverified. Production deletion, real billing/legal integrations, seat/module rules and administrative MFA recovery remain pending.

### Authenticator lockout recovery

After a ten-minute lock expires, the next submission starts a fresh failed-attempt window. A typo must not immediately renew the previous five-attempt lock. Active lockouts report remaining seconds; signing in again does not bypass them. Enrollment sessions expire after ten minutes, so cancel and sign in again after a lockout, then use the new session's setup key for unfinished enrollment. A disclosed enrollment key should be abandoned in favor of a fresh session. Completed enrollment continues to use its existing authenticator; no automatic MFA reset is performed.
