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

Angular production build and 51 frontend tests passed during implementation. Rails tests also passed: 51 tests / 367 assertions with one worker, then 51 tests / 368 assertions with two workers after correcting the foundation database-name assertion. The first database preparation attempt exposed PostgreSQL public-schema dump loading; a pinned-Rails dump normalization changes only CREATE SCHEMA public to IF NOT EXISTS for reproducible SQL loading.

Reviewers: Member 1 frontend; Members 2/3 business/access/shared migrations; Member 3 infrastructure. Required peer review and acceptance remain pending. No release or stakeholder acceptance is asserted.

## Executed browser evidence

Disposable Rails development server, PostgreSQL database and Angular proxy, using synthetic accounts and industry only:

- Created a real tenant from Angular with two contacts and one primary; list/detail showed inactive and ready.
- Edited description, monthly fee 100.00, Other payment description, percentage discount 10 and duration two monthly cycles; API returned saved values.
- Uploaded a generated 32px PNG logo, saved and opened the saved preview; authorized image loaded with natural width 32.
- Opened activation dialog: Cancel received initial focus; Escape canceled and restored focus to Activate. Confirmed activation, archive and restore; restored status was inactive with original contacts/subscription/asset reference retained. All transitions/role denials are additionally covered by request tests.
- Narrow detail layout had no horizontal overflow. This is not all-device or four-laptop sign-off.

CI initially failed only the inherited foundation assertion because the suite now crosses Rails' parallel threshold (numbered worker DBs). The assertion now accepts only the configured test DB or its numbered workers; a two-worker local run passes. See PR #21 for final CI status. Functional implementation commit f4b3b1f; parallel-test/UI wording follow-up 81997b4. Later documentation/encoding normalization does not change business behavior.

Remaining operational work: SELISE industry values, controlled local administrator provisioning, Member 1/2/3 peer review, each laptop setup verification and stakeholder acceptance. Future billing must set first_invoiced_at; invitations and invoice/payment engines remain excluded. No policy gate remains merely because the final table originally used recommendation wording.

Final CI on 81997b4: Frontend and Backend passed: https://github.com/skioty/CPQ-Tool/actions/runs/39992995867 . Final local frontend rerun passed production build and 51 tests after wording/encoding fixes. Narrow form had zero unlabeled controls and no horizontal overflow. Temporary browser tab, synthetic credential file, image/helper files, application containers and isolated PostgreSQL container/anonymous volume were removed after verification. No existing development database was migrated or reset.
