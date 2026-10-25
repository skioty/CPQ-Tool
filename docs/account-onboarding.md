# Guided setup and explicit account access

This local increment extends the earlier contact-only scope with the user's approved invitation policies. Contacts remain contacts unless someone explicitly invites their email address. No public registration or automatic account creation from contact changes exists.

## Implemented behaviour

- `/tenants/:id/setup` reviews persisted company, contacts, assignment, subscription, branding and provisioning checks using existing backend validation. Activation is offered only when both readiness and backend permissions allow it. Edit links return to the relevant form section.
- `/administrators` is restricted to Super Admins. They create CPQ Admins through activation email, edit display names, and enable/disable activated accounts. Email is immutable after creation. Super Admin provisioning stays outside this UI. Self-deactivation, Super Admin modification and permanent deletion are blocked. Reassign a staff member's tenants before disabling that member.
- `/tenants/:id/access` lets Super Admins and assigned CPQ Admins explicitly invite Tenant Admins, inspect memberships, and resend or revoke unused invitations. The activity history records tenant invitation actions. The invitation list returns the latest 100 records; it is not a complete audit export.
- Links expire after 72 hours, are single use, and are stored only as SHA-256 digests. Resend rotates the token. Acceptance is locked transactionally, including concurrent requests.
- New users set a 12–128 character password with confirmation. An existing tenant account must authenticate with its current password to accept another membership; an invitation cannot reset that password.
- `/tenant-login` and `/workspaces` use a separate Devise identity scope. Tenant users receive only enabled memberships and can open their own Active, ready, migration-current workspace. Shared membership authorization happens before switching to the trusted registry schema identifier. Connection context resets after errors and success.
- Tenant workspaces show saved branding and company information. Future CPQ modules, tenant-side user administration, password recovery, SSO and custom role management are not implemented by this increment.

## Email configuration

Delivery uses SMTP, not a publicly displayed activation link. Put these settings directly in the ignored `.env` file:

| Setting | Meaning |
| --- | --- |
| `SMTP_ADDRESS` | Provider's SMTP hostname |
| `SMTP_PORT` | Provider's port, normally 587 with STARTTLS or 465 with TLS |
| `SMTP_FROM` | Provider-approved sender address |
| `SMTP_DOMAIN` | Provider's HELO domain when required |
| `SMTP_USERNAME`, `SMTP_PASSWORD` | Provider credentials; never commit or paste into issue reports |
| `SMTP_AUTHENTICATION` | Provider-supported mechanism; defaults to `plain` |
| `SMTP_TLS_MODE` | `starttls` or `tls`, according to provider |
| `APP_PUBLIC_URL` | Browser origin, currently `http://localhost:14207` for this isolated local application |

Restart the backend after configuration: `docker compose -p cpq-integration up -d --wait --no-build backend`. Localhost email links open only on this laptop; other recipients need an appropriately hosted HTTPS origin. No hosting or mail-provider account is created here.

Sending is blocked when required settings are absent. SMTP failures return an explicit delivery error and retain a failed invitation/pending account for recovery; resend retries with a new token. SMTP acceptance does not prove inbox delivery. Do not retry automatically after an ambiguous transport failure. Tokens in email URLs use the browser fragment and are cleared from the address bar before API validation; mailer debug-body logging is disabled.

## Persistence and transaction boundaries

The forward migration `20261025000100_add_explicit_account_invitations` adds shared public account, membership, invitation and account-event records. Existing staff passwords and enabled flags are preserved; existing staff receive an activation timestamp. These shared models are excluded from Apartment schema cloning. The existing schema strategy and tenant business migrations remain intact.

Invitation issuance commits its database transaction before synchronous SMTP delivery. Failed delivery is recorded separately and does not report success. Acceptance creates/enables the membership and consumes the token in one database transaction. It does not provision a schema; workspace access uses the existing readiness/migration checks. Archiving retains memberships and prevents workspace access through the existing lifecycle gate.

Apply migrations only to the intended local database with `docker compose -p cpq-integration run --rm backend bundle exec rails db:prepare`. Do not use reset/drop tasks. Start with `docker compose -p cpq-integration up -d --wait --no-build db backend frontend`; stop without discarding data with `docker compose -p cpq-integration stop`.

## Verification record

On this increment: Rails **64 tests, 514 assertions, no failures/errors/skips**; Angular **71 tests, no failures**. Coverage includes permissions, explicit invitation acceptance, expiry/reuse, SMTP failure recovery, concurrent single-use acceptance, two-schema access, CSRF, authoritative setup gating and UI request cancellation. Automated mail tests use ActionMailer test delivery, not live SMTP. Existing tenant and isolation suites remain included.

Live SMTP delivery and inbox/link testing remain blocked by missing provider configuration. Team review and stakeholder acceptance remain outstanding. No GitHub push, merge, release or deployment is part of this local increment.

Production build passes (455.33 kB initial assets). Angular reports non-failing component-style budget warnings for the tenant form and application shell; budgets were not weakened.

Browser verification against the running Rails/PostgreSQL backend covered existing Super Admin login, both preserved tenants, staff listing/assignment restrictions, the six saved setup checks, activation confirmation and Escape dismissal, and tenant invitation SMTP-unavailable states. The setup and invitation layouts were inspected at desktop and 375px mobile width; the setup page had no horizontal overflow. No tenant status or existing password was changed. New-account email acceptance was verified automatically with test delivery, not through a real inbox.
