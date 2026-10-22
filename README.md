# CPQ Tool

Four-student final-year SELISE project: a reusable multi-tenant CPQ SaaS adaptable to different industries. This semester targets a one-week tenant management prototype; the remaining CPQ modules extend this application next semester.

## Current status

This branch adds Member 1's Angular create/edit/contact form workspace and branding previews to the foundation. The default UI is explicitly a draft: tenant APIs, reference lists, upload transport, business rules and session integration are unavailable/unapproved, so saving is disabled. No real tenant persistence or authentication is claimed. See [Member 1 handoff](docs/member1-forms.md) for implemented UI, tests and integration gates; [setup verification](docs/verification.md) covers the original foundation.

## Stack and layout

Angular 21 / Node 24 tooling; Ruby 3.3 / Rails 8.1 REST modular monolith; PostgreSQL 17; Devise and maintained `ros-apartment` 3.4.4 for planned schema tenancy. Node is not the application backend. Figma supports interface design. Azure/Kubernetes remain future deployment direction, with no cloud setup required here.

| Path | Contents |
| --- | --- |
| frontend/ | generated Angular application, tests, npm lockfile |
| backend/ | generated Rails API, tests, migrations/seeds location, bundle lockfile |
| docs/ | requirements, architecture, contracts, decisions, delivery and evidence |
| infra/ | development container definitions |
| .github/ | actual CI and issue/PR templates |
| compose.yaml | local services, separate test service, persistent development database |

## Prerequisites and versions

Git and Docker Desktop/Engine with Compose v2 and Linux containers are the shared cross-platform prerequisites. Docker Desktop must be running; Windows may need WSL2. The backend uses `linux/amd64` for the locked native gems; ARM laptops need Docker amd64 emulation (normally supplied by Docker Desktop), with a performance cost. Native ARM Rails is not verified. Native Ruby/Node are optional when using Compose. Setup used Docker Engine 28.4.0, Ruby 3.3.10, Node 24.21.0 and npm 11.19.1; manifests/lockfiles record application dependencies. The [decision log](docs/decisions.md) explains compatibility and open version review. [Verification](docs/verification.md) distinguishes selected versions from runtime checks.

## Local setup (PowerShell, macOS or Linux)

The selected/locked foundation versions are Angular core 21.2.25 (CLI 21.2.28, TypeScript 5.9.3), Rails 8.1.4, Devise 5.0.4, ros-apartment 3.4.4 and PostgreSQL 17.11. Runtime verification and planned integrations are distinguished in the verification document.

Clone this repository and enter it. Copy `.env.example` to `.env` (`Copy-Item .env.example .env` in PowerShell, `cp .env.example .env` in POSIX shells). Set a personal local `POSTGRES_PASSWORD` before starting; no demo account password is supplied. Defaults use database user `cpq`, development database `cpq_development`, test database `cpq_test`, backend port 3000 and frontend port 4200. Real `.env` files are ignored. Do not use real credentials or production data.

```sh
docker compose build
docker compose up -d db
docker compose run --rm backend bundle exec rails db:prepare
docker compose up -d --wait backend frontend
docker compose ps
```

Open [Angular form](http://localhost:4200/tenants/new) and [Rails health](http://localhost:3000/up). The latter proves boot only, not DB readiness or isolation. No login or tenant API exists yet. The proposed Angular HTTP adapter needs approved session/proxy integration with Members 2–4; draft saving stays disabled. Services bind host ports to loopback and PostgreSQL is internal to Compose. Change port variables in `.env` if occupied. Run `docker compose logs backend frontend` for diagnostics.

Database preparation uses the real Rails `db:prepare` task; no domain migrations or demo seed accounts exist. Do not use `db:reset` as startup. PostgreSQL data persists in a named volume; `docker compose down` keeps it. Changing the password after database initialization requires coordinating the database role password; environment variables do not reinitialize an existing volume. Avoid `down -v` unless intentionally discarding local data.

Source mounts support local edits. Rebuild frontend after dependency/config changes and backend after Gemfile changes. This setup is a development environment, not a production container or deployment.

The backend build reuses a BuildKit gem cache when available and falls back to a normal locked `bundle install` on a cold builder. First builds need registry network access and can be slow. No separately installed Ruby gems or manually seeded cache are required by the normal setup instructions.

## Checks

```sh
docker compose run --rm frontend npm run build
docker compose run --rm frontend npm test -- --watch=false
docker compose --profile test run --rm backend-test
```

The test service explicitly uses `RAILS_ENV=test` and the separate test database. Never set `TEST_DATABASE_NAME` to your development database. It prepares the test DB and runs existing Rails tests. CI also installs locked dependencies, builds Angular and runs its configured tests plus Rails tests against PostgreSQL. No lint command is claimed where none is configured. Domain acceptance tests remain planned.

For optional native frontend checks: use Node `.nvmrc`, `cd frontend`, `npm ci`, `npm run build`, `npm test -- --watch=false`. For native Rails use Ruby `backend/.ruby-version`, `bundle install`, set database environment variables matching `backend/config/database.yml`, then run Rails tasks in `backend/`. Compose is the supported common path.

## Collaboration and planning

Start with [contributing](CONTRIBUTING.md), [requirements](docs/requirements.md), [architecture](docs/architecture.md), [database design](docs/database-design.md), [API contract](docs/api-contract.md), [decisions](docs/decisions.md), [seven-day sprint](docs/sprint-plan.md), [test plan](docs/test-plan.md), and [GitHub setup/board limitation](docs/github-setup.md). The [backlog](docs/backlog.json) records owner/reviewer roles without invented identities. Use short task branches and reviewed PRs to `main`; the setup PR must be reviewed by another member.
