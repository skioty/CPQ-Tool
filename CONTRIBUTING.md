# Contributing

Use the default `main` branch and short task branches such as `feat/tenant-api`, `feat/tenant-create-form`, `feat/schema-provisioning`, or `fix/tenant-validation`. No permanent member branches or separate develop branch.

1. Claim one issue by commenting with your Member role. Assign a GitHub account only after its mapping is verified. Move Backlog → Ready only when dependencies and acceptance criteria are clear.
2. `git fetch origin`, `git switch main`, `git pull --ff-only`, then `git switch -c feat/task-name`.
3. Commit focused changes using `feat:`, `fix:`, `test:`, `docs:`, or `chore:` and a short description. Keep secrets and uploads out of Git.
4. Open a PR to `main`, link the issue, summarize behavior and provide test evidence. Move to In review. Draft early when a contract needs feedback.
5. Request the role reviewer: Member 1 reviews Member 4 frontend; Member 4 reviews Member 1 frontend; Member 2 reviews Member 3 backend; Member 3 reviews Member 2 backend and Member 4 infrastructure. Every member owns tests, documentation and defects for their own work.
6. Require another member's approval, resolved conversations and passing relevant CI. New changes after approval require renewed review. The author never self-approves or self-merges the setup PR. Move to Validation for acceptance evidence, then Done after acceptance and merge.

## Updating and conflicts

On your task branch, commit or stash your own work, then `git fetch origin` and `git merge origin/main`. Resolve conflicts with the affected owner, inspect the combined behavior, run relevant checks, stage the resolved files and commit. Use `git merge --abort` if unsure. Never discard someone else's work or force-push `main`. If rebasing an individually owned branch is agreed, use `--force-with-lease` only on that feature branch and tell reviewers.

## Coordination and security

Member 3 coordinates all shared/tenant migration ordering with Member 2. Migrations and seeds stay in `backend/db`; never edit a migration already applied by another laptop. Add forward migrations, test on a fresh database and existing schema, and document tenant migration recovery. Discuss dependency changes in an issue, update manifests and lockfiles together, and rerun builds/tests. Review runtime support and advisories before upgrades.

Copy `.env.example` to ignored `.env`; use local-only credentials. Do not commit passwords, Rails master keys, tokens, dumps or user uploads. Demo provisioning must be an explicit development/test command with credentials supplied at runtime; no public registration and no automatic contact-to-account conversion. If a secret leaks, revoke it immediately and notify the maintainer; deleting the file is insufficient.

## Tests and Definition of Done

Run the README build/test commands for affected components. Feature PRs add meaningful success, failure and permission tests; tenancy changes require isolation, cleanup and recovery coverage. Record skipped checks honestly. Definition of Done: issue criteria met, backend authorization covered, tests pass, migration effects reviewed, API/docs updated, no secrets, peer review complete, integrated behavior demonstrated and evidence linked. Scaffold CI alone does not establish domain correctness.
