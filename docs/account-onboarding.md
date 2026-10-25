# Guided setup and explicit account access

## Current delivery policy

The user replaced SMTP email delivery with **private, copyable invitation links**. No SMTP service, mail credentials or email sending is required. This supersedes the earlier email-delivery decision.

Super Admins create CPQ Admin staff accounts and receive a single-use activation link. Super Admins and assigned CPQ Admins create explicit Tenant Admin invitations. Share each link privately with its intended recipient. Contacts never gain access automatically.

Links expire after 72 hours. A replacement invalidates previous unused links. Unused invitations can be revoked. An accepted invitation cannot be revoked to remove account access. Only the token digest is persisted; the raw token is returned once to the authenticated issuing administrator, in a no-store response. History endpoints never return raw tokens. The UI keeps the link in component memory only, provides Copy/Dismiss, and clears it on navigation or another operation. Clipboard failure offers manual selection rather than claiming it copied.

For this local application, links start with `http://localhost:14207` and work on this computer. Other people cannot open your laptop's localhost from their laptops. A shared HTTPS deployment is a separate task. Never post links in GitHub, screenshots, logs or public messages. Losing a link requires generating a replacement.

## Implemented screens and account policies

- `/tenants/:id/setup` reviews saved company, contacts, assignment, subscription, branding and provisioning checks using existing backend validation. Activation requires both readiness and backend permission. Edit links open the relevant form section.
- `/administrators` is restricted to Super Admins. They create CPQ Admin activation links, edit display names and enable/disable activated accounts. Email is immutable after creation. Super Admin provisioning stays outside this UI. Self-deactivation, Super Admin modification and permanent deletion are blocked. Reassign all tenants before disabling their responsible staff member.
- `/tenants/:id/access` lists explicit memberships and the latest 100 invitations, with create/replace/revoke controls. A contact email is not invited without this separate explicit action.
- `/invitations/accept#token=...` clears the fragment before API validation. New accounts set a matching 12–128 character password. Existing tenant users authenticate with their current password; invitations cannot reset it. Acceptance consumes the token and updates account/membership records in one transaction with row locking.
- `/tenant-login` and `/workspaces` use a separate Devise scope. Enabled tenant users can open only their own enabled memberships in Active, ready, migration-current workspaces. Authorized staff retain the existing lifecycle and management policies.
- Tenant workspaces show saved branding and company information. Future CPQ modules, tenant-side user administration, password recovery, SSO and custom permissions remain outside this increment.

## Persistence and compatibility

Migration `20261025000100_add_explicit_account_invitations` introduced public account, membership, invitation and account-event records. Existing staff passwords and enabled flags were preserved. No new migration or database reset is required to switch delivery modes. The existing `delivery_status = sent` value now means successfully issued; it does not claim email delivery. Historical pending/failed invitations remain unusable until replaced.

Staff creation and invitation issuance now commit atomically. Invitation acceptance creates/enables membership and consumes the token transactionally. It does not provision a schema. Shared models remain excluded from Apartment cloning; membership authorization precedes trusted schema switching, and connection context resets after success and errors. Archiving retains membership and blocks workspace access through the existing lifecycle gate.

## Local operation

From the integration folder:

```sh
docker compose -p cpq-integration up -d --wait --no-build db backend frontend
docker compose -p cpq-integration stop
```

The stop command preserves data. Existing ignored environment files and demo credentials remain local. SMTP variables are no longer forwarded or included in `.env.example`. No outbound email is sent.

Build/tests:

```sh
docker compose -p cpq-integration run --rm frontend npm run build
docker compose -p cpq-integration run --rm frontend npm test -- --watch=false
docker compose -p cpq-integration --profile test run --rm -e PARALLEL_WORKERS=1 backend-test
```

See the API contract for response shapes and the UI experience document for final verification evidence. Team review and stakeholder acceptance remain outstanding. Nothing is pushed, merged, released or deployed by this local task.

## Executed verification for manual links

Rails: 64 tests / 524 assertions / no failures, errors or skips. Angular: 73 tests passed. Production build passed (~460.92 kB initial assets); two existing shell/form style advisories remain. Automated tests use real PostgreSQL, including schema access and concurrent single-use consumption. No mail provider, mock transport or outgoing message is involved. Browser UI checks and their limits are recorded in ui-experience.md. Team review and a recipient walkthrough remain next steps.
