# Tenant branding and dashboard flow

The existing tenant editor, saved-branding route and authenticated Tenant Admin workspace now share a single Angular `TenantDashboard` renderer. This is an application refinement, not a separate Figma file, role-switch feature or new CPQ module.

## Demonstration and real access

1. A platform administrator opens Tenant settings → Branding.
2. Primary and secondary colour editors offer the browser's native interactive colour spectrum, precise six-digit HEX, current/new swatches, Apply to preview, Cancel and Reset to Default. There are no preset colour palettes. Apply changes the form draft only; Save changes persists through the existing Rails tenant API/ETag workflow.
3. The live dashboard preview labels unpublished drafts and supports comparison with the last saved snapshot. Cancel branding changes restores only branding and image references, preserving other form sections. Existing navigation guards protect applied unsaved form changes.
4. The saved preview route links directly back to Branding settings and offers Desktop, Tablet and Mobile widths. Its Tenant Admin dashboard is explicitly labelled a demonstration. No session, membership, role or backend permission changes when previewing or using its local content tabs.
5. A separately authenticated, explicitly invited Tenant Admin opens an Active workspace. The same dashboard renders saved branding from the membership-protected workspace endpoint. Refresh saved branding fetches current settings; unsaved platform drafts never reach this endpoint.

The real Tenant Admin workspace offers Overview, read-only Company details and Access information. Buttons select those existing in-scope views. There are no invented revenue charts, user counts, quotations, billing controls or permission-management actions. Existing all-workspace navigation, sign-in, logout, account security, platform tenant management and lifecycle checks remain in place.

## Branding and accessibility

Company display name (subject to the existing name-display setting), logo, primary/secondary colours and typography are applied through scoped component CSS variables. Open Sans uses the already bundled font; serif/system fallbacks remain supported. Platform administration keeps its separate neutral/navy shell.

Primary colour controls active navigation, important actions and header accents. Secondary colour supports identity badges and small accents. Cards, tables and content surfaces remain neutral. Error/success/status semantics are not recoloured. The preview includes a labelled browser-tab favicon illustration; it does not replace the platform's actual browser favicon.

Automatic black/white foreground selection maintains normal-text contrast on brand-colour surfaces. The colour editor warns when white text would be below 4.5:1 and offers an accessible alternative as a new candidate, without silently saving or replacing the brand. Dark focus outlines, visible active-tab underlines, 44-pixel controls, labels and inline validation remain available even with very light branding.

Missing/failed images show initials/default favicon. Invalid or missing colours use existing safe defaults. Component container queries adapt the same renderer: desktop sidebar/two cards, tablet narrower sidebar/stacked cards, mobile menu/stacked content. Tables have contained scrolling and long identity text wraps. Reduced-motion preferences disable decorative transitions.

## Data and verification limits

The existing tenant workspace response adds saved `display_name` and is explicitly `Cache-Control: no-store`. Its asset routes, tenant identifiers, authentication, MFA, Active-status restriction and schema isolation are unchanged. No migration, cloud resource, account provisioning or new dependency is required.

Automated tests cover draft Apply/Cancel/default controls, invalid colours, foreground contrast, shared branding, image fallback, favicon preview, mobile-menu state and saved workspace API identity under existing access checks. Production build and regression results are recorded in the handover. Browser automation was unavailable for this increment, so native colour-picker interaction, physical device layouts and screen-reader behavior still need manual visual acceptance; responsive CSS and component tests do not constitute that acceptance.
