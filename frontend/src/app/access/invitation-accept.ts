import { InvitationContinuation } from './invitation-continuation';
import { Component, DestroyRef, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { accessError } from './access-api';
@Component({
  imports: [FormsModule, RouterLink],
  template: `<section class="card acceptance">
    <p class="eyebrow">SELISE CPQ · SECURE ACCOUNT ACTIVATION</p>
    <h1>{{ complete() ? 'Invitation accepted' : 'Your invitation' }}</h1>
    @if (loading()) {
      <p role="status">Checking your invitation…</p>
    }
    @if (error()) {
      <p class="error-summary" role="alert">{{ error() }}</p>
    }
    @if (complete()) {
      <p class="success" role="status">
        Your account access is ready. Tenant workspace access remains subject to Active tenant
        status.
      </p>
      <a class="button primary" [routerLink]="completionPath()">{{
        preview()?.existing_account ? 'Open tenant workspace' : 'Continue to sign in'
      }}</a>
    } @else if (preview(); as p) {
      <p>You have been invited as {{ p.kind === 'staff' ? 'a CPQ Admin' : 'a Tenant Admin' }}.</p>
      <dl>
        <dt>Email</dt>
        <dd>{{ p.email }}</dd>
        @if (p.company_name) {
          <dt>Company</dt>
          <dd>{{ p.company_name }}</dd>
        }
      </dl>
      <p class="muted">
        {{
          p.existing_account
            ? 'Use your existing tenant account password. This will not change it.'
            : 'Choose your own password with 12–128 characters. This invitation can be accepted once.'
        }}
      </p>
      @if (p.existing_account) {
        <p>
          First sign in as {{ p.email }} and verify your authenticator, then return here to accept.
        </p>
        <a class="button" routerLink="/tenant-login">Sign in with invited account</a>
      }
      <form #accept="ngForm" (ngSubmit)="submit()">
        @if (!p.existing_account) {
          <label for="accept-name">Your name (required)</label>
          <input
            id="accept-name"
            name="name"
            [(ngModel)]="name"
            required
            maxlength="120"
            autocomplete="name"
            [disabled]="busy()"
          />
        }
        <label for="accept-password">{{
          p.existing_account ? 'Existing account password' : 'New password'
        }}</label
        ><input
          id="accept-password"
          name="password"
          type="password"
          [(ngModel)]="password"
          required
          [minlength]="p.existing_account ? 1 : 12"
          maxlength="128"
          [autocomplete]="p.existing_account ? 'current-password' : 'new-password'"
          [disabled]="busy()"
        />
        @if (!p.existing_account) {
          <label for="accept-confirmation">Confirm new password</label
          ><input
            id="accept-confirmation"
            name="confirmation"
            type="password"
            [(ngModel)]="confirmation"
            required
            minlength="12"
            maxlength="128"
            autocomplete="new-password"
            [disabled]="busy()"
          />
        }
        @if (!p.existing_account && confirmation && password !== confirmation) {
          <p class="error-summary">Passwords must match.</p>
        }
        <button
          class="primary"
          [disabled]="
            busy() || accept.invalid || (!p.existing_account && password !== confirmation)
          "
        >
          {{ busy() ? 'Accepting invitation…' : 'Accept invitation' }}
        </button>
      </form>
    } @else if (!loading()) {
      <p>Open the invitation email again or ask the administrator for a fresh invitation.</p>
    }
    <p class="muted">No account is created from a contact record alone.</p>
  </section>`,
  styles: `
    :host {
      display: block;
      width: 100%;
      max-width: 560px;
    }
    .acceptance {
      background: var(--surface);
      border: 1px solid var(--line);
      border-radius: var(--radius);
      padding: 32px;
    }
    form {
      display: grid;
      gap: 10px;
      margin: 24px 0;
    }
    label {
      font-size: 13px;
      font-weight: 600;
    }
    button {
      margin-top: 12px;
    }
    dl {
      display: grid;
      grid-template-columns: 90px minmax(0, 1fr);
      gap: 10px;
      margin-block: 24px;
    }
    dd {
      margin: 0;
      overflow-wrap: anywhere;
    }
    dt,
    .muted {
      color: var(--muted);
      font-size: 13px;
    }
    @media (max-width: 450px) {
      .acceptance {
        padding: 24px;
      }
    }
  `,
})
export class InvitationAccept {
  private http = inject(HttpClient);
  private token = '';
  private continuation = inject(InvitationContinuation);
  name = '';
  password = '';
  confirmation = '';
  kind = 'tenant';
  readonly preview = signal<{
    email: string;
    kind: string;
    company_name: string | null;
    existing_account: boolean;
    tenant_id?: string;
  } | null>(null);
  readonly loading = signal(true);
  readonly busy = signal(false);
  readonly complete = signal(false);
  readonly error = signal('');
  completionPath() {
    if (this.kind === 'staff') return '/login';
    if (this.preview()?.existing_account)
      return this.continuation.tenantId
        ? '/workspaces/' + encodeURIComponent(this.continuation.tenantId)
        : '/workspaces';
    return '/tenant-login';
  }
  constructor() {
    inject(DestroyRef).onDestroy(() => {
      this.token = '';
      this.password = '';
      this.confirmation = '';
    });
    inject(ActivatedRoute)
      .fragment.pipe(takeUntilDestroyed(inject(DestroyRef)))
      .subscribe((fragment) => {
        this.token = new URLSearchParams(fragment || '').get('token') || this.continuation.token;
        this.continuation.token = this.token;
        if (fragment) history.replaceState(history.state, '', location.pathname + location.search);
        if (!this.token) {
          this.loading.set(false);
          this.error.set('An invitation link is required. Open the link in your invitation email.');
          return;
        }
        this.http
          .post<{
            data: {
              email: string;
              kind: string;
              company_name: string | null;
              existing_account: boolean;
              tenant_id?: string;
            };
          }>('/api/v1/invitation_preview', { token: this.token })
          .subscribe({
            next: (r) => {
              this.preview.set(r.data);
              this.continuation.tenantId = r.data.tenant_id || '';
              this.kind = r.data.kind;
              this.loading.set(false);
            },
            error: (e) => {
              this.error.set(accessError(e));
              this.loading.set(false);
            },
          });
      });
  }
  submit() {
    if (this.busy() || !this.preview()) return;
    this.busy.set(true);
    this.error.set('');
    this.http
      .post('/api/v1/invitation_acceptance', {
        token: this.token,
        password: this.password,
        name: this.name,
        password_confirmation: this.confirmation,
      })
      .subscribe({
        next: () => {
          this.password = '';
          this.confirmation = '';
          this.token = '';
          this.continuation.token = '';
          this.complete.set(true);
          this.busy.set(false);
        },
        error: (e) => {
          this.password = '';
          this.confirmation = '';
          this.busy.set(false);
          this.error.set(accessError(e));
        },
      });
  }
}
