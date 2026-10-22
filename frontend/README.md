# Angular foundation

Angular CLI 21.2.28 foundation with standalone reactive tenant create/edit/contact forms and draft/saved branding previews. Saving is gated until API contracts, reference data, business rules, uploads are reviewed. See the [Member 1 handoff](../docs/member1-forms.md); no real backend create/edit integration is claimed.

Member 4 adds real cookie-session login/logout, CSRF handling, tenant list/search/pagination/details and saved preview/edit loading. The adapter forwards ETags and preserves unchanged nullable fields/assets. Saving and lifecycle actions remain gated; read verification does not prove create/edit persistence. See the [integration handoff](../docs/member4-integration.md) and [acceptance evidence](../docs/acceptance.md).

Use the root [README](../README.md) for shared Docker setup. Native commands here: `npm ci`, `npm start`, `npm run build`, `npm test -- --watch=false`. Build outputs `dist/frontend`. No e2e runner or lint target is configured. Use `npx ng generate component component-name` for future components.

Member 1 owns forms/branding and reviews Member 4 frontend; Member 4 owns list/details/lifecycle integration and reviews Member 1 frontend. Both own relevant tests and docs.
