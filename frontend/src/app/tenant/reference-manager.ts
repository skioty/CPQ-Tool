import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { ReferenceOption, ReferenceResponse } from './reference-data';
import { Session } from '../navigation/session';
import { switchMap } from 'rxjs';
@Component({
  imports: [FormsModule],
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
    @if (session.actor()?.role === 'super_admin') {
      <div class="reference-layout">
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
            <span class="badge">{{ options().length }} options</span>
          </div>
          <ul class="reference-list">
            @for (o of options(); track o.id) {
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
              </li>
            } @empty {
              <li class="muted">No reference options to display.</li>
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
    .reference-layout {
      display: grid;
      grid-template-columns: 310px minmax(0, 1fr);
      gap: 24px;
      align-items: start;
    }
    form {
      display: grid;
      gap: 8px;
      margin-top: 24px;
    }
    label {
      font-size: 11px;
      color: #667388;
      margin-top: 8px;
    }
    input,
    select {
      font-size: 12px;
      width: 100%;
    }
    small {
      font-size: 10px;
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
      font-size: 9px;
      flex-shrink: 0;
    }
    .reference-name {
      flex: 1;
      min-width: 0;
    }
    .reference-name strong {
      font-size: 12px;
      font-weight: 550;
    }
    .reference-name small {
      display: block;
      font-size: 9px;
      color: #687487;
      text-transform: capitalize;
      margin-top: 4px;
    }
    .reference-list button {
      font-size: 10px;
      min-height: 29px;
      padding: 5px 9px;
    }
    .reference-list .badge {
      font-size: 9px;
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
  busy = signal(false);
  kind = 'industry';
  code = '';
  label = '';
  constructor() {
    this.load();
  }
  load() {
    this.http.get<ReferenceResponse>('/api/v1/reference_options?include_disabled=true').subscribe({
      next: (r) => this.options.set(r.data),
      error: () => this.message.set('Reference options could not be loaded. Sign in and retry.'),
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
          this.load();
        },
        error: () => {
          this.busy.set(false);
          this.message.set('Could not save. Check permissions and use a unique nonblank code.');
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
