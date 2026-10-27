import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Component, DestroyRef, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Session } from '../navigation/session';
import { TenantSession, accessError } from './access-api';

interface FactorState {
  enrollment: boolean;
  email: string;
  setup_key: string | null;
  account_scope: 'administrator' | 'tenant_user';
}
@Component({
  imports: [FormsModule],
  template: `<div class="security-layout">
    <aside class="security-story">
      <span class="security-brand">CPQ / CONSOLE</span><small>Organization workspace</small>
      <div>
        <h2>Your workspace.<br />By invitation only.</h2>
        <p>Your password and authenticator protect access to your authorized workspaces.</p>
      </div>
    </aside>
    <section class="security-panel">
      @if (loading()) {
        <p role="status">Checking your sign-in…</p>
      }
      @if (error()) {
        <p class="error-summary" role="alert">{{ error() }}</p>
      }
      @if (recoveryCodes().length) {
        <p class="eyebrow">ACCOUNT SECURITY</p>
        <h1>Save your recovery codes</h1>
        <p>
          Each code works once if you lose access to your authenticator. Store them privately; they
          will not be shown again.
        </p>
        <div class="recovery-codes">
          @for (item of recoveryCodes(); track item) {
            <code>{{ item }}</code>
          }
        </div>
        <label class="check"
          ><input type="checkbox" [(ngModel)]="savedCodes" />I have saved my recovery codes
          privately</label
        ><button class="primary" [disabled]="!savedCodes" (click)="continue()">
          Continue to workspace
        </button>
      } @else if (state(); as account) {
        <p class="eyebrow">ACCOUNT SECURITY</p>
        <h1>{{ account.enrollment ? 'Set up your authenticator' : 'Verify your sign-in' }}</h1>
        <p>{{ account.email }}</p>
        @if (account.enrollment) {
          <p>
            Add an account in your authenticator app using this setup key. Enter the six-digit code
            to confirm enrollment.
          </p>
          <label for="setup-key">Authenticator setup key</label>
          <div class="setup-key">
            <input
              id="setup-key"
              readonly
              [type]="showKey() ? 'text' : 'password'"
              [value]="account.setup_key"
              autocomplete="off"
            /><button type="button" (click)="showKey.set(!showKey())">
              {{ showKey() ? 'Hide key' : 'Show key' }}
            </button>
          </div>
        }
        <form #factor="ngForm" (ngSubmit)="verify()">
          <label for="factor-code">{{
            account.enrollment ? 'Authenticator code' : 'Authenticator code or recovery code'
          }}</label
          ><input
            id="factor-code"
            name="code"
            [(ngModel)]="code"
            required
            autocomplete="one-time-code"
            [inputMode]="account.enrollment ? 'numeric' : 'text'"
            maxlength="32"
            [disabled]="busy()"
          /><button class="primary" [disabled]="factor.invalid || busy()">
            {{
              busy()
                ? 'Verifying…'
                : account.enrollment
                  ? 'Verify and enable 2FA'
                  : 'Verify sign-in'
            }}
          </button>
        </form>
      }
      <button type="button" (click)="cancel()" [disabled]="busy()">Cancel sign-in</button>
      <p class="security-footnote">
        No public signup. Contact your administrator if you need access.
      </p>
    </section>
  </div>`,
  styleUrl: './account-security.scss',
})
export class FactorVerification {
  private http = inject(HttpClient);
  private destroy = inject(DestroyRef);
  private router = inject(Router);
  private session = inject(Session);
  private tenantSession = inject(TenantSession);
  readonly state = signal<FactorState | null>(null);
  readonly loading = signal(true);
  readonly busy = signal(false);
  readonly error = signal('');
  readonly showKey = signal(false);
  readonly recoveryCodes = signal<string[]>([]);
  code = '';
  savedCodes = false;
  private scope = 'administrator';
  constructor() {
    this.http
      .get<{ data: FactorState }>('/api/v1/factor')
      .pipe(takeUntilDestroyed(this.destroy))
      .subscribe({
        next: (r) => {
          this.state.set(r.data);
          this.scope = r.data.account_scope;
          this.loading.set(false);
        },
        error: (e) => {
          this.error.set(accessError(e));
          this.loading.set(false);
        },
      });
  }
  verify() {
    if (this.busy() || !this.code.trim()) return;
    this.busy.set(true);
    this.error.set('');
    this.http
      .post<{
        data: { account_scope: string };
        recovery_codes: string[] | null;
        csrf_token: string;
      }>('/api/v1/factor', { code: this.code.trim() })
      .pipe(takeUntilDestroyed(this.destroy))
      .subscribe({
        next: (r) => {
          this.code = '';
          this.busy.set(false);
          this.state.set(null);
          this.session.token.set(r.csrf_token);
          this.scope = r.data.account_scope;
          if (r.recovery_codes?.length) this.recoveryCodes.set(r.recovery_codes);
          else this.continue();
        },
        error: (e) => {
          this.code = '';
          this.busy.set(false);
          this.error.set(accessError(e));
        },
      });
  }
  continue() {
    if (this.recoveryCodes().length && !this.savedCodes) return;
    this.recoveryCodes.set([]);
    if (this.scope === 'administrator')
      this.session
        .refresh()
        .pipe(takeUntilDestroyed(this.destroy))
        .subscribe({
          next: () => void this.router.navigateByUrl('/tenants'),
          error: (e) => this.error.set(accessError(e)),
        });
    else
      this.tenantSession
        .refresh()
        .pipe(takeUntilDestroyed(this.destroy))
        .subscribe({
          next: () => void this.router.navigateByUrl('/workspaces'),
          error: (e) => this.error.set(accessError(e)),
        });
  }
  cancel() {
    this.http
      .delete('/api/v1/factor')
      .pipe(takeUntilDestroyed(this.destroy))
      .subscribe({
        next: () => {
          this.state.set(null);
          this.recoveryCodes.set([]);
          this.session.clear();
          globalThis.location.assign('/login');
        },
        error: (e) => this.error.set(accessError(e)),
      });
  }
  ngOnDestroy() {
    this.state.set(null);
    this.code = '';
    this.recoveryCodes.set([]);
  }
}

