# Subscription pricing and location selection

Existing subscriptions migrate to **Custom**, preserving all fees and discounts. Billing remains monthly; discounts remain percentages for the configured number of monthly billing cycles. This is configuration, not invoicing or payment processing.

## Super Admin workflow

1. Open **Reference options > Automatic subscription pricing**.
2. Add tiers with an enabled currency, inclusive minimum/maximum user limit and monthly fee. Enter approved prices; no prices are seeded. Ranges cannot overlap within a currency. Gaps are allowed but cannot be used for Automatic pricing.
3. Save pricing tiers. Concurrent edits are rejected and require reloading saved tiers.
4. In tenant create/edit > Billing, choose **Automatic** or **Custom**. The summary shows mode, user limit, currency, monthly fee and discount estimate before saving.
5. Automatic derives the fee from user limit and currency. Missing tiers block saving. Custom allows a negotiated fee and preserves it when the limit changes. Switching back to Custom during editing restores the draft negotiated fee.

Updating tiers does not retroactively reprice saved tenants. Automatic tenants use the current schedule on their next user-limit, currency or pricing-mode change; unrelated company/branding edits retain the saved fee. Assigned CPQ Admins still cannot edit commercial terms; their permitted capacity changes on an Automatic tenant use server-calculated pricing. Tenant Admin workspace responses do not expose platform commercial settings.

## API and database

- Additive migration `20261028000100_add_subscription_pricing.rb`: `pricing_mode` on shared subscriptions, shared singleton pricing configuration with JSON tiers and optimistic version.
- Super Admin `GET/PATCH /api/v1/subscription_pricing`; PATCH body `{pricing:{lock_version:0,tiers:[...]}}`. Each tier has `currency`, integer `min_users`, integer `max_users`, decimal-string `fee`. Use actual approved prices.
- Tenant subscription accepts/returns `pricing_mode` (`custom` or `automatic`), defaults to Custom for existing clients. Backend calculates Automatic fees under the tenant-write transaction and shared schedule-row lock. Configuration updates serialize against those reads. Overlapping ranges, invalid fees/currencies and stale versions are rejected. Updates are audited without credentials.
- Reference options include `pricing_tiers` and `country_time_zones`. TZInfo supplies the country mapping and full IANA catalogue; labels use current UTC offsets, persisted values remain IANA identifiers.

## Country and timezone

Selecting a country with one zone selects it automatically. A multi-zone country narrows searchable choices and clears an incompatible prior selection, so the user chooses explicitly. The field remains visible/editable. Loading existing values preserves the saved timezone. Clearing country restores the full zone list. Date/time formatting continues using the saved identifier.

## Sign-in errors

Platform and Tenant Admin sign-in show **Invalid email or password** inline beside the password for invalid credentials. Network and other actionable failures retain distinct messages. Registration password requirements and MFA/security errors remain available.

## Local rollout

Run the normal additive migration (`docker compose -p cpq-integration exec -T backend bundle exec rails db:migrate`) in the integration checkout. No new secrets or dependencies are required. Existing PostgreSQL volume remains in use. Configure approved tier prices before using Automatic mode. Review and acceptance remain required before release.

## Verification on this increment

- Rails full suite: **104 tests, 922 assertions, zero failures/errors/skips**. Includes real PostgreSQL persistence, pricing permissions, stale configuration, overlapping ranges, server-authoritative fees, capacity changes, discounts and country mapping; existing invitation/authentication/isolation tests remain green. An initial initialization error was fixed; an existing audit-order assertion failed once and passed in the complete rerun.
- Angular full suite before the final editor assertions: **101 tests passed**. Final affected suites: **30 tests passed**, including two new pricing-editor tests and the updated inline-error assertion.
- Production build passed, with existing advisory bundle/style budgets and QR-library CommonJS warnings. No dependency changes.
- Real browser sign-in with synthetic invalid credentials showed the exact inline error; frontend/backend/database are healthy after a safe restart. Authenticated pricing/country flows were verified by request/component tests, not a complete MFA-authenticated browser walkthrough.
- Additive development migration applied. No production database touched, no tier prices seeded, no secrets changed, and no changes pushed for this increment.

## Missing-tier feedback correction

When Automatic mode has no matching tier, the form shows a calculated-fee output marked **Not configured**, not an editable fee with a required-field error. Discount estimates wait for a valid price. A Super Admin can open tier configuration in a new tab and use **Refresh pricing** to fetch saved tiers without clearing the tenant draft. Missing configuration still blocks saving; Custom mode retains its normal required manual fee. The 50-user upper boundary is included in a configured 26–50 tier.

