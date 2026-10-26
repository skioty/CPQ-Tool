import { Subscription } from 'rxjs';
import {
  Component,
  ElementRef,
  Injector,
  afterNextRender,
  effect,
  inject,
  input,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { DatePipe } from '@angular/common';
import { Router } from '@angular/router';
import { Session } from '../../navigation/session';
import { accessError } from '../../access/access-api';
interface RetentionReport {
  eligible: boolean;
  eligible_at: string | null;
  archived_at: string | null;
  retention_days: number | null;
  blocking_reasons: string[];
  clearances: Record<string, boolean | string | null>;
}
@Component({
  selector: 'app-tenant-retention',
  imports: [FormsModule, DatePipe],
  template: `<section class="retention-card">
    <div class="retention-heading">
      <div>
        <h2>Archive and retention</h2>
        <p class="muted">Archived records are retained. Nothing is deleted automatically.</p>
      </div>
      <button (click)="load()" [disabled]="busy()">Refresh eligibility</button>
    </div>
    @if (error()) {
      <p class="error-summary" role="alert">{{ error() }}</p>
    }
    @if (message()) {
      <p class="success" role="status">{{ message() }}</p>
    }
    @if (report(); as info) {
      <dl>
        <dt>Retention period</dt>
        <dd>{{ info.retention_days ?? 'Not configured' }} days</dd>
        <dt>Archived on</dt>
        <dd>
          {{
            info.archived_at ? (info.archived_at | date: 'medium') : 'Not archived / date unknown'
          }}
        </dd>
        <dt>Earliest eligibility</dt>
        <dd>{{ info.eligible_at ? (info.eligible_at | date: 'medium') : 'Not available' }}</dd>
      </dl>
      @if (info.blocking_reasons.length) {
        <div class="retention-blockers">
          <h3>Deletion is blocked</h3>
          <ul>
            @for (reason of info.blocking_reasons; track reason) {
              <li>{{ reason }}</li>
            }
          </ul>
        </div>
      } @else {
        <p class="notice">
          The recorded checks currently allow deletion in this development environment.
          Reauthentication and exact tenant-name confirmation are still required.
        </p>
      }
      @if (session.actor()?.role === 'super_admin') {
        <details>
          <summary>Review legal, billing and record-retention checks</summary>
          <p>
            Review the applicable records before marking a clearance resolved. Unknown or unresolved
            checks block deletion.
          </p>
          <form #review="ngForm" (ngSubmit)="save()">
            @for (field of fields; track field.key) {
              <label [for]="field.key">{{ field.label }}</label
              ><select
                [id]="field.key"
                [name]="field.key"
                [(ngModel)]="clearances[field.key]"
                [disabled]="busy()"
              >
                <option [ngValue]="null">Unknown / not reviewed</option>
                <option [ngValue]="true">
                  {{ field.key === 'legal_hold' ? 'Legal hold present' : 'Resolved / approved' }}
                </option>
                <option [ngValue]="false">
                  {{ field.key === 'legal_hold' ? 'No legal hold' : 'Unresolved / not approved' }}
                </option>
              </select>
            }
            <label for="policy-reference">Record-retention policy reference</label
            ><input
              id="policy-reference"
              name="policy"
              [(ngModel)]="clearances['retention_policy_reference']"
              maxlength="255"
              [disabled]="busy()"
            />
            <label for="retention-note">Review note (required)</label
            ><textarea
              id="retention-note"
              name="note"
              [(ngModel)]="note"
              required
              maxlength="500"
              [disabled]="busy()"
            ></textarea
            ><button [disabled]="busy() || review.invalid">Save reviewed clearances</button>
          </form>
        </details>
        <div class="deletion-action">
          <div>
            <h3>Permanent deletion</h3>
            <p>
              Removes the tenant registry and schema. The recorded audit and retention evidence is
              preserved.
            </p>
          </div>
          <button class="danger" [disabled]="busy() || !info.eligible" (click)="open()">
            Permanently delete tenant
          </button>
        </div>
      }
    } @else if (loading()) {
      <p role="status">Checking retention eligibility…</p>
    }
    @if (confirming()) {
      <dialog #dialog (cancel)="$event.preventDefault(); close()" aria-labelledby="deletion-title">
        <h2 id="deletion-title">Permanently delete {{ company() }}?</h2>
        <p>
          This action cannot be undone through the application. The backend will recheck all
          clearances.
        </p>
        <form #confirmationForm="ngForm" (ngSubmit)="remove()">
          <label for="deletion-name">Type the tenant name exactly</label
          ><input
            id="deletion-name"
            name="confirmation"
            [(ngModel)]="confirmation"
            required
            autocomplete="off"
            [disabled]="busy()"
          /><label for="deletion-password">Your current password</label
          ><input
            id="deletion-password"
            name="password"
            type="password"
            [(ngModel)]="password"
            required
            autocomplete="current-password"
            [disabled]="busy()"
          />
          <div class="dialog-actions">
            <button type="button" autofocus (click)="close()" [disabled]="busy()">Cancel</button
            ><button
              class="danger"
              [disabled]="busy() || confirmationForm.invalid || confirmation !== company()"
            >
              {{ busy() ? 'Deleting…' : 'Confirm permanent deletion' }}
            </button>
          </div>
        </form>
      </dialog>
    }
  </section>`,
  styles: `
    .retention-card {
      background: white;
      padding: 24px;
      border: 1px solid var(--line);
      border-radius: 8px;
    }
    .retention-heading,
    .deletion-action {
      display: flex;
      align-items: start;
      justify-content: space-between;
      gap: 24px;
      flex-wrap: wrap;
    }
    .retention-heading p {
      margin: 0;
    }
    dl {
      display: grid;
      grid-template-columns: 180px minmax(0, 1fr);
      gap: 12px;
      margin: 28px 0;
    }
    dt {
      color: var(--muted);
    }
    dd {
      margin: 0;
    }
    .retention-blockers {
      background: var(--warning-soft);
      padding: 20px;
      border-radius: 6px;
      margin-bottom: 24px;
    }
    .retention-blockers h3 {
      margin-top: 0;
    }
    .retention-blockers ul {
      margin: 0;
      padding-left: 20px;
    }
    details {
      border-top: 1px solid var(--line);
      padding-top: 20px;
    }
    summary {
      cursor: pointer;
      min-height: 44px;
      color: var(--accent);
      font-weight: 600;
    }
    form {
      display: grid;
      gap: 10px;
      margin: 20px 0;
    }
    form input,
    form select,
    form textarea {
      width: 100%;
    }
    form > button {
      justify-self: start;
      margin-top: 12px;
    }
    .deletion-action {
      border-top: 1px solid var(--line);
      padding-top: 24px;
      margin-top: 24px;
    }
    .deletion-action p {
      max-width: 560px;
      color: var(--muted);
      font-size: 13px;
    }
    dialog {
      width: min(540px, calc(100vw - 32px));
      border: 1px solid var(--line);
      border-radius: 12px;
      padding: 28px;
      color: var(--ink);
    }
    dialog::backdrop {
      background: #14263d88;
    }
    .dialog-actions {
      display: flex;
      gap: 12px;
      justify-content: flex-end;
      margin-top: 24px;
    }
    dialog p {
      color: var(--muted);
    }
    @media (max-width: 560px) {
      dl {
        grid-template-columns: 1fr;
        gap: 4px;
      }
      dd {
        margin-bottom: 12px;
      }
      .dialog-actions {
        flex-direction: column;
      }
    }
  `,
})
export class TenantRetention {
  readonly tenantId = input.required<string>();
  readonly company = input.required<string>();
  readonly session = inject(Session);
  private http = inject(HttpClient);
  private router = inject(Router);
  private injector = inject(Injector);
  private dialog = viewChild<ElementRef<HTMLDialogElement>>('dialog');
  readonly report = signal<RetentionReport | null>(null);
  readonly loading = signal(false);
  readonly busy = signal(false);
  readonly error = signal('');
  readonly message = signal('');
  readonly confirming = signal(false);
  readonly fields = [
    { key: 'legal_hold', label: 'Legal hold' },
    { key: 'billing_resolved', label: 'Outstanding billing' },
    { key: 'contracts_resolved', label: 'Active subscriptions and contracts' },
    { key: 'retention_records_approved', label: 'Records preservation policy approval' },
  ];
  private request?: Subscription;
  private mutation?: Subscription;
  clearances: Record<string, boolean | string | null> = {};
  note = '';
  password = '';
  confirmation = '';
  constructor() {
    effect(() => {
      const id = this.tenantId();
      untracked(() => {
        this.request?.unsubscribe();
        this.mutation?.unsubscribe();
        this.busy.set(false);
        this.close();
        this.error.set('');
        this.message.set('');
        this.report.set(null);
        this.load(id);
      });
    });
  }
  load(id = this.tenantId()) {
    this.request?.unsubscribe();
    this.loading.set(true);
    this.request = this.http
      .get<{ data: RetentionReport }>('/api/v1/tenants/' + id + '/retention')
      .subscribe({
        next: (r) => {
          if (id !== this.tenantId()) return;
          this.report.set(r.data);
          this.clearances = { ...r.data.clearances };
          this.loading.set(false);
        },
        error: (e) => {
          this.error.set(accessError(e));
          this.loading.set(false);
        },
      });
  }
  save() {
    if (this.busy() || !this.note.trim()) return;
    this.busy.set(true);
    this.error.set('');
    this.mutation = this.http
      .patch<{ data: RetentionReport }>('/api/v1/tenants/' + this.tenantId() + '/retention', {
        clearances: this.clearances,
        review_note: this.note,
      })
      .subscribe({
        next: (r) => {
          this.report.set(r.data);
          this.busy.set(false);
          this.note = '';
          this.message.set('Retention clearances reviewed and recorded.');
        },
        error: (e) => {
          this.busy.set(false);
          this.error.set(accessError(e));
        },
      });
  }
  open() {
    if (!this.report()?.eligible) return;
    this.password = '';
    this.confirmation = '';
    this.confirming.set(true);
    afterNextRender(() => this.dialog()?.nativeElement.showModal(), { injector: this.injector });
  }
  close() {
    if (this.busy()) return;
    this.dialog()?.nativeElement.close();
    this.confirming.set(false);
    this.password = '';
    this.confirmation = '';
  }
  remove() {
    if (
      this.busy() ||
      !this.report()?.eligible ||
      !this.password ||
      this.confirmation !== this.company()
    )
      return;
    this.busy.set(true);
    this.error.set('');
    this.mutation = this.http
      .delete('/api/v1/tenants/' + this.tenantId() + '/permanent_deletion', {
        body: { password: this.password, confirmation: this.confirmation },
      })
      .subscribe({
        next: () => {
          this.password = '';
          this.busy.set(false);
          this.close();
          void this.router.navigateByUrl('/tenants');
        },
        error: (e) => {
          this.password = '';
          this.busy.set(false);
          this.close();
          this.error.set(accessError(e));
          this.load();
        },
      });
  }
  ngOnDestroy() {
    this.request?.unsubscribe();
    this.mutation?.unsubscribe();
    this.password = '';
    this.confirmation = '';
    this.dialog()?.nativeElement.close();
  }
}
