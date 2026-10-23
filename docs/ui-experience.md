# Tenant experience redesign

This frontend-only increment builds on approved-rule PR #21. Angular/Rails API contracts, authentication, authorization and lifecycle policies remain unchanged. It is a visual/interaction redesign, not a production-readiness claim.

## Design

A consistent navy/coral workspace, real signed-in role, active navigation, page titles and a responsive sidebar replace the scaffold header and prototype badge. Directory rows use actual authorized API records and pagination, contact counts, primary contacts, monthly subscription display and text-labelled status badges. No invented platform metrics, customers, dates or activity are shipped.

Company overview groups company information, contacts/owner, branding and commercial settings. User-facing asset/admin UUIDs and implementation explanations are removed. Owner/reference labels come from existing reference data, with honest fallbacks when unavailable. Permissions still come from the backend.

The reusable form is ordered Company → Contacts → Branding → Subscription, with same-page section navigation, contextual payment/discount fields, a sticky save area and live branding preview. No field is dropped from persistence. Technical validation paths become readable field labels; existing validation and unsaved-draft safeguards remain. Branding preview chooses black/white text contrast for saved hex colours.

Sign-in, reference options, saved preview, empty/error/loading states and lifecycle confirmations share the design. No placeholder controls, mock dashboard statistics, registration or password-reset service is introduced. Contact entry still does not grant user access.

## Verification

The first production build and all 51 existing frontend tests passed; final checks and browser results are recorded after verification. Shared directory styles compile once instead of being duplicated for list/details. Existing component-style advisory budgets are not weakened; any remaining build warnings are reported.

Visual checks use an isolated disposable database, generated example.invalid accounts and synthetic company/reference fixtures. They are not real customer records or default application seed data. Local preview ports are 14206/13006 for this test only. Four-laptop and stakeholder review remain pending. Member 1 reviews frontend changes; Member 4 coordinates demonstration evidence.

## Final executed evidence

- Production build passed; the new SVG favicon is present in dist/frontend/browser. Initial bundle about 422 kB (below the existing 500 kB warning budget). Two component-style advisories remain: form 6.50 kB and shell 5.00 kB against the 4 kB advisory threshold; both remain below the 8 kB error limit. No budget was increased.
- All 52 frontend tests passed, including create-to-edit navigation, contacts, saved-value/asset preservation, permissions-derived actions and readable validation errors. Backend source and dependency locks are unchanged; the PR's normal Backend CI remains required.
- Real Rails/Devise browser login, authorized directory, section navigation with retained input, mobile tenant creation and automatic saved edit URL verified. A reload now retains the created tenant context. 1440px desktop and 390px mobile form checks showed no horizontal overflow and zero unlabeled inputs. This is not a complete WCAG audit or all-device sign-off.
- Synthetic preview: localhost:14206 (Angular) / localhost:13006 (Rails), isolated cpq_ux_demo database in cpq-ux-db. Sample companies are fixtures, not actual clients or production seed data. A generated local administrator session is used for visual review. No production data or resources were used.
- Preview containers cpq-ux-ui, cpq-ux-server and cpq-ux-db are left running for user review; they can be stopped with docker stop followed by their exact names. Temporary credential/helper files are removed at handoff. After the demo session expires, use controlled account provisioning from the Member 3 handoff with your own runtime credentials.

Review: draft PR #22, dependent on approved-rule PR #21. Member 1 reviews frontend. No PR merged, release tagged, repository protections changed or stakeholder acceptance claimed.

## Local enterprise polish follow-up

Local branch `ui/enterprise-polish` starts from the verified integration branch at fb5ac2a. It reuses Angular standalone components, native controls/dialogs, SCSS, existing APIs and the navy/coral identity. No second component framework or package was added. Backend source, dependency locks, authentication, authorization, provisioning, lifecycle transitions and commercial validation are unchanged.

