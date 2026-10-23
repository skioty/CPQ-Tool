import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { Session } from './session';
import { finalize } from 'rxjs';

@Component({
  imports: [ReactiveFormsModule],
  template: `<h1>Administrator login</h1>
    <p>Use a controlled development/demo account. Public registration is unavailable.</p>
    @if (error()) {
      <p role="alert">{{ error() }}</p>
    }
    <form [formGroup]="form" (ngSubmit)="submit()">
      <label for="login-email">Email</label
      ><input
        id="login-email"
        type="email"
        autocomplete="username"
        formControlName="email"
        required
      />
      <label for="login-password">Password</label
      ><input
        id="login-password"
        type="password"
        autocomplete="current-password"
        formControlName="password"
        required
      />
      <button [disabled]="busy() || form.invalid">{{ busy() ? 'Signing in…' : 'Sign in' }}</button>
    </form>`,
  styles: `
    form {
      display: grid;
      gap: 12px;
      max-width: 420px;
    }
    input,
    button {
      font: inherit;
      padding: 12px;
      min-width: 0;
    }
    [role='alert'] {
      color: #9b263b;
    }
  `,
})
export class Login {
  private session = inject(Session);
  private router = inject(Router);
  readonly form = inject(FormBuilder).nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', Validators.required],
  });
  readonly busy = signal(false);
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
        }),
      )
      .subscribe({
        next: () => void this.router.navigateByUrl('/tenants'),
        error: (e) =>
          this.error.set(
            e.status === 401
              ? 'Invalid email or password.'
              : 'Login failed. Check the connection and retry.',
          ),
      });
  }
}
