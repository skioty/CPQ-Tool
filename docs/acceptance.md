# Acceptance evidence and work status

Status vocabulary: Backlog → Ready → In progress → In review → Validation → Done. Evidence/review/acceptance are separate. No stakeholder acceptance or release authorization has been obtained. No item is Done here.

## Integration gate

| Flow | Current evidence / limitation | Owner / reviewer | Gate |
| --- | --- | --- | --- |
| Administrator login/logout | Real Devise/CSRF backend tests; Angular session integration and HTTP tests | Member 3 + Member 4 / Member 2 + Member 1 | Validation pending browser evidence and peer review |
| Create tenant / required fields | Form exists, but requiredness/reference/business rules remain open; API writes deliberately gated | Members 1+2 / Members 4+3 | Blocked |
| Contacts / exactly one primary | Member 1 interactions and Member 2 PostgreSQL atomic/constraint/concurrency tests | Members 1+2 / Members 4+3 | Automated evidence; full create acceptance blocked |
| Tenant list/search/pagination/detail | Real API components, cancellation/error/empty tests; browser evidence recorded in PR | Member 4 / Member 1 | In review when PR opens |
| Status filters | Transport/configuration tested with synthetic choice; actual approved catalogue unavailable | Members 2+4 / Members 3+1 | Blocked for real status filtering |
| Edit / persistence | Backend update tests; UI loads saved values, ETag compatibility; saving gated | Members 1+2 / Members 4+3 | Blocked for integrated browser save |
| Saved branding preview | Member 1 preview, nullable adapter compatibility; upload/authorized asset URLs missing | Member 1 / Member 4 | Partial; upload acceptance blocked |
| Lifecycle confirmations/transitions | Reusable modal tested; user says policy not yet approved; no exposed actions | Members 2+4 / Members 3+1 | Blocked |
| Unauthorized direct access | Member 3 real role/assignment request tests, not UI guards | Member 3 / Member 2 | Automated evidence; peer validation pending |
| Schema isolation/recovery | Member 3 two-schema, concurrent request, error cleanup and migration tests | Member 3 / Member 2 | Automated evidence; peer demonstration pending |
| Archive retention | No approved archive/permanent deletion/retention policy or endpoint | Member 2 / Member 3 | Blocked |
| Fresh test DB / locked install | Results recorded in PR; do not equate with all-laptop development setup | Members 3+4 / Members 2+3 | Validation |

## Existing issue status (no duplicate backlog)

| Issues | Owner role | Reviewer role | Target / dependencies | Current status |
| --- | --- | --- | --- | --- |
| #1 setup | Member 4 | Member 3 | Day 1; none | In review, #16 open |
| #2 decisions | Member 2 | Members 1,3,4 | Day 1; #1 | In progress; unresolved rules |
| #3, #9 forms | Member 1 | Member 4 | Days 2–4; #2/#8 | In review, #17; integration blocked |
| #4, #5, #7 auth/tenancy/access | Member 3 | Member 2 | Days 2–3; decisions/models | In review, #19 |
| #6, #8 models/API | Member 2 | Member 3 | Day 3; decisions/tenancy/access | In review, #18 |
| #10 navigation | Member 4 | Member 1 | Day 3; #8/#7 | In progress / draft review |
| #11 lifecycle API | Member 2 | Member 3 | Day 4; #2/#8/#7 | Backlog, policy blocked |
| #12 lifecycle dialogs | Member 4 | Member 1 | Day 4; #10/#11 | In progress component; integration blocked |
| #13 release candidate | Member 4 | Members 1,2,3 | Day 5; create/dialogs/isolation | In progress evidence; no RC acceptance |
| #14 regression | Member 3 | Members 2,4 | Day 6; #13 | Backlog for four-laptop verification |
| #15 demo/handover | Member 4 | Members 1,2,3 | Day 7; #14 | In progress plan; demonstration pending |

Authoritative original priorities/criteria remain in issue bodies and docs/backlog.json. Relative target days are not dates or promises. Project changes were not applied because project scope is unavailable; inspect/reuse manually per docs/github-setup.md.

## Cross-laptop setup sign-off

Each member records OS/architecture, Git commit, Docker/Compose versions, personal ignored environment setup, clean startup, tests and owned acceptance flows. No names/hours/dates assumed.

| Role | Laptop setup evidence | Owned evidence still needed |
| --- | --- | --- |
| Member 1 | Pending | reviewed forms, real create/edit/upload/preview round trip |
| Member 2 | Pending | approved business rules/lifecycle/archive and persistence validation |
| Member 3 | Pending | peer auth/isolation/recovery demo and migration coordination |
| Member 4 | This host only; exact commands/results in PR | browser navigation, fresh setup coordination, acceptance assembly |

Tested-commit evidence belongs in PR/Actions links with the exact SHA; screenshots alone do not establish passing persistence/access/isolation. Any synthetic fixture used for read-only UI checks must be labelled. Merge/release only after required reviews/checks and agreed acceptance scope are satisfied.
