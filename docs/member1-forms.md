# Member 1 tenant form delivery

## Inspection and branch dependency

Verified remote `skioty/CPQ-Tool`, default `main`, clean starting working tree, and no AGENTS.md in the repository. Read README, CONTRIBUTING, requirements, API contract, architecture, decisions and sprint plan. At implementation start `main` contained only the bootstrap README; setup PR #16 was still open. `feat/tenant-forms` starts from verified `origin/main` and fast-forwards through the setup branch as an explicit dependency. Do not merge the feature before setup review/merge. No backend or dependency changes are included in Member 1's increment.

Actual issues: #3 (shell/shared controls), #9 (forms/contacts/branding), #8 (Member 2 APIs) and #10 (Member 4 navigation). Coordination notes were posted on these issues before shared route/style work. They are proposals awaiting peer confirmation, not evidence that other members approved a contract. No member usernames were guessed. Member 4 reviews this frontend change.

## Implemented independent UI

- Shared shell, skip link, reusable field control and responsive create/edit form.
- All requested company, subscription, assignment and branding fields. Reference selectors contain no invented business options. Fee/discount/duration retain string values without numeric conversion or assumed units.
- Add/remove contacts and native radio selection; exactly one primary is the confirmed invariant. Removing a primary never silently promotes another contact. Email syntax is checked only when entered; additional requiredness comes from configuration, never guessed.
- Edit adapter loads complete saved settings; incomplete responses fail rather than resetting missing fields. Contact identifiers and unchanged asset IDs are preserved. Outgoing payloads explicitly allowlist management fields; no schema names, roles or lifecycle/provisioning states are submitted.
- Loading/saving/success/error states, disabled controls during requests, field errors in a focused summary, retry after load errors, retained drafts on API failure and duplicate-submit prevention.
- Local selected-file previews with object-URL cleanup. File-type detection controls browser preview capability only; it is not a server upload restriction. No file is uploaded by default. Existing assets are not deleted by canceling a replacement selection.
- Draft branding preview and separate saved-settings preview; saved settings never derive from unsaved draft state. Approved typography and asset URL adapters supply safe display references; no remote font CSS or asset URL pattern is guessed.
- Unsaved-change navigation confirmation; contact/assignment/file interactions mark drafts dirty. No invitations, user-account conversion, list/detail screens, lifecycle actions or backend changes.

## Proposed route reservations for Member 4

`/tenants/new`, `/tenants/:id/edit`, `/tenants/:id/branding`. Empty-root navigation currently opens the create form. The route file has a clearly bounded Member 1 section; Member 4 owns future list/detail navigation and should review the root destination and fallback before integration. A saved preview link is shown only when a saved identifier exists.

## Integration gates for Members 2 and 3

The API document remains **proposed**. Rails currently exposes only `/up`. Production configuration defaults to a clearly labelled draft workspace with saving disabled. No application mock, fake success, localStorage persistence or test reference catalogue is shipped.

`TenantGateway` isolates the proposed same-origin GET/POST/PATCH endpoints and `{tenant: ...}` / `{data: ...}` envelopes. Confirm complete detail/save responses (including nested settings), contact replacement and ID semantics, string/null conventions, 201 versus asynchronous 202 behavior, validation field paths, concurrency/idempotency and reference-data transport before enabling it. Incomplete or network-failed save responses can have ambiguous persistence outcomes; the backend must define safe retry/idempotency before production use.

Supply `FORM_OPTIONS` through Angular DI with approved industry/currency/admin/font/payment/discount choices, required field paths, administrator cardinality, duration label and explicit `contractApproved: true` only after review. Reference values must come from approved server data; resolve them before instantiating the form. Empty selectors stay disabled, but current saved IDs remain visible and round-trip unchanged. The initial unchecked company-name display and blank draft values are presentation state, not agreed backend defaults. Confirm these at contract review.

Supply `ASSET_UPLOAD(kind, File): Observable<{id,url?}>` after Member 2 agrees transport, authentication, size/MIME/content/dimension restrictions and attachment ownership. Supply `ASSET_URL(id)` to display saved authorized assets. There is no fabricated upload endpoint. Successful upload IDs survive a later save failure, avoiding repeat uploads on retry; partial failure retains remaining selections. Unattached asset cleanup/expiry remains a backend policy dependency. Server validation remains authoritative.

Member 3 must integrate the chosen administrator session, CSRF handling and server authorization. This change neither creates an authentication bypass nor declares the UI route an authorization boundary. Configure a reviewed same-origin development proxy/deployment mapping with Members 3 and 4; the Angular dev server is not the Rails API. No proxy/session transport is silently assumed.

Discount semantics, billing interval, currency precision/behavior, required fields, assignment cardinality, font catalogue and upload restrictions remain open in decisions.md. Existing API/architecture documents are not silently promoted to approved contracts.

## Verification

Tests use synthetic fixtures and HTTP test doubles only, not a running mock service. Coverage includes primary contact zero/multiple/switch/removal interactions, configured validation, edit preservation, allowlisted payloads, loading failures, 422/401/403/409/network/server errors, duplicate submission, upload gating/retries, and separation of saved/draft preview settings. Test/build results and browser checks are recorded in the draft PR after execution. No create/edit/upload flow has yet been verified against real tenant APIs.

Target days remain relative: independent Day 2 form work is feasible now; Day 3 API and Day 4 upload integration depend on the decisions and backend described above. No delivery date or member availability is assumed.