@Component({
  imports: [FormsModule, RouterLink],
  template: `<section class="identity-card">
    <p class="eyebrow">ACCOUNT SECURITY</p>
    <h1>{{ linking ? 'Connect Microsoft sign-in' : 'Microsoft sign-in' }}</h1>
    @if (error()) {
      <p role="alert" class="error-summary">{{ error() }}</p>
    }
    @if (loading()) {
      <p role="status">Checking Microsoft sign-in availability…</p>
    } @else if (!configured()) {
      <p>
        Your platform administrator has not enabled Microsoft sign-in. You can continue using your
        password and authenticator.
      </p>
    } @else {
      <p>
        {{
          linking
            ? 'Verify your current password before linking your organizational Microsoft identity. No account is created automatically.'
            : 'Sign in with a previously linked organizational Microsoft account. Access remains restricted to invited accounts.'
        }}
      </p>
      <form #identity="ngForm" (ngSubmit)="start()">
        @if (linking) {
          <label for="identity-password">Current password</label
          ><input
            id="identity-password"
            type="password"
            name="password"
            [(ngModel)]="password"
            required
            autocomplete="current-password"
            [disabled]="busy()"
          />
        } @else {
          <label for="account-scope">Account type</label
          ><select id="account-scope" name="scope" [(ngModel)]="scope">
            <option value="administrator">Platform administrator</option>
            <option value="tenant_user">Tenant Admin</option>
          </select>
        }
        <button class="primary" [disabled]="busy() || identity.invalid">
          {{ busy() ? 'Connecting…' : 'Continue with Microsoft' }}
        </button>
      </form>
    }
    <a routerLink="/login">Back to administrator sign-in</a
    ><a routerLink="/tenant-login">Tenant workspace sign-in</a>
  </section>`,
  styleUrl: './account-security.scss',
})
export class MicrosoftSignIn {
  private http = inject(HttpClient);
  private destroy = inject(DestroyRef);
  private route = inject(ActivatedRoute);
  readonly linking = this.route.snapshot.routeConfig?.path === 'security/account';
  readonly configured = signal(false);
  readonly loading = signal(true);
  readonly busy = signal(false);
  readonly error = signal('');
  password = '';
  scope = 'administrator';
  constructor() {
    this.http
      .get<{ data: { configured: boolean } }>('/api/v1/microsoft/status')
      .pipe(takeUntilDestroyed(this.destroy))
      .subscribe({
        next: (r) => {
          this.configured.set(r.data.configured);
          this.loading.set(false);
        },
        error: (e) => {
          this.error.set(accessError(e));
          this.loading.set(false);
        },
      });
  }
  start() {
    if (this.busy() || !this.configured()) return;
    this.busy.set(true);
    this.error.set('');
    this.http
      .post<{ authorization_url: string; csrf_token?: string }>(
        '/api/v1/microsoft/' + (this.linking ? 'link' : 'start'),
        this.linking ? { password: this.password } : { account_scope: this.scope },
      )
      .pipe(takeUntilDestroyed(this.destroy))
      .subscribe({
        next: (r) => {
          this.password = '';
          const uri = new URL(r.authorization_url);
          if (uri.protocol !== 'https:' || uri.hostname !== 'login.microsoftonline.com') {
            this.busy.set(false);
            this.error.set('The sign-in destination could not be verified.');
            return;
          }
          location.assign(uri.href);
        },
        error: (e) => {
          this.password = '';
          this.busy.set(false);
          this.error.set(accessError(e));
        },
      });
  }
  ngOnDestroy() {
    this.password = '';
  }
}

@Component({
  imports: [RouterLink],
  template: `<section class="identity-card">
    <p class="eyebrow">ACCOUNT ACCESS</p>
    <h1>Microsoft sign-in could not be completed</h1>
    <p>
      The request may have expired, the account may not be linked, or Microsoft sign-in may be
      unavailable. No tenant access has been granted.
    </p>
    <a class="button primary" routerLink="/login">Return to sign-in</a>
  </section>`,
  styleUrl: './account-security.scss',
})
export class IdentityError {}
