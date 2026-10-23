# Local integrated application

Branch: integration/tenant-management. Application commit: 9f0ada360d5c8ae13d3ee7b80bfb2a3bae5bc62a.

All four original folders are linked Git worktrees for skioty/CPQ-Tool. At inspection each had no tracked changes or untracked nonignored files. Existing ignored runtime logs, caches, build files and temporary files were left untouched. No backup/checkpoint was needed. Default branch remains main; it was not changed.

The selected base feat/tenant-experience already contains all commits from feat/tenant-forms (10448da), feat/tenant-api (6f47fb6), feat/auth-schema-tenancy (457dbe3), feat/tenant-navigation (86c9a7f), and feat/approved-tenant-rules (1518eb3). Ancestry checks passed. Existing integration merge d488568 combined the frontend/backend histories; this task required no additional merges or conflict resolutions. No features or contracts were rewritten.

## Start and stop (PowerShell)

Run from this integration folder, with Docker Desktop running:

```powershell
docker compose -p cpq-integration up -d --wait --no-build db backend frontend
docker compose -p cpq-integration ps
```

Open http://localhost:14207 (Rails health: http://localhost:13007/up).

```powershell
docker compose -p cpq-integration stop
```

Stop preserves containers and database. To remove containers while retaining database volume, use `docker compose -p cpq-integration down`. Do not add `-v` unless intentionally destroying this isolated data.

Ignored .env holds generated local PostgreSQL credentials, database cpq_integration_development, test database cpq_integration_test, ports 14207/13007. Named volume cpq-integration_postgres_data is independent of existing previews/development data. No existing database was reset or migrated.

Ignored .env.integration-accounts contains the user-approved synthetic demo accounts and generated passwords. Open it locally to sign in; never commit/share it. superadmin@example.invalid is Super Admin; admin@example.invalid is CPQ Admin. Provisioning uses the existing fixed-role Devise model and no public signup. No user-management UI or invitations are implemented.

Synthetic demo sector/company/contact data are local acceptance fixtures, not approved SELISE reference data. Configure actual approved industries before using real business examples. Contact records never create accounts.

## Checks executed

- Locked npm ci succeeded (470 packages; reported zero vulnerabilities).
- Angular production build passed: initial bundle 422.84 kB. Existing shell/form stylesheet warnings remain (5.00/6.50 kB against 4 kB advisory, below 8 kB error).
- All 52 frontend tests passed.
- Cached backend image bundle check passed; SHA256 of its Gemfile.lock exactly matched this checkout. Ruby 3.3.10 and ImageMagick decoder verified. Source is mounted from this integration worktree, not the old image snapshot.
- Fresh isolated Rails db:prepare and db:seed succeeded; all three public migrations are up.
- Rails tests: 51 runs, 368 assertions, zero failures/errors/skips, 16 workers. Suite includes real authentication, permission denials, primary contacts, lifecycle/archive retention, uploads, provisioning and schema isolation/context restoration.
- Runtime Rails/Angular/PostgreSQL health checks passed. No public registration or development isolation-probe endpoint in runtime routes.

Full frontend/backend image builds succeeded, including locked bundle installation (77 gems). Rails was restarted on the newly built backend image. To rebuild later use `docker compose -p cpq-integration build`, then start normally. Four physical laptop verification and peer/stakeholder acceptance remain pending.

No push, GitHub PR creation, remote merge, force push, history rewrite, author change or GitHub resource update was performed. Original four worktrees remain available.


## Live acceptance evidence

Against the integration database and real same-origin Rails APIs:

- Browser: Devise login, add synthetic reference option, create with two contacts/exactly one primary and a real CPQ Admin assignment, automatic saved edit route, description/colour update, persisted branding preview, list/detail navigation and successful Activate confirmation.
- HTTP: activate -> active; suspend -> suspended; reactivate -> inactive; activate -> active; deactivate -> inactive; archive -> archived; restore -> inactive. These all succeeded. The browser subsequently activated the demonstration tenant for review.
- HTTP: actual synthetic PNG upload, binding using branding.logo_attachment_id, and authorized image response succeeded (200). Logout then anonymous list access returned 401.
- A manual HTTP smoke attempt initially used the wrong logo field and was correctly rejected with 422; corrected to the documented field and verified successfully. No application code change was needed. Its unused asset remains retained under the documented asset-retention behavior.
- The first browser lifecycle request during image restart failed with connection refusal; retried after readiness and passed. The full backend build and subsequent two-worker test rerun passed: 51/368, no failures/errors/skips. No schema reset was performed.

Isolation/concurrent requests/provisioning recovery are verified through Rails tests, not claimed as manual browser proof. Asset upload was exercised through HTTP, not the browser file picker. Favicon variants are covered by the existing tests, not manually uploaded in this run. Browser responsiveness/four-laptop setup/accessibility/stakeholder acceptance are not newly certified by this integration task. The known stylesheet advisory and abandoned-asset cleanup policy remain follow-up work, not startup blockers.

Assigned CPQ Admin HTTP acceptance: assigned details returned 200; archive action was rejected with 403. Unassigned-tenant denials remain covered by the Rails suite.

