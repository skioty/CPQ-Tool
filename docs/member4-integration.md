# Member 4 integration handoff

## Inspection and branch

Confirmed skioty/CPQ-Tool, default main, clean starting worktrees and no AGENTS.md. Read source, README, CONTRIBUTING, requirements, architecture, decisions, sprint, API/workflow and tracking documents. Main remains bootstrap-only; #16–#19 remain open dependencies. This branch starts from verified main, fast-forwards Member 3's backend and merges Member 1's frontend, preserving all original commits. The two documentation conflicts were resolved by retaining backend facts and adding Member 1's handoff. No feature was merged to main or another member's branch.

Member 4 owns list/detail/navigation and evidence. Member 1 reviews frontend/shared gateway changes; Member 3 reviews session/Compose integration; Members 2/3 remain owners of backend defects/policies. Coordination notes are on actual #10/#12/#13/#15. No assignees/usernames guessed. User confirmed lifecycle policy is **not approved**.

## Implemented

- Real API tenant list, submitted company-name search, bounded page navigation, request cancellation, loading/empty/error/retry states. Status selector accepts only approved injected choices and is disabled by default because the catalogue is missing.
- Full saved details: company/display flag/description, contacts/primary, responsible administrator references, branding/asset references, subscription decimals and lifecycle/provisioning statuses. Unknown reference labels are shown as identifiers, never fabricated names; absent values are identified as unset. No currency conversion, cadence or discount units assumed.
- Routes /tenants, /tenants/:id, /login plus preserved Member 1 /tenants/new, /tenants/:id/edit and /tenants/:id/branding. Default route now opens tenant list. Navigation respects the agreed role contract for create visibility; backend remains authoritative. Existing forms' unsaved-change guard remains.
- Real Devise login/current identity/logout integration and CSRF interceptor for relative /api paths only. Password cleared after each attempt, token stored in memory, identity cleared on 401, no automatic mutation retries. Logout performs a fresh navigation to clear rendered private data/drafts. A stale startup session response cannot overwrite a newer login.
- Native modal confirmation component with labelled title, safe initial Cancel, Escape cancel event and focus restoration. No production lifecycle buttons/actions are exposed: DIRECTORY_POLICY defaults empty, no transitions/archive/deletion policy is invented. Tests inject explicitly synthetic capabilities only. Future backend-approved action labels/confirmation/permissions must be supplied before enabling; confirmation failures preserve details and route changes cancel stale action responses.
- Member 1 gateway compatibility: nullable API fields normalize for form display; unchanged nulls are preserved on edit. Asset IDs remain intact. GET/POST/PATCH ETags are retained and PATCH sends If-Match; edit without a loaded version fails. Missing full response keys still fail rather than silently blanking settings. Member 1 must review null/blank semantics before enabling writes, particularly deliberate false/blank changes from an originally null value.

No runtime mock, fake reference list, localStorage persistence, fabricated lifecycle outcome or unapproved write configuration. Form saving and uploads stay gated. Session integration does not enable Member 2 business rules. Synthetic acceptance records, if used for list/preview evidence, are explicitly fixtures rather than successful UI/API creation.

## Environment and CI

Reuse the existing Compose services, pinned lockfiles, PostgreSQL persistence/health checks and separate test service. Member 3's same-origin proxy remains configured; no cloud or Kubernetes resources. Existing Frontend/Backend workflows run the combined tests, including Member 3 isolation tests, without placeholder jobs or duplicate workflows. Review the existing /api proxy after any native/container port change. Native frontend needs a localhost backend target; Docker uses backend:3000.

While main is bootstrap-only, fetch and check out feat/tenant-navigation before following root startup instructions. In a separate Git worktree, supply an ignored personal .env or use an explicit --env-file; do not assume ignored environment files are copied. Do not copy real secrets into version control. Normal startup uses db:prepare, never db:reset or down -v. Public migrations and reviewed tenant migration task remain Member 3's responsibility.

This host can verify Windows + Docker Linux containers only. It cannot establish that all four physical laptops work. [Acceptance tracker](acceptance.md) assigns fresh setup evidence to each role; all four results and actual review remain required. ARM/native Ruby/other browsers/production remain unverified.

## Tracking and release

Reused milestone Tenant Prototype Week 1 and issues #1–#15; all retain existing owner/reviewer/priority/day/dependencies/criteria. Protections verified: one approval, stale approval dismissal, resolved conversations, Frontend/Backend required, no force-push/default-branch deletion. No protections weakened.

Projects v2 inspection again denied: credential lacks read:project scope. Existing board existence/status is unverified; no new board created. Follow docs/github-setup.md manual steps, inspect existing board before creating anything, and apply Backlog/Ready/In progress/In review/Validation/Done. Local acceptance tracker is the fallback, not a claim of GitHub board updates. No issue marked Done solely on branches/tests/screenshots.

No release/tag/stakeholder acceptance. See [demo and release preparation](demo-release.md). Release gate remains blocked by product/lifecycle/upload decisions, integration/review and cross-laptop acceptance.

## Validation

Tested code commit 361713d: production build and 45 frontend tests passed, plus 42 Rails tests / 248 assertions on a fresh scratch database. Both required CI jobs passed. Real browser login/logout, search, saved details, form value loading, branding preview and assigned/unassigned access were verified with labelled synthetic fixtures. At 1280px and 304px, page width matched viewport; controls were labelled and keyboard Enter worked. See [acceptance tracker](acceptance.md) and [draft PR #20](https://github.com/skioty/CPQ-Tool/pull/20). Initial build passed; initial new test failures concerned async FormsModule timing, late provider overrides and missing native dialog methods in jsdom. Tests were corrected without replacing runtime browser behavior. Unit dialog tests mock only the unsupported jsdom methods and do not prove browser focus trapping. Real backend/cross-laptop evidence and synthetic test fixtures are kept separate.
