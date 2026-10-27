import { HttpClient } from '@angular/common/http';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Component, DestroyRef, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Session } from './session';
import { finalize } from 'rxjs';

@Component({
  imports: [ReactiveFormsModule, RouterLink],
  template: `<section class="signin-card" aria-labelledby="signin-title">
    <header class="signin-brand">
      <span class="company-name">SELISE <span>CPQ</span></span>
      <span class="product-name">Platform administration</span>
    </header>
    <div class="signin-content">
      <h1 id="signin-title">Sign in to CPQ console</h1>
      <p class="signin-intro">
        Use your administrator account to manage tenants and platform access.
      </p>
      @if (error()) {
        <p class="error-summary" role="alert">{{ error() }}</p>
      }
      <form [formGroup]="form" (ngSubmit)="submit()" [attr.aria-busy]="busy()">
        <div class="field">
          <label for="login-email">Email address</label>
          <input
            id="login-email"
            type="email"
            autocomplete="username"
            formControlName="email"
            placeholder="name@company.com"
            required
            [readOnly]="busy()"
            spellcheck="false"
            autocapitalize="none"
            [attr.aria-invalid]="form.controls.email.touched && form.controls.email.invalid"
            [attr.aria-describedby]="
              form.controls.email.touched && form.controls.email.invalid
                ? 'login-email-error'
                : null
            "
          />
          @if (form.controls.email.touched && form.controls.email.invalid) {
            <p id="login-email-error" class="field-error">Enter a valid email address.</p>
          }
        </div>
        <div class="field">
          <label for="login-password">Password</label>
          <div class="password-control">
            <input
              id="login-password"
              [type]="showPassword() ? 'text' : 'password'"
              autocomplete="current-password"
              formControlName="password"
              required
              [readOnly]="busy()"
              [attr.aria-invalid]="form.controls.password.touched && form.controls.password.invalid"
              [attr.aria-describedby]="
                form.controls.password.touched && form.controls.password.invalid
                  ? 'login-password-error'
                  : null
              "
            />
            <button
              class="password-toggle"
              type="button"
              (click)="showPassword.set(!showPassword())"
              [disabled]="busy()"
              [attr.aria-pressed]="showPassword()"
              aria-controls="login-password"
              [attr.aria-label]="showPassword() ? 'Hide password' : 'Show password'"
            >
              {{ showPassword() ? 'Hide' : 'Show' }}
            </button>
          </div>
          @if (form.controls.password.touched && form.controls.password.invalid) {
            <p id="login-password-error" class="field-error">Enter your password.</p>
          }
        </div>
        <button type="submit" class="primary signin-submit" [disabled]="busy() || form.invalid">
          {{ busy() ? 'Signing in…' : 'Sign in' }}
        </button>
      </form>
      <p class="verification-note">Two-factor verification is required to continue.</p>
      <nav class="signin-options" aria-label="Other sign-in options">
        @if (microsoftAvailable()) {
          <a routerLink="/security/microsoft">Sign in with Microsoft</a>
        }
        <div class="tenant-entry">
          <p>Accessing your company workspace?</p>
          <a routerLink="/tenant-login">Tenant Admin sign-in</a>
        </div>
      </nav>
    </div>
    <footer class="signin-footer">For account access, contact your platform administrator.</footer>
  </section>`,
  styleUrl: './login.scss',
})
export class Login {
  private session = inject(Session);
  private router = inject(Router);
  readonly form = inject(FormBuilder).nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', Validators.required],
  });
  readonly busy = signal(false);
  readonly showPassword = signal(false);
  readonly microsoftAvailable = signal(false);
  constructor() {
    inject(HttpClient)
      .get<{ data: { configured: boolean } }>('/api/v1/microsoft/status')
      .pipe(takeUntilDestroyed(inject(DestroyRef)))
      .subscribe({
        next: (response) => this.microsoftAvailable.set(response.data.configured === true),
        error: () => this.microsoftAvailable.set(false),
      });
  }
  readonly error = signal('');
  submit() {
    if (this.busy() || this.form.invalid) return;
    this.busy.set(true);
    this.error.set('');
    const { email, password } = this.form.getRawValue();
    this.session
      .login(email, password)
      .pipe(
        finalize(() => {
          this.busy.set(false);
          this.form.controls.password.reset();
          this.showPassword.set(false);
        }),
      )
      .subscribe({
        next: (r) => void this.router.navigateByUrl(r?.challenge ? '/security/verify' : '/tenants'),
        error: (e) =>
          this.error.set(
            e.status === 401
              ? 'Invalid email or password.'
              : 'Login failed. Check the connection and retry.',
          ),
      });
  }
}
