# Tenant access, console and durable configuration

This update extends the existing Devise cookie/CSRF, invitation, TOTP and Apartment implementation. It does not introduce public signup, automatic contact accounts, or another authentication system.

## Invite a Tenant Admin

1. Sign in as Super Admin or the tenant's assigned CPQ Admin and complete MFA.
2. Open the tenant details → Tenant access. Review the company and occupied seats.
3. Enter the recipient email, or explicitly choose **Use primary contact**. This does not grant access by itself. The role is fixed to Tenant Admin.
4. Choose email delivery or a private manual link. Review the tenant and recipient, then confirm.
5. Check the outcome. **Created** means the invitation exists. Email **sent** means the configured SMTP server accepted it, not that it reached the inbox. **Unconfigured** means no email was attempted; **failed** means the delivery attempt failed. There is no queued-delivery claim: sending is synchronous, with bounded SMTP timeouts.
6. Resend/retry creates a replacement invitation and invalidates the previous link. Revoke cancels an unused invitation. Duplicate creation is rejected; accepted membership access is separate from invitation state.

Active and Inactive, ready tenants may receive invitations, preserving the existing setup-before-activation flow. Tenant dashboard access requires Active status. Suspended, archived and unready tenants cannot issue or accept invitations. The tenant row serializes capacity changes; acceptance rechecks eligibility and occupancy.

## Recipient steps

1. Open the private invitation email/link. Its token fragment is removed from browser history before API validation. The invited company, email and role are read-only.
2. New users enter their name and a matching 12–128 character password. Existing users first follow the tenant sign-in link and complete their existing MFA, return to the invitation, and confirm using their existing password. Their password and enrolled authenticator are preserved.
3. Accept once. New users continue to tenant sign-in with the chosen credentials, then enroll an authenticator using the locally generated QR code or manual key. In Microsoft Authenticator choose **Other account**, with time-based codes.
4. Enter a valid code, save the ten one-use recovery codes privately, and continue. The intended workspace opens after MFA; it must be Active. Subsequent visits use normal sign-in and MFA, never the invitation as a login link.

The continuation token is held only in Angular service memory during sign-in/MFA. Reloading or closing the tab during that process requires reopening the original email. Tokens are hashed server-side, single-use and expire after the existing **72 hours**. Expired, revoked, invalid and already-used links show separate error messages. Incomplete MFA cannot access protected APIs. There is no unauthenticated MFA reset; use a saved recovery code. Administrative recovery policy remains outside the UI.

## Optional email configuration

In the ignored `.env`, configure `APP_PUBLIC_URL`, `MAIL_FROM`, `SMTP_ADDRESS`, `SMTP_PORT` (default 587), `SMTP_USERNAME`, `SMTP_PASSWORD` and `SMTP_AUTHENTICATION` (default plain with STARTTLS). For this integration checkout use `APP_PUBLIC_URL=http://localhost:14207`; the shared example uses port4200. Use the externally reachable HTTPS application URL for real recipients; laptop localhost links work only on that laptop. Never commit credentials or put them in chat. Recreate the backend after configuration changes. No real-contact mail is used in tests.

Email message-body logging is disabled; raw tokens are not put in background-job arguments or persisted. The authorized issuer can still privately copy the one-time link. Email-delivery status is separate from invitation lifecycle and account/membership enabled status. SMTP delivery failures have a replacement/retry action. Migration `20261027000100_extend_invitation_delivery` adds email outcome and recipient/account name columns without changing existing tokens or credentials.

## Industry management and console

Only Super Admins can permanently delete unused industries. Referenced industries return a conflict with deactivation guidance; disabled options stay attached to existing tenants and disappear from new choices. Tenant writes hold a shared catalogue-row lock until commit; deletion/deactivation takes an exclusive lock. Account audit events record deletion and option state changes. Reference lists refresh after successful changes.

The platform label is **CPQ console**. Account security/logout stay in the header. Desktop navigation starts as an icon rail and expands automatically when a mouse/pen enters or keyboard focus moves inside; it collapses after both leave. Expansion overlays the content rather than moving it. Icon links retain accessible names and native tooltips. The previous manual-arrow/localStorage preference is no longer used. Mobile uses the existing menu with a drawer overlay and Escape dismissal. Tenant settings remain database-backed.

Saved tenant branding uses the existing dashboard, scoped colours and accessible foregrounds. Authenticated workspace reload applies its saved name, logo, favicon, typography and colours; the browser title/favicon reset while loading, switching, leaving or logging out. Only the membership-authorized API supplies settings and assets. Country/time-zone/currency metadata is returned without exposing subscription fees, staff assignment or platform retention controls.

## Persistence and backup

Structured tenant settings **and logo/favicon binary content** live in PostgreSQL (`public.platform_brand_assets.content`). There are no tenant uploads held solely in a backend container layer and no asset migration is required. Preserve the existing `cpq-integration_postgres_data` named volume. Source-mounted `backend/tmp/local_secret.txt` (Rails development secret) also needs to persist for existing encrypted MFA secrets; production must supply a stable, private `SECRET_KEY_BASE` through its environment/secret manager. Rotating it requires an account-security migration/recovery plan.

