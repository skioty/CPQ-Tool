# Test plan

## Foundation vs feature evidence

Actual checks run and their outcomes belong in [verification](verification.md). Generated Angular tests and the Rails health test are scaffold checks only. The following domain tests are planned and not implemented by setup.

| Area | Planned evidence | Owner / reviewer |
| --- | --- | --- |
| Required fields | approved create/edit rules, malformed input, server/client consistency, stable error envelope | Members 1+2 / Members 4+3 |
| Primary contacts | zero, one, multiple primaries; atomic contact replacement; no partial save; concurrent edits | Member 2 / Member 3 |
| Persistence | reload branding/subscription/contact data; decimal/currency rules after approval | Member 2 / Member 3 |
| Uploads | approved MIME/content/size/dimensions; spoofed content, unauthorized attachment IDs, cleanup and preview | Members 1+2 / Members 4+3 |
| Authentication | login/logout, invalid credentials, no public signup; runtime-only demo provisioning; contacts create no account | Member 3 / Member 2 |
| Permissions | anonymous denied; Super Admin allowed for implemented actions; assigned Admin allowed; unassigned Admin denied in lists/direct URLs/writes/uploads/lifecycle | Member 3 / Member 2 |
| Lifecycle | agreed transition/permission matrix, confirmations, audit actor/state; invalid/concurrent action; deletion policy only when approved | Members 2+4 / Members 3+1 |
| Schema isolation | two schemas with different fixture data; authorized routing; exception cleanup, reused connections and jobs; shared records independently protected | Member 3 / Member 2 |
| Provisioning | failed creation/migration, non-ready status, idempotent retry, compensation, no orphan activation | Member 3 / Member 2 |
| UI integration | list/search/filter/details/create/edit/errors/branding; keyboard and responsive checks | Members 1+4 / each other |
| Fresh setup | all four laptops clone, copy env, build, prepare DB, boot and run checks; no manual hidden state | all / Member 4 coordinates |

Use isolated test databases/schemas and synthetic fixtures. Never use production data or destructive reset commands against development. Record command, commit, environment, result and evidence link; skipped tests remain gaps. Regression on Day 6 and acceptance on Day 7 use the same approved criteria.
