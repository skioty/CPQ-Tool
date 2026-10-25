# Decision log

Confirmed means supplied project direction; proposed means a reviewable engineering choice; open means no business answer has been invented. Owner roles coordinate decisions with the team/SELISE, rather than unilaterally inventing product policy.

| Decision | Status | Rationale / next action | Owner role |
| --- | --- | --- | --- |
| Angular + Rails REST + PostgreSQL schemas + Apartment + Devise | Confirmed | reusable CPQ modular monolith in one monorepo | all members |
| Docker Compose local; Azure/Kubernetes later | Confirmed | repeatable laptops, no cloud resources in setup | Member 4 |
| main and task branches; one peer approval | Confirmed | retain verified default; short sprint | Member 4 |
| Ruby 3.3.10 / Rails 8.1.4 | Proposed setup selection | Rails 8.1 supports Ruby >=3.2 and stable Apartment permits ActiveRecord <8.2; select a supported line and current patch after rejecting end-of-support 7.2 | Member 3 |
| Angular core 21.2.25 / CLI 21.2.28 / Node 24.21.0 | Proposed setup selection | Angular 21 supports Node ^24.0.0 and TS >=5.9 <6; locked TypeScript is 5.9.3 | Member 1 |
| PostgreSQL 17.11 | Proposed setup selection | mature supported schema-capable line; exact patch observed in the running service and image tag verified | Member 3 |
| Backend containers use linux/amd64 | Proposed setup selection | locked native gems verified on x86 Linux; ARM laptops use Docker emulation pending native platform validation | Members 3 and 4 |
| Devise 5.0.4 | Proposed dependency selection | published railties >=7.0 and Ruby >=2.7; login integration remains a feature issue | Member 3 |
| ros-apartment 3.4.4, require apartment | Proposed dependency selection | maintained Apartment fork; published ActiveRecord >=7 <8.2 and Ruby >=3.1 fit Rails 8.1. Avoid 4.x alpha and its different configuration model | Member 3 |
| Shared platform vs tenant business records | Proposed | management across tenants; see architecture and isolation risks | Members 2 and 3 |
| Billing interval | Open | fee cadence and proration unknown | Member 2 |
| Discount type | Open | fixed amount vs percentage; bounds unknown | Member 2 |
| Discount duration | Open | units, start/end and expiry behavior unknown | Members 1 and 2 |
| Required fields | Open | agree per-field create/edit validation, including contacts | Members 1 and 2 |
| Currency behavior | Open | allowed codes, precision, conversion/change behavior unknown | Member 2 |
| Responsible CPQ Admin count | Open | one vs many, reassignment and unassigned behavior unknown | Members 2 and 3 |
| Inactive vs suspended | Open | agree distinct effects and transition matrix | Members 2 and 4 |
| Lifecycle permissions | Open | role/action matrix and restricted admin powers need approval | Members 2 and 3 |
| Archive vs permanent deletion | Open | retention, recovery, schema/media disposition need approval | Members 2 and 3 |
| Logo/favicon restrictions | Open | MIME/content validation, dimensions, size, SVG policy, storage | Members 1 and 2 |
| Authentication/session approach | Confirmed by user | same-origin Devise cookie session with CSRF; explicit API-only middleware and Angular development proxy implemented by Member 3 | Member 3 |
| Contact invitations / Tenant Admin account | Open | contacts never automatically become active accounts | Member 3 |
| Member identity mapping | Open | verified names/usernames required before assignment/invitation | Member 4 |
| Public-qualified management records | Proposed implementation | six new models; Member 3 must review placement and Apartment exclusions before development migration | Members 2 and 3 |
| PATCH concurrency and array replacement | Proposed implementation | If-Match required; omitted collections preserved, supplied arrays replace owned records; UI integration pending | Members 1, 2 and 4 |
| Decimal storage | Proposed implementation | unconstrained PostgreSQL numeric / decimal strings, no guessed currency scale or discount rules | Member 2 |
| Synchronous provisioning and compensation | Proposed implementation, integration blocked | no success before ready; durable crash recovery and idempotency remain missing | Members 2 and 3 |
| Admin control of lifecycle/deletion/discounts | Partial clarification | user said admin; exact roles/transitions, archive/deletion/retention and discount semantics still unspecified; mutations disabled | Members 2 and 3 |
| Isolation evidence record/endpoint | Confirmed by user | synthetic tenant-local marker, endpoint routed only in test | Member 3 |
| Public shared model placement | Member 3 technical review; peer review pending | public-qualified cross-tenant management records excluded from Apartment cloning/migration | Members 2 and 3 |
| PostgreSQL-only atomic provisioning | Implemented engineering choice for review | registry and schema DDL use same transaction; confirmed failed attempts can retry without orphan schemas; ambiguous success still lacks idempotency key | Members 2 and 3 |
| CPQ Admin assignment changes | Proposed conservative restriction | unchanged sets allowed, changes require Super Admin pending reassignment policy | Members 2 and 3 |

