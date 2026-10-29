import { InvitationContinuation } from './invitation-continuation';
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { TenantSession, accessError } from './access-api';
@Component({
  imports: [FormsModule, RouterLink],
  template: `<section class="signin-card" aria-labelledby="tenant-signin-title">
    <div class="signin-content">
      <h1 id="tenant-signin-title">Sign in to your workspace</h1>
      <p class="signin-intro">Use the account you activated through an invitation.</p>
      <form #login="ngForm" (ngSubmit)="submit()" [attr.aria-busy]="busy()">
        <div class="field">
          <label for="tenant-email">Email address</label>
          <input
            id="tenant-email"
            type="email"
            email
            name="email"
            [(ngModel)]="email"
            #emailField="ngModel"
            required
            autocomplete="username"
            autocapitalize="none"
            spellcheck="false"
            [disabled]="busy()"
            [attr.aria-invalid]="emailField.touched && emailField.invalid"
            [attr.aria-describedby]="
              emailField.touched && emailField.invalid ? 'tenant-email-error' : null
            "
          />
          @if (emailField.touched && emailField.invalid) {
            <p class="field-error" id="tenant-email-error">Enter a valid email address.</p>
          }
        </div>
        <div class="field">
          <label for="tenant-password">Password</label>
          <div class="password-control">
            <input
              id="tenant-password"
              [type]="showPassword() ? 'text' : 'password'"
              name="password"
              [(ngModel)]="password"
              #passwordField="ngModel"
              required
              autocomplete="current-password"
              [disabled]="busy()"
              [attr.aria-invalid]="passwordField.touched && passwordField.invalid"
              [attr.aria-describedby]="
                error()
                  ? 'tenant-signin-error'
                  : passwordField.touched && passwordField.invalid
                    ? 'tenant-password-error'
                    : null
              "
            />
            <button
              type="button"
              class="password-toggle"
              (click)="showPassword.set(!showPassword())"
              [disabled]="busy()"
              [attr.aria-pressed]="showPassword()"
              aria-controls="tenant-password"
              [attr.aria-label]="showPassword() ? 'Hide password' : 'Show password'"
            >
              {{ showPassword() ? 'Hide' : 'Show' }}
            </button>
          </div>
          @if (error()) {
            <p id="tenant-signin-error" class="field-error" role="alert">{{ error() }}</p>
          }
          @if (passwordField.touched && passwordField.invalid && !error()) {
            <p id="tenant-password-error" class="field-error">Enter your password.</p>
          }
        </div>
        <button class="primary signin-submit" [disabled]="busy() || login.invalid">
          {{ busy() ? 'Signing in…' : 'Sign in to workspace' }}
        </button>
      </form>
      <p class="verification-note">Two-factor verification is required to continue.</p>
      <nav class="signin-options" aria-label="Other sign-in options">
        <a routerLink="/login">Platform administrator sign-in</a>
      </nav>
    </div>
    <footer class="signin-footer">
      Need access? Ask your responsible SELISE CPQ Admin for an invitation.
    </footer>
  </section>`,
  styleUrl: '../navigation/login.scss',
})
export class TenantLogin {
  private session = inject(TenantSession);
  private continuation = inject(InvitationContinuation);
  private router = inject(Router);
  email = '';
  password = '';
  readonly busy = signal(false);
  readonly showPassword = signal(false);
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
        this.error.set(e.status === 401 ? 'Invalid email or password' : accessError(e));
      },
    });
  }
}
