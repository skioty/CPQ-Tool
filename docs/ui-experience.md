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
