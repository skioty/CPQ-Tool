import { InvitationContinuation } from './invitation-continuation';
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { TenantSession, accessError } from './access-api';
@Component({
  imports: [FormsModule, RouterLink],
  template: `<section class="tenant-login">
    <p class="eyebrow">YOUR COMPANY WORKSPACE</p>
    <h1>Tenant sign in</h1>
    <p>Sign in with the account you activated through an invitation.</p>
    @if (error()) {
      <p class="error-summary" role="alert">{{ error() }}</p>
    }
    <form #login="ngForm" (ngSubmit)="submit()">
      <label for="tenant-email">Email address</label
      ><input
        id="tenant-email"
        type="email"
        email
        name="email"
        [(ngModel)]="email"
        required
        autocomplete="username"
        [disabled]="busy()"
      /><label for="tenant-password">Password</label
      ><input
        id="tenant-password"
        type="password"
        name="password"
        [(ngModel)]="password"
        required
        autocomplete="current-password"
        [disabled]="busy()"
      /><button class="primary" [disabled]="busy() || login.invalid">
        {{ busy() ? 'Signing in…' : 'Sign in to workspace' }}
      </button>
    </form>
    <p class="muted">Need access? Ask your responsible SELISE CPQ Admin for an invitation.</p>
    <a routerLink="/login">Platform administrator sign-in</a>
  </section>`,
  styles: `
    :host {
      display: block;
      width: 100%;
      max-width: 460px;
    }
    .tenant-login {
      background: white;
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
    .muted {
      font-size: 13px;
      color: var(--muted);
    }
  `,
})
export class TenantLogin {
  private session = inject(TenantSession);
  private continuation = inject(InvitationContinuation);
  private router = inject(Router);
  email = '';
  password = '';
  readonly busy = signal(false);
  readonly error = signal('');
  submit() {
    if (this.busy()) return;
    this.busy.set(true);
    this.error.set('');
    this.session.login(this.email, this.password).subscribe({
      next: (r) => {
        this.password = '';
        this.busy.set(false);
        void this.router.navigateByUrl(
          r?.challenge
            ? '/security/verify'
            : this.continuation.token
              ? '/invitations/accept'
              : this.continuation.tenantId
                ? '/workspaces/' + encodeURIComponent(this.continuation.tenantId)
                : '/workspaces',
        );
      },
      error: (e) => {
        this.password = '';
        this.busy.set(false);
        this.error.set(accessError(e));
      },
    });
  }
}
