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
