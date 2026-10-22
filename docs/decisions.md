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

Sources inspected for compatibility: [Angular matrix](https://angular.dev/reference/versions), [Rails 8.1.4 metadata](https://rubygems.org/gems/rails/versions/8.1.4), [Devise](https://rubygems.org/gems/devise/versions/5.0.4), [ros-apartment 3.4.4](https://rubygems.org/gems/ros-apartment/versions/3.4.4), [maintained fork](https://github.com/rails-on-services/apartment), [Rails maintenance policy](https://guides.rubyonrails.org/maintenance_policy.html). Consult version 3 documentation for Apartment configuration; upstream main now describes version 4.
