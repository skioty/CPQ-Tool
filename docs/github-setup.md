# GitHub tracking and review

Repository verified: `skioty/CPQ-Tool`, public, default `main`, initially no commits/issues/milestones/rulesets or classic branch protection. A minimal README bootstrap commit establishes the PR base; all foundation work is reviewed on `chore/repository-foundation`.

## Board access limitation and exact manual steps

The available credential permits repository administration but lacks `read:project` / `project` scopes. Projects v2 inspection was denied, so no project was created and existing board duplication cannot be ruled out by API. Do not create a board until inspecting the owner's existing projects in the browser.

1. Open the repository's Projects tab and the owner's Projects list. Reuse a tenant prototype board if present; otherwise create one named **Tenant Prototype Week 1**, and link it to this repository.
2. In project settings, edit the Status field to exactly **Backlog**, **Ready**, **In progress**, **In review**, **Validation**, **Done**. Create a board view grouped by Status.
3. Add the milestone issues listed in [backlog](backlog.json) by URL/issue search. Start feature issues in Backlog; move to Ready after dependencies and business decisions are resolved. The setup issue stays In review until peer acceptance.
4. Use the owner/reviewer roles in issue bodies. Leave real assignees unset until verified usernames are provided. Add optional Priority and Target Day fields using the issue metadata; do not invent calendar deadlines.
5. An authorized owner can complete these steps in GitHub UI, or explicitly authorize a credential with project scopes. Never commit tokens. Do not create a second project to work around denied inspection.

## Review policy

Require PRs to `main`, at least one approval by another member, dismissal of stale approvals, resolved review conversations, and relevant passing checks. Block force pushes and deletion of `main`. Retain visibility and existing permissions. Do not add guessed CODEOWNERS or invite unknown accounts.

Once actual Actions runs have created check contexts, require their exact job names (`Frontend`, `Backend`) and verify enforcement by reading settings. Before that, use PR approval/conversation protection without imaginary required contexts. If enforcement is rejected by plan/access, apply this policy manually and record the limitation in verification. Do not weaken existing rules or buy a plan.

Use the milestone **Tenant Prototype Week 1** without dates. The machine-readable backlog includes setup and feature issues separately. Maintainer creation must inspect all existing issues/milestones first and reuse exact matching resources; verify counts and links afterwards. No real member assignments are made.