Locate Docker-managed data (do not manually edit it):

```powershell
docker volume inspect cpq-integration_postgres_data
```

Create a private backup from the integration checkout (contains sensitive account data; keep ignored/local):

```powershell
docker compose -p cpq-integration exec -T db sh -c 'pg_dump -U "$POSTGRES_USER" -Fc "$POSTGRES_DB" -f /tmp/cpq-backup.dump'
docker cp cpq-integration-db-1:/tmp/cpq-backup.dump backend/tmp/cpq-backup.dump
```

Restore **only into a new empty local database**, never overwrite the running database:

```powershell
docker cp backend/tmp/cpq-backup.dump cpq-integration-db-1:/tmp/cpq-restore.dump
docker compose -p cpq-integration exec -T db sh -c 'createdb -U "$POSTGRES_USER" cpq_restore_verification'
docker compose -p cpq-integration exec -T db sh -c 'pg_restore -U "$POSTGRES_USER" -d cpq_restore_verification /tmp/cpq-restore.dump'
```

The restore commands are guidance, not claimed tested recovery. A database backup includes current logo/favicon bytes. Back up the stable application encryption secret separately and securely. `docker compose stop` and `docker compose down` preserve named-volume data. **`down -v`, `docker volume rm`, volume-prune commands and database reset/drop tasks can remove data; do not use them for normal startup.** No such destructive command was run.

## Start and stop this local application

Run from `CPQ-Tool-integration`:

```powershell
docker compose -p cpq-integration build frontend
docker compose -p cpq-integration run --rm backend bundle exec rails db:migrate
docker compose -p cpq-integration up -d --wait --no-build db backend frontend
# Open http://localhost:14207
docker compose -p cpq-integration stop
```

Tenant schema migration coordination remains unchanged: this new migration changes public/shared tables only. Use the existing `platform:migrate_tenants` task for tenant-local changes.


## Changed implementation and verification — 27 October 2026

Frontend: App shell/console navigation; ReferenceManager; TenantInvitations; InvitationAccept and its in-memory continuation service; tenant login/MFA verification; TenantWorkspaces browser branding; existing tenant-details action and route titles. Added locked `qrcode`1.5.4 and TypeScript types; QR generation stays local and lazy-loaded, using the library's [documented browser API](https://github.com/soldair/node-qrcode#browser).

Backend: reference-option deletion/guard and business-rule row locking; Invitations service/controller and acceptance controller; InvitationMailer/InvitationDelivery and mail configuration; workspace metadata response. Public migration `20261027000100` and SQL structure updated; no existing migration was rewritten. Compose forwards optional SMTP settings; no new upload store is needed because current image content is database-backed.

Executed checks:

- Complete Rails suite: **102 tests, 897 assertions, zero failures/errors/skips**. Includes industry authorization/reference retention/concurrent selection locking, invitation assignment/eligibility/capacity, controlled test email success/failure/missing configuration, replacement/revocation/expiry/single-use concurrency, new-user names, matching existing-user MFA session, credential preservation, existing replay/recovery and schema-isolation checks.
- Complete Angular suite: **90 tests passed** in the Linux container. Includes confirmation/email feedback, sidebar preference, existing forms and saved/draft dashboard tests. Workspace tests also verify title/favicon reset and favicon content-type handling; focused rerun recorded below.
- Production frontend build passed: about530kB initial, with existing bundle/style budget advisories and CommonJS QR-library advisories; budgets were not weakened.
- Recreated database/backend/frontend containers without removing volumes. Compared all records/asset bytes in six settings tables before/after: identical, including **five saved assets**. Two existing encrypted MFA records remained decryptable with the preserved local application secret. A private pre-check database dump is stored in ignored `backend/tmp`.
- Confirmed mail message-body logger disabled and local SMTP unavailable. Email tests use the Rails test adapter and synthetic `.invalid` recipients; no real-contact invitation was sent. Actual SMTP acceptance/inbox delivery remains unverified.
- Local HTTP application returned200 and services were healthy after recovery from an initial Angular compile error; that corrected error was caught by tests. Native Windows frontend tests were unavailable because of temporary-file rename permissions; the documented Docker tests passed instead.
- Chrome visual inspection could not complete: the available window was minimized and activation timed out. Desktop/mobile appearance, real QR scanning and a human recipient walkthrough remain manual acceptance checks; automated DOM/request tests are not claimed as visual proof.
- `npm audit` reports an existing Angular build-tool dependency chain (`@angular/build` → `undici`7.29.1), with one high and one moderate package finding. QR dependencies are not the affected path. A compatibility-reviewed build-tool patch/override remains follow-up; no forced major Angular upgrade was applied.

The increment is local and reviewable. No GitHub push, merge, release, production resource or destructive volume/database reset was performed by this update.
