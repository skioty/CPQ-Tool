# UI refinement review — 29 October 2026

## Scope and preservation
Existing Angular/SCSS application on `feat/figma-tenant-experience`, origin skioty/CPQ-Tool. The existing navy/blue identity, Open Sans, tenant-specific branding, Rails APIs and authentication remain in place. No dependencies, backend code, migrations or environment settings were changed for this UI pass. Existing uncommitted pricing/location work was preserved; a frontend source copy and pre-existing diff are in ignored `backend/tmp/ui-before-20261029/`. Nothing was committed or pushed.

## Critique provenance
Impeccable reference guidance was read directly. Its context CLI failed because the engine was unavailable and its installation directory could not be created. There is no successful automated detector/overlay report. Two independent reviewers were authorized: A returned a source/public-browser assessment; B reported completing an assessment but hit a usage limit before delivering findings. B findings were not used. This is a manual/source/browser review, not an automated accessibility certification.

A's provisional Nielsen scores (0–4): system status 3; real-world language 3; user control 3; consistency 2; error prevention 3; recognition 2; efficiency 2; minimalist design 3; error recovery 2; help 2 (25/40). Protected routes were not visually accessible to reviewer A. Strengths: clear operational labels, existing confirmation/unsaved-change flows, focus/skip-link/reduced-motion foundations. First-time users benefit most from stable page context and sign-in guidance; keyboard/screen-reader users from explicit searchable-field descriptions; frequent administrators from restrained surfaces and shorter configuration help.

Priorities addressed: inconsistent authentication framing; unexplained invalid tenant login; missing combobox server-error/help associations; oversized security layout; competing configuration guidance; decorative form numbering; small-screen action wrapping. The requested hover/focus sidebar behavior was preserved.

Questions skipped: scope, brand constraints and sidebar preference were already supplied.

## Changed files and purpose
- `frontend/src/styles.scss`: shared contrast, neutral operational surfaces, responsive action groups, dialog bounds, browser selection/caret, tabular numbers and read-only/hover states.
- `frontend/src/app/app.html`: actual route context in the console header.
- `frontend/src/app/access/tenant-login.ts`: reuse administrator sign-in styling, password visibility, touched-field guidance, accessible busy/error states; same API/redirect handlers.
- `frontend/src/app/access/account-security.scss`: bounded, responsive security layout and wrapping setup-key controls.
- `frontend/src/app/access/access-pages.scss`: consistent access-management panels.
- `frontend/src/app/tenant/search-choice.ts`: parent error/help associations, hover and comfortable option targets.
- `frontend/src/app/tenant/tenant-field.ts`: field-specific correction guidance, searchable-field server-error propagation.
- `frontend/src/app/tenant/enterprise-accessibility.spec.ts`: regression tests for those associations and whole-number guidance.
- `frontend/src/app/tenant/reference-manager.ts`: section shortcuts to pricing/reference catalog.
- `frontend/src/app/tenant/pricing-manager.ts`: progressive disclosure for existing pricing rules, without changing them.
- `frontend/src/app/tenant/tenant-form.html`: remove redundant eyebrow and decorative section numbering; retain actual wizard steps.
- `frontend/src/app/features/tenants/_tenant-console.scss`: calmer summary sizing and mobile text spacing.
- `frontend/src/app/tenant/tenant-dashboard.scss`: consistent supporting type, brand-aware focus and interaction states.

## Coverage and limits
Shared styles affect directory/details, forms/review, setup, administrators, invitations, reference/pricing and security. Tenant dashboard retains its isolated brand variables. Existing responsive layout rules were reused rather than replacing dynamic screens.

Real local password plus TOTP sign-in was verified using an existing synthetic QA account. Public sign-in field recovery and protected directory/menu/create-form layouts were inspected. Representative widths: 390, 820 and 1440 pixels. Read-only protected routes for administrators, details, setup, invitations and saved branding were opened. Saved branding loaded from Rails and its mobile preview was checked. No tenant/domain writes, invitations, account provisioning or destructive operations were performed. Browser console initially showed no warning/error entries. Not every interaction, role, route state or assistive technology has been tested. SMTP, Microsoft sign-in, onboarding acceptance, lifecycle mutations and database/asset restart persistence were not retested in this UI task.

## Checks
Angular test suite: 109 passing tests across 13 files, including two new regression tests. Production build passed; existing stylesheet budgets and QR CommonJS warnings remain, and the initial bundle remains above its advisory 500 kB threshold. Final confirmation production build passed after the visual-only adjustments (563.71 kB initial bundle; dashboard stylesheet 5.15 kB). `git diff --check` passed. The 109-test run preceded the final decorative-number removal and dashboard/summary CSS adjustments; the final build verified those templates/styles. No separate lint script is configured.

No new approval is required for these local reversible UI changes. This report does not claim every page/state has received a complete visual acceptance review.


