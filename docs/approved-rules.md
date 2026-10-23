# Approved-rule implementation handoff

The user confirmed the final decision table and lifecycle matrix. This branch implements these requirements on top of the unmerged Member 1–4 integration; do not confuse historical handoff gates with current policy.

## Setup and reference options

Follow root Docker commands; rebuild backend for the ImageMagick decoder. Run `rails db:prepare` and `rails db:seed` through Compose. New public migration `20261023000100` adds payment description, first-invoice guard marker, optional phone, reference options and private branding assets. Existing migrations are unchanged. These shared models are excluded from Apartment tenant cloning; existing tenant schemas need no change for this migration. Member 2/3 review is required before teammates migrate development data.

Provision Super Admin/CPQ Admin through the existing runtime-credential `platform:provision_admin` task; no passwords are seeded. At `/reference-options`, Super Admin adds SELISE-provided industries and enables/disables global options. No industry names are fabricated. Currency defaults BTN/INR/USD/EUR; payment defaults Bank Transfer/Other. Typography is developer-maintained system sans-serif/Georgia serif. Technical colour defaults are #17365D/#2563EB.

## Boundaries

Required setup before activation means all approved required fields/eligible assignment/reference rules, one primary contact, valid commercial/branding settings and ready provisioning. Platform management remains available across statuses to authorized staff. Tenant-user accounts/invitations are not implemented; contact records never grant access. TenantContext blocks non-active workspace access. No permanent deletion, automated billing, invoice issuance, conversion or future CPQ module is added.

Money remains PostgreSQL numeric, validated without rounding invalid input. Fee cap is the approved technical limit, not a commercial price. First-invoice currency guard is tested using a trusted server marker; billing integration must set that marker when introduced. Lifecycle changes never alter charges. Discount settings express percentage and monthly-cycle duration; no billing scheduler is claimed.

Assets use generated tenant-prefixed logical storage keys and PostgreSQL byte storage, with transactionally bound metadata. Decoder validates actual PNG/JPEG/WebP/ICO bytes and dimensions, ignoring supplied MIME/name. Old/unreferenced assets remain retained; explicit removal clears branding reference, not audit/history. No external storage resources are needed. Successful uploads followed by failed tenant save remain staged for retry; abandonment can retain staged bytes and needs a reviewed cleanup policy before production.

## Validation and review

Angular production build and 51 frontend tests passed during implementation. Backend validation and full browser verification are recorded after execution below. The first database preparation attempt exposed PostgreSQL public-schema dump loading; a pinned-Rails dump normalization changes only CREATE SCHEMA public to IF NOT EXISTS for reproducible SQL loading.

Reviewers: Member 1 frontend; Members 2/3 business/access/shared migrations; Member 3 infrastructure. Required peer review and acceptance remain pending. No release or stakeholder acceptance is asserted.