## User-authorized proposed demo schedule

The user subsequently authorized choosing demonstration prices. Configured in the local development database: BTN/month 1–25 users = 2,500; 26–50 = 4,500; 51–100 = 8,000; 101–250 = 15,000. These are editable proposed demo prices, not validated SELISE commercial terms. Other currencies and ranges still require configuration. With 50 users and the existing 15% discount for three cycles, the preview is BTN 3,825/month for those cycles, then BTN 4,500/month. No saved tenant subscription was automatically repriced.

## Country defaults and currency-value conversion

Implemented after user approval to convert the BTN demo pricing into the selected currency.

- Country currency defaults come from the checked-in **Unicode CLDR 49** current-tender snapshot (`backend/config/country_currencies.json`, as of 2026-10-28). [Source](https://raw.githubusercontent.com/unicode-org/cldr-json/main/cldr-json/cldr-core/supplemental/currencyData.json), [Unicode data licence](https://www.unicode.org/license.txt). The additive migration creates missing currency catalogue entries without re-enabling disabled entries. For countries with multiple tender currencies, use the first CLDR preference as the default and allow explicit selection. Missing/disabled mappings leave the existing selection intact.
- Timezone remains independently editable and controls date/time formatting. It does not determine exchange rates or override a currency selected for the country. Existing tenants load saved values without silently changing commercial terms. Only Super Admin country changes apply a new commercial currency default.
- Automatic pricing first uses a currency-specific tier, if configured. Otherwise it converts the matching **BTN** base tier at the stored cross rate. Formula: `target fee = BTN tier fee * target-per-USD / BTN-per-USD`, rounded half-up to two decimal places, retaining the existing database fee precision. Percentage discounts apply to the converted fee for the existing monthly-cycle duration.
- Custom fees remain negotiated. A draft currency change converts their current value for review; a user-limit change never recalculates them. Missing conversion rates clear the draft fee and require retry or entry of an agreed Custom amount. Switching pricing modes retains the negotiated value and its source currency for correct conversion.
- Source: [ExchangeRate-API open access](https://www.exchangerate-api.com/docs/free). No credentials/cost required; attribution is displayed with converted pricing. Only the fixed public USD rate endpoint is contacted; tenant/contact/account information is never sent. Rate data stays server-side; clients receive individual conversion results, not the full rate feed.
- Snapshot and timestamps are durable in PostgreSQL. Quote requests refresh after 24 hours; a failed refresh is retried at most hourly. Rates older than 48 hours, future-dated by more than an hour, unsupported pairs and malformed responses are rejected. Tenant writes use the validated cached snapshot without network requests. This is an indicative daily rate, not a payment/settlement quote.
- The saved Automatic subscription retains its source amount, currency, rate, provider and rate timestamp in `pricing_conversion`. Rate refreshes never retroactively alter saved tenant fees. Existing first-invoice currency restrictions and Super Admin commercial permissions remain authoritative.

### API/operations

`GET /api/v1/subscription_quote?user_limit=50&currency=USD` returns `{data:{fee,currency,source_fee,source_currency,converted,rate?,rate_time?,provider?}}`. Authenticated platform staff can preview Automatic prices. Custom conversion adds `source_currency` and decimal-string `amount` parameters and requires Super Admin. All target currencies must be enabled catalogue options. Stale or missing rates return a stable `exchange_rate_unavailable` error.

New migration: `20261028000200_add_currency_conversion.rb`. Normal `rails db:migrate` applies it. On a new laptop, the first quote needing conversion retrieves a snapshot over HTTPS; offline operation needs a still-valid stored snapshot or an agreed Custom fee. No fabricated fallback rates are supplied. Existing database backups now include rates and saved conversion metadata. Public pricing metadata is not exposed to Tenant Admin workspace responses.

### Currency conversion verification

Full Angular suite: **107 tests passed**. Full Rails suite: **106 tests / 950 assertions passed**, with no failures/errors/skips. Focused final conversion/form checks: **12 tests passed**. Production build passed with advisory bundle/style and QR CommonJS warnings. A real public rate snapshot dated **2026-10-28T00:02:31Z** was retrieved by the backend and persisted locally; BTN 4,500 converted to USD 47.27, EUR 42.43 and GBP 35.50 at that snapshot. These are dated indicative values, not fixed commercial prices. All local services remained healthy; no production data, secret/dependency files or remote Git branches were changed. Authenticated persistence and access were verified by Rails request tests; a full manual MFA-authenticated browser walkthrough was not performed for this increment.
