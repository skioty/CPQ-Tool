# Angular foundation

Angular CLI 21.2.28 foundation with standalone reactive tenant create/edit/contact forms and draft/saved branding previews. Saving is gated until API contracts, reference data, business rules, uploads and session integration are reviewed. See the [Member 1 handoff](../docs/member1-forms.md); no real backend create/edit integration is claimed.

Use the root [README](../README.md) for shared Docker setup. Native commands here: `npm ci`, `npm start`, `npm run build`, `npm test -- --watch=false`. Build outputs `dist/frontend`. No e2e runner or lint target is configured. Use `npx ng generate component component-name` for future components.

Member 1 owns forms/branding and reviews Member 4 frontend; Member 4 owns list/details/lifecycle integration and reviews Member 1 frontend. Both own relevant tests and docs.