## Approved lifecycle clarification

The user explicitly approved the following transition matrix. This supersedes the earlier open lifecycle role/transition entries; implementation and acceptance remain pending.

| From | To | Authorized platform role |
| --- | --- | --- |
| Inactive | Active | Super Admin or assigned CPQ Admin, after required setup is complete |
| Active | Inactive | Super Admin or assigned CPQ Admin |
| Active or Inactive | Suspended | Super Admin |
| Suspended | Inactive | Super Admin; activation is a separate action |
| Active, Inactive or Suspended | Archived | Super Admin |
| Archived | Inactive | Super Admin |

Primary contact is a contact record, never an automatic Tenant Admin account. Access requires an explicit invitation and role assignment; implementing that workflow remains outside this increment.

The user subsequently confirmed the entire attached table as the final decision and requested implementation. It supersedes historical open business entries above, including the fee validation limit. No permanent deletion or automatic contact-to-account workflow is authorized. Required setup for activation means valid required settings plus completed schema provisioning.

Sources inspected for compatibility: [Angular matrix](https://angular.dev/reference/versions), [Rails 8.1.4 metadata](https://rubygems.org/gems/rails/versions/8.1.4), [Devise](https://rubygems.org/gems/devise/versions/5.0.4), [ros-apartment 3.4.4](https://rubygems.org/gems/ros-apartment/versions/3.4.4), [maintained fork](https://github.com/rails-on-services/apartment), [Rails maintenance policy](https://guides.rubyonrails.org/maintenance_policy.html). Consult version 3 documentation for Apartment configuration; upstream main now describes version 4.

## Final approved business requirements

The following supplied table is approved in full. Its original recommendation wording is retained for provenance; status is now **Confirmed by user**. Owner roles: Members 1/2 for form/business rules, Member 3 for permissions/tenancy and Member 4 for lifecycle UI/integration.

| Decision | Recommended answer for your project |
|---|---|
| **Required fields** | Require company name, industry, currency, one responsible CPQ Admin, and at least one contact with a name and valid email. Exactly one contact must be primary. Subscription fee must have a value, with **0 allowed**. Branding colours and typography should have defaults. Description, phone numbers, additional contacts, logo and favicon can be empty. Require payment method only when the subscription fee is greater than zero, and discount duration only when a discount is applied. |
| **Admin assignment** | Assign **exactly one responsible CPQ Admin at creation**. This is the SELISE staff member responsible for that tenant, not the tenant’s own administrator. The Super Admin can reassign responsibility later. Record reassignment in the audit log. |
| **Subscription fee** | Use **monthly billing** for the initial version. Allow zero for free/demo tenants; reject negative amounts. For the initial supported currencies, allow two decimal places and store money using a decimal database type. A proposed technical range is **0–999,999,999.99**; this is a validation limit, not an agreed commercial price cap. Store these details even if automated billing is outside the implementation scope. |
| **Currency** | Start with **BTN, INR, USD and EUR**, using an extensible currency list. Clearly distinguish the **subscription billing currency** from currencies used in customer quotations. Allow changing the billing currency before the first invoice; afterwards, lock it for the initial implementation. Existing quotations and invoices must retain their original currency. Automatic exchange-rate conversion can be a later feature. |
| **Discount** | Use a **percentage discount on the tenant’s subscription fee**, from **0–100%**, with up to two decimal places. Define duration as a positive whole number of **monthly billing cycles**, beginning with the first applicable cycle. Zero discount means no duration is required. Keep this separate from discounts on products or quotations. |
| **Payment method** | Initially support **Bank Transfer** and **Other**, with a description required for Other. Treat this as descriptive information about how the tenant pays SELISE. It does not process payments or establish that a payment has been received. Add other options when SELISE confirms its supported methods. |
| **Reference lists** | SELISE supplies the approved business options, and the **Super Admin controls platform-wide lists**. Begin with seeded industry, currency and payment-method lists. Typography should use a developer-maintained list of fonts the application actually supports. Tenant users select options rather than create global ones. Disable used options instead of deleting them from historical records. |
| **Lifecycle** | Create tenants as **Inactive** while setup is completed. **Active** allows tenant users access, subject to their permissions. **Inactive** means not yet enabled or voluntarily disabled. **Suspended** means access has been blocked administratively. **Archived** means retired and retained for records. All non-active states block tenant-user access; authorised platform staff retain management access. Changing status alone should not automatically alter subscription charges. |
| **Action permissions** | **Super Admin:** create tenants, assign/reassign CPQ Admins, manage all tenants, change commercial details, activate/deactivate, suspend/reactivate, archive/restore and maintain reference lists. **Assigned CPQ Admin:** view assigned tenants, edit company/contact/branding information, and activate/deactivate them. They cannot reassign ownership, change commercial terms, suspend tenants, archive them or access unassigned tenants. **Tenant Admin:** manage permitted users and settings within their own tenant; cannot change platform-level subscription or lifecycle settings. |
| **Archive/deletion** | Implement **archive and restore**, with no permanent-deletion option in the initial interface. Preserve tenant settings, users and memberships, products, quotations, commercial records and audit logs. If using a database schema per tenant, retain that schema too. Restore an archived tenant to **Inactive**, then activate it explicitly after review. |
| **Uploads** | Accept **PNG, JPEG and WebP** for logos, up to **2 MB**, with a maximum dimension of **2048 × 2048 px**. Accept **PNG or ICO** for favicons, up to **500 KB**; validate dimensions of 16, 32, 48, 64, 128 or 256 px square. Validate actual file contents on the server. Store assets using generated names under tenant-specific storage paths. Replace the old asset only after the new upload and record update succeed. Removal restores default branding. |
| **Clearing values** | Provide explicit **Remove logo**, **Remove favicon** and **Reset to default** controls. Optional text fields can be cleared and saved. In update requests, distinguish **an omitted field = keep existing value** from **an explicit null = remove value**. Required fields cannot be cleared. |

Technical choices for this increment: default colours `#17365D` and `#2563EB`; supported system sans-serif and Georgia serif fonts, with system sans-serif default. Asset bytes are stored in PostgreSQL with generated tenant-prefixed storage keys (not public filenames), avoiding filesystem/transaction inconsistency. These are implementation choices, not additional SELISE industry values.

## Approved account onboarding extension

Confirmed by user: Super Admin manages CPQ Admin staff through single-use activation email; no permanent deletion, self-deactivation or UI Super Admin provisioning. Super Admin and assigned CPQ Admin explicitly invite Tenant Admins with 72-hour single-use links and resend/revoke controls. Tenant access requires Active status. Primary contacts remain contacts. SMTP delivery was selected; provider configuration is still pending. This supersedes earlier statements that invitations are outside scope. Owners: Member 3 backend access, Members 1/4 UI, Member 2 review. See [implementation and limits](account-onboarding.md).

## Manual invitation delivery — confirmed by user

The user explicitly dropped SMTP and selected the previously offered alternative: copyable links for private manual sharing. This supersedes the SMTP choice above. Expiry (72 hours), single-use consumption, role checks, replacement/revocation and Active-only workspace access remain unchanged. No email provider is needed. Raw tokens appear only once in authenticated issuance responses, not persisted/history. Owner: Member 3 access backend, Members 1/4 UI, Member 2 review. See account-onboarding.md.
