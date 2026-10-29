import { PricingManager } from './pricing-manager';
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { ReferenceOption, ReferenceResponse } from './reference-data';
import { Session } from '../navigation/session';
import { switchMap } from 'rxjs';
@Component({
  imports: [FormsModule, PricingManager],
  host: { class: 'directory-page' },
  template: `
    <div class="heading">
      <div>
        <p class="eyebrow">WORKSPACE CONFIGURATION</p>
        <h1>Reference options</h1>
        <p class="subheading">
          Keep your company sectors, currencies and payment methods consistent.
        </p>
      </div>
    </div>
    @if (message()) {
      <p class="notice" role="status">{{ message() }}</p>
    }
    @if (deleting(); as option) {
      <section
        class="card"
        role="dialog"
        aria-modal="false"
        aria-labelledby="delete-industry-title"
        (keydown.escape)="deleting.set(null)"
      >
        <h2 id="delete-industry-title">Delete {{ option.label }}?</h2>
        <p>
          Permanent deletion is available only if no tenant uses this industry. Otherwise,
          deactivate it instead.
        </p>
        <button type="button" [disabled]="busy()" (click)="remove(option)">
          Confirm permanent deletion
        </button>
        <button type="button" [disabled]="busy()" (click)="deleting.set(null)">Cancel</button>
      </section>
    }
    @if (session.actor()?.role === 'super_admin') {
      <nav class="configuration-nav" aria-label="Configuration sections">
        <a href="#subscription-pricing">Subscription pricing</a
        ><a href="#reference-catalog">Reference catalog</a>
      </nav>
      <app-pricing-manager id="subscription-pricing" />
      <div class="reference-layout" id="reference-catalog">
        <section class="card">
          <div class="card-heading">
            <h2>Add an option</h2>
            <span class="section-kicker">PLATFORM-WIDE</span>
          </div>
          <p class="muted">
            Use company sectors and business options approved by your organization.
          </p>
          <form (ngSubmit)="add()">
            <label for="kind">Reference list</label
            ><select id="kind" [(ngModel)]="kind" name="kind">
              <option value="industry">Industry</option>
              <option value="currency">Currency</option>
              <option value="payment_method">Payment method</option></select
            ><label for="label">Display name</label
            ><input
              id="label"
              [(ngModel)]="label"
              name="label"
              placeholder="Name shown in tenant forms"
              required
            /><label for="code">Stable code</label
            ><input
              id="code"
              [(ngModel)]="code"
              name="code"
              placeholder="A unique identifier for this option"
              required
            /><small>Codes stay fixed so existing company records remain consistent.</small
            ><button class="primary" [disabled]="busy() || !code.trim() || !label.trim()">
              Add option <span aria-hidden="true">＋</span>
            </button>
          </form>
        </section>
        <section class="directory-panel">
          <div class="panel-heading">
            <div>
              <h2>Your reference lists</h2>
              <p>Disable an option to keep it out of new selections.</p>
            </div>
            <span class="badge">{{ loading() ? 'Loading…' : options().length + ' options' }}</span>
          </div>
          <label class="catalog-search" for="catalog-query"
            >Search reference options<input
              id="catalog-query"
              type="search"
              [(ngModel)]="catalogQuery"
              placeholder="Search by name, type or code"
          /></label>
          <ul class="reference-list" tabindex="0" aria-label="Reference options">
            @if (loading()) {
              <li role="status">Loading reference options…</li>
            }
            @for (o of filteredOptions(); track o.id) {
              <li>
                <div class="reference-type">
                  {{ o.kind === 'industry' ? 'IN' : o.kind === 'currency' ? 'CU' : 'PM' }}
                </div>
                <div class="reference-name">
                  <strong>{{ o.label }}</strong
                  ><small>{{ o.kind.replaceAll('_', ' ') }} · {{ o.code }}</small>
                </div>
                <span class="badge" [attr.data-status]="o.enabled ? 'active' : 'inactive'">{{
                  o.enabled ? 'Enabled' : 'Disabled'
                }}</span
                ><button
                  [disabled]="busy()"
                  (click)="toggle(o)"
                  [attr.aria-label]="(o.enabled ? 'Disable ' : 'Enable ') + o.label"
                >
                  {{ o.enabled ? 'Disable' : 'Enable' }}
                </button>
                @if (o.kind === 'industry') {
                  <button
                    type="button"
                    [disabled]="busy()"
                    (click)="deleting.set(o)"
                    [attr.aria-label]="'Delete ' + o.label"
                  >
                    Delete
                  </button>
                }
              </li>
            } @empty {
              @if (!loading()) {
                <li class="muted">No reference options to display.</li>
              }
            }
          </ul>
        </section>
      </div>
    } @else {
      <div class="card">
        <h2>Administrator access required</h2>
        <p class="muted">Only a Super Admin can manage platform reference options.</p>
      </div>
    }
  `,
  styles: `
    .catalog-search {
      display: grid;
      gap: 8px;
      padding: 16px 24px;
      font-size: 12px;
      color: var(--muted);
      border-bottom: 1px solid var(--line);
    }
    .catalog-search input {
      width: 100%;
    }
    .reference-list {
      max-height: 640px;
      overflow: auto;
      scrollbar-color: #b6c0cd transparent;
    }

    .configuration-nav {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-bottom: 24px;
      border-bottom: 1px solid var(--line);
    }
    .configuration-nav a {
      display: inline-flex;
      align-items: center;
      min-height: 44px;
      padding: 8px 12px;
      text-decoration: none;
      font-weight: 600;
    }
    .configuration-nav a:hover {
      background: var(--accent-soft);
    }
    #reference-catalog {
      scroll-margin-top: 24px;
    }

    .reference-layout {
      display: grid;
      grid-template-columns: minmax(240px, 310px) minmax(0, 1fr);
      gap: 24px;
      align-items: start;
    }
    form {
      display: grid;
      gap: 8px;
      margin-top: 24px;
    }
    label {
      font-size: 12px;
      color: #667388;
      margin-top: 8px;
    }
    input,
    select {
      font-size: 12px;
      width: 100%;
    }
    small {
      font-size: 12px;
      color: #687487;
      line-height: 1.7;
    }
    form button {
      margin-top: 18px;
      justify-content: space-between;
    }
    .reference-list {
      padding: 0;
      margin: 0;
      list-style: none;
    }
    .reference-list li {
      padding: 18px 24px;
      border-top: 1px solid #edf0f4;
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
      align-items: center;
    }
    .reference-type {
      height: 32px;
      width: 32px;
      border-radius: 8px;
      background: #f2f4f8;
      display: grid;
      place-content: center;
      color: #687487;
      font-size: 12px;
      flex-shrink: 0;
    }
    .reference-name {
      flex: 1;
      min-width: min(160px, 100%);
      overflow-wrap: anywhere;
    }
    .reference-name strong {
      font-size: 12px;
      font-weight: 550;
    }
    .reference-name small {
      display: block;
      font-size: 12px;
      color: #687487;
      text-transform: capitalize;
      margin-top: 4px;
    }
    .reference-list button {
      font-size: 12px;
      min-height: 44px;
      padding: 5px 9px;
    }
    .reference-list .badge {
      font-size: 12px;
    }
    @media (max-width: 1100px) {
      .reference-layout {
        grid-template-columns: 1fr;
      }
      .reference-list li {
        padding: 16px 20px;
      }
    }
    @media (max-width: 450px) {
      .reference-list li {
        flex-wrap: wrap;
        gap: 10px;
      }
      .reference-name {
        min-width: 120px;
      }
      .reference-list .badge {
        margin-left: 42px;
      }
      .reference-list button {
        margin-left: auto;
      }
    }
  `,
})
export class ReferenceManager {
  private http = inject(HttpClient);
  readonly session = inject(Session);
  options = signal<ReferenceOption[]>([]);
  message = signal('');
  deleting = signal<ReferenceOption | null>(null);
  busy = signal(false);
  loading = signal(true);
  catalogQuery = '';
  filteredOptions() {
    const query = this.catalogQuery.trim().toLocaleLowerCase();
    return this.options().filter((option) =>
      [option.label, option.kind.replaceAll('_', ' '), option.code]
        .join(' ')
        .toLocaleLowerCase()
        .includes(query),
    );
  }
  kind = 'industry';
  code = '';
  label = '';
  constructor() {
    this.load();
  }
  load() {
    this.loading.set(true);
    this.http.get<ReferenceResponse>('/api/v1/reference_options?include_disabled=true').subscribe({
      next: (r) => {
        this.options.set(r.data);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.message.set('Reference options could not be loaded. Sign in and retry.');
      },
    });
  }
  private mutate(method: 'post' | 'patch', path: string, option: unknown) {
    if (this.busy()) return;
    this.busy.set(true);
    this.session
      .csrf()
      .pipe(switchMap(() => this.http.request(method, path, { body: { option } })))
      .subscribe({
        next: () => {
          this.busy.set(false);
          this.message.set('Reference option saved.');
          if (method === 'post') {
            this.code = '';
            this.label = '';
          }
          this.load();
        },
        error: () => {
          this.busy.set(false);
          this.message.set('Could not save. Check permissions and use a unique nonblank code.');
        },
      });
  }
  remove(option: ReferenceOption) {
    if (this.busy()) return;
    this.busy.set(true);
    this.session
      .csrf()
      .pipe(switchMap(() => this.http.delete('/api/v1/reference_options/' + option.id)))
      .subscribe({
        next: () => {
          this.busy.set(false);
          this.deleting.set(null);
          this.message.set('Industry deleted.');
          this.load();
        },
        error: (e) => {
          this.busy.set(false);
          this.message.set(e?.error?.error?.message || 'Could not delete industry. Please retry.');
        },
      });
  }
  add() {
    this.mutate('post', '/api/v1/reference_options', {
      kind: this.kind,
      code: this.code.trim(),
      label: this.label.trim(),
    });
  }
  toggle(o: ReferenceOption) {
    this.mutate('patch', `/api/v1/reference_options/${o.id}`, { enabled: !o.enabled });
  }
}