Changes: readable type and higher-contrast secondary text; semantic colour/spacing/control tokens; consistent 44px controls and focus states; restrained shell/page spacing; a compact mobile navigation disclosure with Escape handling; route focus management that preserves fragment navigation; responsive list/detail grids and long-value wrapping. Directory no-data and filtered-no-results messages now differ, with a real Clear filters action using existing query parameters. No metrics or sample activity were invented.

Forms retain all fields and existing payloads/unsaved-draft protection. Required controls expose aria-required; local and server field errors are associated through aria-invalid/aria-describedby; contact/admin errors appear beside inputs. Decimal inputmode preserves exact string values. Upload file pickers advertise the existing accepted types, while server validation remains authoritative. Saving disables controls and hides Cancel until the server responds. Cancel uses the existing navigation guard. Saved branding still chooses readable foreground text for custom hex colours. Lifecycle dialogs describe the approved access/retention consequences and name the affected company; restricted actions use the danger treatment. Existing native dialog focus restoration remains.

Updated areas: shell/navigation; directory/details and lifecycle dialog; shared TenantField and reusable TenantForm; reference configuration; sign-in; saved branding frame; shared styles. Five additional tests cover navigation disclosure, filtered-empty recovery, accessible field errors, decimal keyboard/string preservation and custom-branding contrast. The existing 422 test also checks inline contact errors.

### Executed checks and limits

- Production build passed, approximately 429 kB initial bundle, below the unchanged 500 kB advisory. Two existing component-style advisories remain: form about 5.05 kB and shell about 4.81 kB against 4 kB warning / 8 kB error thresholds. Budgets were not relaxed; both are smaller than the original redesign styles.
- Full frontend suite: 57 tests in seven files passed without unhandled errors. An interim test run found stale empty-state wording; another found an asynchronous RouterLink test teardown problem. Both were corrected before the passing rerun. No lint script is configured, so no lint pass is claimed. Existing Prettier was used for changed sources.
- Browser: list/detail/form reflow checked at 375, 768, 1280 and 1440px, with no page-level horizontal overflow. Form additionally checked at 640px (equivalent layout width for 200% zoom on a 1280px viewport); actual browser zoom and a complete screen-reader/WCAG 2.2 audit were not verified. Form inputs had no missing labels. Long synthetic contact name/email were used.
- Real Angular/Rails/PostgreSQL: invalid form summary focus, create with two contacts/exactly one primary, saved edit route, description edit, saved white-secondary branding with black text, search with no results and Clear filters recovery. Existing saved logo remained visible. Synthetic data only, in cpq_integration_development. Upload byte validation/replacement/error handling are covered by existing tests and the earlier local integration HTTP evidence; no new browser file-picker claim is made.
- Dialog: Cancel initial focus, Escape dismissal, focus return to the originating action verified. Full transition/permission/schema-isolation tests remain the backend owner's responsibility; backend source was unchanged in this UI task and its suite was not rerun unnecessarily.
- Screenshots outside Git: enterprise-before.png, enterprise-after.png (same existing company), enterprise-directory.png and enterprise-mobile.png in the task artifact folder. Mobile full-page screenshot capture was unavailable; a viewport screenshot was saved instead.

Preview remains http://localhost:14207 with the isolated integration database and ignored local demo credentials. From this integration folder, start with `docker compose -p cpq-integration up -d --wait --no-build db backend frontend`; stop with `docker compose -p cpq-integration stop`. Build/test: `docker compose -p cpq-integration run --rm frontend npm run build` and `docker compose -p cpq-integration run --rm frontend npm test -- --watch=false`.

No push, deployment, main merge, paid resources or GitHub update. Four-laptop, peer and stakeholder acceptance remain pending. This is demonstration polish, not certification or a production-readiness claim.

Final live check: deactivation and activation both returned server-confirmed success through the refreshed dialogs; the original synthetic tenant was returned to Active. Reference configuration also reflowed without overflow at 375/768/1440px. The final mobile sign-in heading spacing was verified after removing forced line breaks. Browser console error inspection returned no entries for the current page. Temporary viewport overrides were reset. Production build and 57-test suite passed after the required-label refinements; the final copy-only sign-in change was also production-built. Formatting verification and final diff review are recorded in the local commit.
