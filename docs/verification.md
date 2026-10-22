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
| Domain acceptance/security/isolation tests | not implemented/run; see planned test plan |

## GitHub changes

Created/reused **Tenant Prototype Week 1** milestone and 15 issues, [#1](https://github.com/skioty/CPQ-Tool/issues/1) through [#15](https://github.com/skioty/CPQ-Tool/issues/15), from [backlog](backlog.json). No real assignees or dates. #1 is current setup review; remaining issues cover later implementation/delivery.

Enabled `main` classic branch protection: one approval, stale approval dismissal, conversation resolution, administrator enforcement, no force pushes or branch deletion. Required checks are added only after actual contexts exist. Project board configuration is prepared in [GitHub setup](github-setup.md), not applied.

GitHub resource audit confirmed 15 issues, one milestone, zero duplicate issue titles and zero assigned issues. The initial Angular startup failed because port 4200 was occupied; this checkout's ignored `.env` uses frontend 14200 and backend 13000. Shared example defaults remain 4200/3000. No existing service was stopped.

The first Bundler compact-index attempt was interrupted after a stalled/very slow registry download; a diagnostic direct download received about 1 MB of a 24 MB index in 30 seconds. Used Bundler's supported full-index fallback for initial resolution. A locked install is the normal subsequent path.

The initial official Rails generator was 7.2.3.1. Maintenance-policy review rejected that runtime because its normal support window had ended; the scaffold was updated to Rails 8.1.4 and 8.1 defaults before feature work. Stable ros-apartment 3.4.4 declares ActiveRecord >=7.0,<8.2 and Rails 8.1 requires Ruby >=3.2, fitting Ruby 3.3.10. This selection follows support and compatibility, not version recency alone.

Further backend/CI evidence will be recorded before handover. This document makes no claim that the tenant prototype, authentication, isolation or deployment is complete. Fresh setup on all four laptops is a Day 6 acceptance task; only this Windows/Docker Linux environment is verified here.
