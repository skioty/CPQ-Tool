# Seven-day delivery plan

Feasibility depends on actual member availability, scope decisions and existing progress. No hours or calendar dates are assumed and completion is not guaranteed. All members own their tests/docs/defects. Member 4 coordinates evidence, not all testing.

| Day | Member 1 | Member 2 | Member 3 | Member 4 | Integration gate |
| --- | --- | --- | --- | --- | --- |
| 1 | field inventory, Figma form/branding states | proposed schema/API and business questions | auth/session and tenancy design | shared setup, board, acceptance checklist | agree contracts and unresolved-rule owners; review setup |
| 2 | shell/shared forms against reviewed contract | migrations and minimal tenant persistence | Devise proof, role checks, two-schema proof/recovery | fresh Compose/CI, list/detail skeleton | all four can boot; authenticated authorized API and isolated schema proof |
| 3 | create form + contacts | create/view API and invariant tests | assignment enforcement + provisioning integration | list/details connected to API | integrated create/view and denied-access demonstration |
| 4 | edit and approved branding preview/uploads | edit/lifecycle/audit persistence | isolation, switching cleanup and migration checks | lifecycle dialogs and frontend integration | approved transitions and edit/branding round trip |
| 5 | remaining form/accessibility/error defects | remaining approved backend criteria | auth/recovery/security defects | integrated release candidate and evidence | scope freeze; cut unapproved behavior, record gaps |
| 6 | frontend regression/fresh setup | persistence/migration regression | authorization/isolation regression | coordinate cross-laptop regression and release notes | clean-clone verification, critical defects resolved or disclosed |
| 7 | demonstrate forms/branding | demonstrate API/data rules | demonstrate access/isolation/recovery | coordinate demo/handover | acceptance evidence, known gaps and next-semester backlog |

Reviewers: Member 4 reviews Member 1 frontend; Member 1 reviews Member 4 frontend; Member 3 reviews Member 2 backend and Member 4 infrastructure; Member 2 reviews Member 3 backend. Changes crossing boundaries request both relevant reviewers.

Dependencies: contracts and required fields precede forms/models; auth and assignment checks precede exposing tenant APIs; shared model exclusions precede provisioning; lifecycle policy precedes transition implementation; upload restrictions precede acceptance of assets. Review/integrate small PRs daily, avoiding a final-day merge pileup.

Risks: compressed schedule, unknown availability/rules, cross-platform Docker performance, API-only Devise session integration, schema provisioning compensation and shared migration conflicts. Raise blockers at the daily checkpoint; prefer a demonstrable smaller approved scope to untested breadth.

First tasks: Member 1 reviews fields and designs form/error states; Member 2 reviews schema/API and primary-contact invariant; Member 3 proves chosen authentication/session and two-schema isolation; Member 4 verifies clean setup, reviews foundation and organizes board/evidence.