## Follow-up: visible structural refinement
The user found the first pass too subtle. The follow-up replaces the multi-layer shell CSS with one compact implementation, preserving hover/focus expansion and mobile navigation. It removes summary cards in favor of a compact status rail, tightens directory columns, replaces decorative row arrows with View links, flattens tenant detail/access/setup/form sections, bounds form width, and gives both sign-in forms a shared navy identity panel. Setup uses a checklist rather than an equal-card grid. Tenant dashboard sections are flatter while keeping per-tenant brand variables. Reference catalog now has case-insensitive local search over loaded label/type/code data and a bounded scroll area; it does not change server scope or permissions. Account security and invitation activation use the same restrained visual language. DESIGN.md records this refinement direction.

Source backup before this follow-up: ignored backend/tmp/ui-before-redesign-20261029/src. No backend changes or domain data writes were made. Desktop/phone directory, sign-in and create-form compositions were inspected in the browser. The first full test run had 108 passes and one 5-second timeout in the existing Figma creation-flow test; an isolated rerun and new catalog-search regression test were requested without increasing timeouts. Final outcomes are recorded below when available.

The isolated rerun passed all six Figma/security-flow tests at the unchanged timeout; the new catalog-search test also passed. The timeout case completed in 1.435 seconds in isolation. This is 108 passes in the full run plus a successful rerun of the failed case and the new regression; it is not a claim of one all-green 110-test run. Real browser catalog filtering returned only Manufacturing for a manufacturing search. Desktop/phone authentication and create forms were visually checked. Final screenshot is in ignored backend/tmp/ui-redesign-20261029/directory-desktop.png. No destructive UI actions were tested.

Final follow-up production build passed: 562.46 kB initial bundle. Advisory size warnings and QR CommonJS warnings remain. Shell stylesheet reduced from 6.18 kB to 4.40 kB. Diff whitespace check passed. No push, commit, migration or backend configuration change was performed.


## Palette follow-up
User explicitly requested replacing the whole console palette. Semantic tokens now use ivory canvas, warm-white surfaces, charcoal navigation and deep teal action/selection. Shared SCSS replaces cool-gray separators, form chrome and hover surfaces with warm neutral roles; sign-in and security use the same palette. Tenant dashboard themes remain independent and saved tenant branding is unchanged. Before-state source copy is ignored at backend/tmp/ui-before-palette-20261029/src. Desktop and 390px phone directory inspected in the live browser, with computed accent/canvas matching the new tokens and no horizontal overflow. Body contrast 12.67:1, muted text 5.78:1, action text 6.70:1, navigation text 9.08:1. Input border was darkened further after an initial 2.90:1 result. No behavior, API, data or credential changes; no test suite rerun for this stylesheet-only update. Build outcome recorded below. Nothing pushed.
Palette production build passed (563.02 kB initial bundle); advisory stylesheet/bundle-size and QR CommonJS warnings remain. Diff whitespace check passed.


## Container and consistency repair
The user reported weak panel boundaries and overflowing text. Live administrator inspection confirmed that the prior flat-panel override left a warm-white invitation panel with zero horizontal padding, unlike its adjacent account panel. Restored full borders, shared radii and 24px padding (20px on small screens) to access panels, tenant form sections and tenant detail cards. Preserved the warm palette. Added min-width/fieldset intrinsic-size safeguards, wrapping for long labels/names/codes and bounded buttons/inputs; pricing tracks now use minmax(0,1fr), and reference rows wrap actions instead of forcing wide content. Dropdowns are not clipped with overflow:hidden.

Files: access/access-pages.scss; features/tenants/_tenant-console.scss; tenant/tenant-form.scss; tenant/pricing-manager.ts (styles only); tenant/reference-manager.ts (styles only); styles.scss. Source checkpoint before edits: ignored backend/tmp/ui-before-layout-repair-20261029/src.

Verification: 110 frontend tests across 14 files passed. Browser inspected administrators, reference options, create form, tenant access and tenant details at 390/820px during the initial audit. Final checks included real long account data and reference codes at 320px, administrator panels at 1280px, tenant form at 820px. No visible-overflow containers or page-wide horizontal overflow were detected on those final checked screens. Not every route state, browser or assistive technology was tested; no domain data was modified. Diff whitespace check passed. Build outcome follows. No GitHub push.
Final repair build passed (564.29 kB initial bundle). Advisory bundle/stylesheet budgets and QR CommonJS warnings remain.


## Publication verification on 29 October 2026
The final application snapshot, including the single-column administrator and Tenant Admin sign-in screens, passed 110 Angular tests across 14 files and 106 Rails tests with 950 assertions, zero failures/errors/skips. The production Angular build passed with a 563.41 kB initial bundle; existing bundle/style-size and QR CommonJS advisories remain. Staged source was checked for obvious credential tokens and excluded runtime artifacts; environment/account files, backups and generated outputs remain ignored. The snapshot is prepared for the existing feat/figma-tenant-experience branch and PR 25; no default-branch merge is performed. Earlier no-push statements in this document describe the preceding local-only UI work.
