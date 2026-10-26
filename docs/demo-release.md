# Demonstration and release preparation

Current follow-up: the user approved the final business table and lifecycle matrix. [Approved-rule implementation/evidence](approved-rules.md) supersedes policy blockers below; these earlier results remain historical evidence, not final stakeholder acceptance.


Unreleased integration draft. No tag, release publication or stakeholder acceptance. All four roles own tests/docs/defects; Member 4 coordinates evidence only.

## Before demonstration

1. Review/merge dependencies in order: setup #16; frontend #17 and backend #18; auth/tenancy #19; then Member 4 integration after conflict/review checks. This task does not merge any PR. Require current Frontend/Backend checks and peer review; refresh integration with reviewed main.
2. Resolve the open product/lifecycle/upload policies and update contract/validators before enabling writes. Confirm reference catalogues, primary contacts, assignment count, money/discount duration and archive policy.
3. Follow root README Compose prerequisites/startup with a personal ignored .env. Prepare the database using reviewed migrations; provision synthetic demo administrators through Member 3's runtime-only task. Never display passwords/tokens or production data in evidence.
4. Run Angular build/tests and Rails/PostgreSQL tests, including Member 3 isolation/recovery cases. Each member signs off their own laptop/area in acceptance.md, tied to exact tested commit.
5. Confirm same-origin session/CSRF, role assignments, routes, authorized asset URLs and approved lifecycle actions. Do not manufacture a successful create/demo by injecting business bypasses into runtime configuration.

## Relative demo sequence (no invented duration)

| Presenter | Demonstration | Evidence |
| --- | --- | --- |
| Member 3 | login/logout, Super Admin vs assigned/unassigned Admin, two-schema data and context/error recovery | real session/request tests and isolation/migration logs |
| Member 1 | approved create form, multiple contacts with exactly one primary, branding uploads/preview | real create/save/refresh and owned frontend tests |
| Member 2 | saved tenant/settings/decimal persistence, validation errors, agreed lifecycle/audit/archive behavior | API/model tests and agreed state/retention contract |
| Member 4 | authorized list/search/status/pages, details, edit/preview navigation, confirmed lifecycle action | browser flow and relevant frontend tests |
| All | fresh-laptop setup evidence, known limitations and next-semester CPQ extension backlog | acceptance.md plus reviewed commit/PR links |

If a gate remains blocked, demonstrate only the implemented read/login flows and automated evidence, explicitly describing fixture data. Do not present a fixture-seeded tenant as created through the UI. Do not call the result an accepted release candidate.

## Draft release notes

- Combined Angular tenant forms and list/details/navigation with Rails tenant persistence, Devise access and Apartment schema provisioning.
- Added same-origin session/CSRF integration, server-version edit adapter, explicit empty/error/loading states, native confirmation component and acceptance tracking.
- Existing pinned runtime/dependency versions and Compose/GitHub Actions retained; no Azure/Kubernetes/cost changes.
- Known gaps: product/reference rules, real form saves/uploads, lifecycle/archive policy, assignment FK reconciliation, ambiguous-create idempotency, four-laptop acceptance and independent peer review. No production/deployment readiness claim.

Release gate: approved scope and policies, integrated acceptance evidence at tested commit, all owners' results, required peer reviews, passing required CI, documented limitations and actual team authorization to tag/publish. Stakeholder acceptance is recorded only when obtained. Until then, no tag/release.
