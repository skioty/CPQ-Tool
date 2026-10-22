# Setup verification

## Inspection facts

On 22 October 2026 (Asia/Calcutta), the starting workspace was empty and was not a Git checkout. Cloned the requested `https://github.com/skioty/CPQ-Tool.git` into `CPQ-Tool/`. Git and authenticated GitHub metadata confirmed an empty public repository, default `main`, no commits, files, application/dependencies/docs/AGENTS/workflows, issues, milestones, rulesets or classic branch protection. No existing work was overwritten. A minimal README commit on `main` provides the otherwise absent base for a reviewable setup PR.

Git identity was already configured locally; it is not a mapping to a project Member role. No identities were invented or collaborators invited. Projects v2 inspection was denied for missing project scope; classic project endpoint returned 404. Board existence is unverified, and none was created.

## Evidence collected so far

| Check | Result |
| --- | --- |
| Git remote and default branch | verified against authenticated GitHub metadata |
| Docker | Engine 28.4.0 / Desktop 4.46.0 accessible with execution approval; sandbox access alone denied |
| Ruby runtime | official ruby:3.3.10 image ran Ruby 3.3.10 on Linux |
| Frontend clean install | `npm ci` passed; audit reported zero vulnerabilities at that run |
| Frontend production build | `npm run build` passed |
| Frontend scaffold tests | `npm test -- --watch=false`: 1 file, 2 tests passed |
| Frontend Docker image and service | image built; service healthy; HTTP 200 on localhost:14200; same two tests passed inside Compose |
| PostgreSQL runtime | `postgres:17` resolved to PostgreSQL 17.11; dedicated prototype database service healthy |
| Compose configuration | `docker compose config --quiet` passed; ignored local-only password generated without printing it |
| Documentation links | local Markdown targets checked, passed |
| Secrets/exclusions | staged paths exclude real env/master key/uploads/dumps/dependencies; token/private-key pattern scan found no matches |
| Backend dependency resolution | selected gems installed; `bundle lock --local` and `bundle check` passed; lockfile committed |
| Rails version | `bundle exec rails --version`: Rails 8.1.4 |
| Rails test database and autoloading | separate `cpq_test` prepared; `bundle exec rails zeitwerk:check` passed with explicit DB configuration |
| Rails foundation tests | 2 tests, 4 assertions; zero failures, errors or skips |
| Backend Docker image | actual development Dockerfile built successfully using a warm BuildKit cache of the verified official gem downloads |
| Documented Compose database/test path | development `db:prepare` passed; `docker compose --profile test run --rm backend-test` passed: 2 tests, 4 assertions, zero failures/errors/skips |
| Compose startup and health | backend, frontend and PostgreSQL healthy; HTTP 200 from Angular on localhost:14200 and Rails `/up` on localhost:13000 |
| GitHub Actions | [initial PR run](https://github.com/skioty/CPQ-Tool/actions/runs/39802127209): Frontend and Backend jobs passed, including locked installs/build/tests and PostgreSQL preparation |
| Domain acceptance/security/isolation tests | not implemented/run; see planned test plan |

## GitHub changes

Created/reused **Tenant Prototype Week 1** milestone and 15 issues, [#1](https://github.com/skioty/CPQ-Tool/issues/1) through [#15](https://github.com/skioty/CPQ-Tool/issues/15), from [backlog](backlog.json). No real assignees or dates. #1 is current setup review; remaining issues cover later implementation/delivery.

Enabled `main` classic branch protection: one approval, stale approval dismissal, conversation resolution, administrator enforcement, no force pushes or branch deletion. Required `Frontend` and `Backend` contexts were registered after real jobs existed and passed, with an up-to-date branch required. Project board configuration is prepared in [GitHub setup](github-setup.md), not applied. [Setup PR #16](https://github.com/skioty/CPQ-Tool/pull/16) targets `main` from `chore/repository-foundation` and remains unmerged for peer review.

GitHub resource audit confirmed 15 issues, one milestone, zero duplicate issue titles and zero assigned issues. The initial Angular startup failed because port 4200 was occupied; this checkout's ignored `.env` uses frontend 14200 and backend 13000. Shared example defaults remain 4200/3000. No existing service was stopped.

Bundler compact-index and full-index attempts encountered very slow registry downloads and were interrupted. A diagnostic direct download received about 1 MB of a 24 MB index in 30 seconds. Installed the selected gems through RubyGems, then generated the lock with `bundle lock --local` and verified `bundle check`. GitHub Actions independently passed a normal locked installation.

The initial cold backend Docker dependency build was also interrupted during the slow registry fetch. Added a standard BuildKit gem cache with local-first installation and normal locked network fallback. Seeded this builder's cache from the official packages already installed/tested, then successfully ran the actual Compose build/start/test commands. A completely cold Docker dependency download was not completed locally; cold dependency installation passed independently in Actions. Cache seeding is an optimization for this verification, not a requirement for normal setup.

An initial autoload check in the temporary resolver failed because no database host/credentials were supplied there; rerun with the explicit test database configuration passed. Minitest emits a Ruby 3.4 future-default-gem warning about `mutex_m`; the selected runtime is Ruby 3.3 and tests pass.

Native ARM/generic lock expansion was unavailable from the locally installed x86 gems. Compose explicitly selects `linux/amd64` for backend/test services so ARM Docker Desktop laptops can use emulation. Native ARM and other laptop environments are not verified by this run; expanding native platform locks is a follow-up dependency review.

The initial official Rails generator was 7.2.3.1. Maintenance-policy review rejected that runtime because its normal support window had ended; the scaffold was updated to Rails 8.1.4 and 8.1 defaults before feature work. Stable ros-apartment 3.4.4 declares ActiveRecord >=7.0,<8.2 and Rails 8.1 requires Ruby >=3.2, fitting Ruby 3.3.10. This selection follows support and compatibility, not version recency alone.

The setup PR remains open for another member's review and merge. This document makes no claim that the tenant prototype, authentication, isolation or deployment is complete. Fresh setup on all four laptops is a Day 6 acceptance task; only this Windows/Docker Linux environment is verified here. The local development services were left running on the override ports; real local environment files remain ignored.
