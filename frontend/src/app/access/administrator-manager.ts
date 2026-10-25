import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { DatePipe } from '@angular/common';
import { LifecycleDialog } from '../navigation/lifecycle-dialog';
import { StaffAccount, accessError } from './access-api';
@Component({
  imports: [FormsModule, DatePipe, LifecycleDialog],
  host: { class: 'directory-page' },
  template: `
    <div class="heading">
      <div>
        <p class="eyebrow">PLATFORM ACCESS</p>
        <h1>Administrators</h1>
        <p class="subheading">Manage SELISE CPQ Admin accounts and their activation invitations.</p>
      </div>
    </div>
    @if (error()) {
      <p class="error-summary" role="alert">{{ error() }}</p>
    }
    @if (message()) {
      <p class="success" role="status">{{ message() }}</p>
    }
    @if (loading()) {
      <p role="status">Loading administrator accounts…</p>
    }
    @if (!loading() && !error() && !mailReady()) {
      <p class="notice" role="status">
        SMTP email delivery is not configured. Account activation invitations cannot be sent yet.
        Configure email delivery before creating accounts.
      </p>
    }
    <div class="access-layout">
      <section class="card">
        <h2>Invite a CPQ Admin</h2>
        <p class="muted">
          The recipient sets their own password using a single-use activation link. Super Admin
          accounts use controlled provisioning.
        </p>
        <form #staff="ngForm" (ngSubmit)="create()">
          <label for="staff-name">Name (optional)</label
          ><input
            id="staff-name"
            name="name"
            [(ngModel)]="name"
            [disabled]="busy()"
            autocomplete="name"
          /><label for="staff-email">Work email (required)</label
          ><input
            id="staff-email"
            name="email"
            [(ngModel)]="email"
            type="email"
            email
            required
            [disabled]="busy()"
            autocomplete="email"
          /><button
            class="primary"
            [disabled]="busy() || loading() || !mailReady() || staff.invalid"
          >
            {{ busy() ? 'Working…' : 'Create and email invitation' }}
          </button>
        </form>
      </section>
      <section class="directory-panel">
        <div class="panel-heading">
          <div>
            <h2>Platform administrators</h2>
            <p>Assigned tenants must be reassigned before an account is disabled.</p>
          </div>
          <button (click)="load()" [disabled]="busy()">Refresh</button>
        </div>
        <ul class="staff-list">
          @for (a of accounts(); track a.id) {
            <li>
              <div class="staff-title">
                <div>
                  <strong>{{ a.name || a.email }}</strong>
                  <p>{{ a.email }}</p>
                </div>
                <span class="badge" [attr.data-status]="a.enabled ? 'active' : 'inactive'">{{
                  a.activated ? (a.enabled ? 'Enabled' : 'Disabled') : 'Awaiting activation'
                }}</span>
              </div>
              <p class="muted">
                {{ a.role === 'super_admin' ? 'Super Admin' : 'CPQ Admin' }} ·
                {{ a.assigned_tenants }} assigned tenants
              </p>
              @if (a.role === 'admin') {
                <label [for]="'name-' + a.id">Display name</label>
                <div class="row-actions">
                  <input [id]="'name-' + a.id" [(ngModel)]="a.name" [disabled]="busy()" /><button
                    (click)="save(a)"
                    [disabled]="busy()"
                  >
                    Save name
                  </button>
                  @if (a.activated) {
                    <button
                      (click)="a.enabled ? selected.set(a) : enable(a)"
                      [disabled]="busy() || (a.enabled && a.assigned_tenants > 0)"
                    >
                      {{ a.enabled ? 'Disable account' : 'Enable account' }}
                    </button>
                  }
                </div>
                @if (!a.activated && !a.invitation) {
                  <button [disabled]="busy() || !mailReady()" (click)="sendActivation(a)">
                    Send activation email
                  </button>
                }
                @if (!a.activated && a.invitation) {
                  <p>
                    Invitation: {{ a.invitation.state }} · Expires
                    {{ a.invitation.expires_at | date: 'medium' }}
                  </p>
                  <div class="row-actions">
                    <button [disabled]="busy() || !mailReady()" (click)="resend(a.invitation.id)">
                      Resend activation
                    </button>
                    @if (a.invitation.state !== 'revoked') {
                      <button [disabled]="busy()" (click)="revoke(a.invitation.id)">
                        Revoke invitation
                      </button>
                    }
                  </div>
                }
              } @else {
                <p class="muted">Managed through controlled Super Admin provisioning.</p>
              }
            </li>
          } @empty {
            <li>No accounts to display.</li>
          }
        </ul>
      </section>
    </div>
    @if (selected(); as account) {
      <app-lifecycle-dialog
        [action]="disableAction"
        [company]="account.name || account.email"
        (cancelled)="selected.set(null)"
        (confirmed)="disable()"
      />
    }
  `,
  styleUrl: './access-pages.scss',
})
export class AdministratorManager {
  private http = inject(HttpClient);
  readonly accounts = signal<StaffAccount[]>([]);
  readonly loading = signal(true);
  readonly busy = signal(false);
  readonly mailReady = signal(false);
  readonly error = signal('');
  readonly message = signal('');
  readonly selected = signal<StaffAccount | null>(null);
  name = '';
  email = '';
  readonly disableAction = {
    code: 'disable_account',
    label: 'Disable CPQ Admin',
    confirmation:
      'This account will lose platform access. All assigned tenants must be reassigned first. Records are retained.',
  };
  constructor() {
    this.load();
  }
  load() {
    this.loading.set(true);
    this.http
      .get<{ data: StaffAccount[]; email_delivery_configured: boolean }>('/api/v1/administrators')
      .subscribe({
        next: (r) => {
          this.accounts.set(r.data);
          this.mailReady.set(r.email_delivery_configured);
          this.loading.set(false);
        },
        error: (e) => {
          this.error.set(accessError(e));
          this.loading.set(false);
        },
      });
  }
  private run(method: string, url: string, body: any, success: string, clear = false) {
    if (this.busy()) return;
    this.busy.set(true);
    this.error.set('');
    this.message.set('');
    this.http.request(method, url, { body }).subscribe({
      next: () => {
        this.busy.set(false);
        this.message.set(success);
        if (clear) {
          this.name = '';
          this.email = '';
        }
        this.load();
      },
      error: (e) => {
        this.busy.set(false);
        this.error.set(accessError(e));
        this.load();
      },
    });
  }
  create() {
    if (!this.mailReady()) return;
    this.run(
      'POST',
      '/api/v1/administrators',
      { administrator: { name: this.name, email: this.email } },
      'Activation email sent. The account remains disabled until accepted.',
      true,
    );
  }
  save(a: StaffAccount) {
    this.run(
      'PATCH',
      '/api/v1/administrators/' + a.id,
      { administrator: { name: a.name } },
      'Administrator name saved.',
    );
  }
  enable(a: StaffAccount) {
    this.run(
      'PATCH',
      '/api/v1/administrators/' + a.id,
      { administrator: { enabled: true } },
      'Administrator enabled.',
    );
  }
  disable() {
    const a = this.selected();
    this.selected.set(null);
    if (a)
      this.run(
        'PATCH',
        '/api/v1/administrators/' + a.id,
        { administrator: { enabled: false } },
        'Administrator disabled.',
      );
  }
  sendActivation(a: StaffAccount) {
    this.run('POST', '/api/v1/administrators/' + a.id + '/invite', {}, 'Activation email sent.');
  }
  resend(id: string) {
    this.run(
      'POST',
      '/api/v1/invitations/' + id + '/resend',
      {},
      'Fresh activation email sent. Previous links are no longer valid.',
    );
  }
  revoke(id: string) {
    this.run('POST', '/api/v1/invitations/' + id + '/revoke', {}, 'Activation invitation revoked.');
  }
}
