import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Session } from './session';
import { finalize } from 'rxjs';

@Component({
  imports: [ReactiveFormsModule, RouterLink],
  template: `<div class="login-layout">
    <section class="login-story" aria-label="SELISE CPQ workspace">
      <div class="story-top">SELISE <span>CPQ</span></div>
      <div class="story-copy">
        <span class="story-line"></span>
        <p class="eyebrow">BUILT AROUND YOUR BUSINESS</p>
        <h2>Every company. One connected <em>workspace.</em></h2>
        <p>
          Bring your tenants, people and company identities together in a focused administration
          experience.
        </p>
      </div>
      <div class="story-footer">
        <span class="story-monogram">S.</span
        ><span>Clarity for your team.<br />Consistency for every tenant.</span>
      </div>
    </section>
    <section class="login-form">
      <div class="login-form-inner">
        <p class="eyebrow">PLATFORM ADMINISTRATION</p>
        <h1>Welcome back.</h1>
        <p class="login-intro">Sign in to manage your tenant workspaces.</p>
        @if (error()) {
          <p class="error-summary" role="alert">{{ error() }}</p>
        }
        <form [formGroup]="form" (ngSubmit)="submit()">
          <label for="login-email">Email address</label
          ><input
            id="login-email"
            type="email"
            autocomplete="username"
            formControlName="email"
            placeholder="Your work email"
            required
          /><label for="login-password">Password</label
          ><input
            id="login-password"
            type="password"
            autocomplete="current-password"
            formControlName="password"
            placeholder="Enter your password"
            required
          /><button class="primary" [disabled]="busy() || form.invalid">
            {{ busy() ? 'Signing in…' : 'Sign in' }}<span aria-hidden="true">→</span>
          </button>
        </form>
        <p class="access-note">Need access? Contact your platform administrator.</p>
        <p><a routerLink="/tenant-login">Tenant workspace sign-in</a><a routerLink="/security/microsoft">Microsoft sign-in</a></p>
        <div class="login-divider"></div>
        <p class="login-bottom">Your administration workspace.<br /><strong>SELISE CPQ</strong></p>
      </div>
    </section>
  </div>`,
  styles: `
    :host {
      width: 100%;
      display: block;
      max-width: 1080px;
    }
    .login-layout {
      display: grid;
      grid-template-columns: 1fr 1fr;
      min-height: 540px;
      border: 1px solid #e2e6ec;
      border-radius: 18px;
      overflow: hidden;
      background: #fff;
      box-shadow: 0 15px 60px #17233a08;
    }
    .login-story {
      background: #17283d;
      color: white;
      padding: 38px 42px;
      position: relative;
      overflow: hidden;
      display: flex;
      flex-direction: column;
    }
    .story-top {
      font-size: 17px;
      letter-spacing: 1.5px;
      position: relative;
      z-index: 1;
    }
    .story-top span {
      color: #9caec3;
      font-weight: 300;
    }
    .story-copy {
      margin: auto 0;
      z-index: 1;
      position: relative;
      padding-block: 50px;
    }
    .story-line {
      display: block;
      width: 32px;
      height: 3px;
      background: #f4886b;
      margin-bottom: 24px;
    }
    .story-copy .eyebrow {
      font-size: 12px;
      color: #a1b0c3;
      letter-spacing: 1.6px;
    }
    .story-copy h2 {
      font-size: 32px;
      line-height: 1.23;
      letter-spacing: -1.6px;
      font-weight: 500;
      margin: 18px 0 25px;
    }
    .story-copy em {
      font-style: normal;
      color: #f28e75;
    }
    .story-copy > p:last-child {
      color: #b8c6d8;
      font-size: 12px;
      max-width: 290px;
      line-height: 1.9;
    }
    .story-footer {
      display: flex;
      align-items: center;
      gap: 13px;
      color: #b8c6d8;
      font-size: 12px;
      line-height: 1.8;
      position: relative;
      z-index: 1;
    }
    .story-monogram {
      color: #e49b86;
      border: 1px solid #ffffff25;
      border-radius: 9px;
      width: 37px;
      height: 37px;
      display: grid;
      place-content: center;
      font-size: 20px;
      font-weight: 600;
    }
    .login-form {
      display: grid;
      place-items: center;
      padding: 45px;
    }
    .login-form-inner {
      width: 100%;
      max-width: 320px;
    }
    .login-form h1 {
      font-size: 31px;
      margin-top: 14px;
    }
    .login-intro {
      font-size: 12px;
      color: #687487;
      margin: 12px 0 32px;
    }
    .login-form .eyebrow {
      font-size: 12px;
    }
    .login-form form {
      display: grid;
      gap: 10px;
    }
    .login-form label {
      font-size: 12px;
      font-weight: 550;
      color: #5a677b;
    }
    .login-form input {
      font-size: 12px;
      padding: 12px 14px;
      min-height: 46px;
      margin-bottom: 10px;
    }
    .login-form button {
      margin-top: 10px;
      min-height: 45px;
      font-size: 12px;
      justify-content: space-between;
      padding-inline: 17px;
    }
    .access-note {
      font-size: 12px;
      color: #687487;
      text-align: center;
      margin: 24px 0 32px;
    }
    .login-divider {
      border-top: 1px solid #edf0f4;
    }
    .login-bottom {
      font-size: 12px;
      color: #687487;
      text-align: center;
      line-height: 1.8;
      margin-top: 28px;
    }
    .login-bottom strong {
      font-weight: 500;
      color: #687487;
      letter-spacing: 1px;
    }
    .error-summary {
      font-size: 12px;
    }
    @media (max-width: 850px) {
      .login-layout {
        grid-template-columns: 0.9fr 1fr;
        min-height: 550px;
      }
      .login-story {
        padding: 30px;
      }
      .story-copy h2 {
        font-size: 32px;
      }
      .login-form {
        padding: 32px;
      }
    }
    @media (max-width: 640px) {
      .login-layout {
        grid-template-columns: 1fr;
        min-height: auto;
        max-width: 440px;
        margin: auto;
      }
      .login-story {
        padding: 24px 28px;
      }
      .story-copy {
        padding: 22px 0 0;
      }
      .story-copy h2 {
        font-size: 26px;
        line-height: 1.2;
        margin: 10px 0 5px;
      }
      .story-copy h2 br {
        display: none;
      }
      .story-copy h2 br::after {
        content: ' ';
      }
      .story-copy > p:last-child,
      .story-footer,
      .story-copy .eyebrow,
      .story-line {
        display: none;
      }
      .story-top {
        font-size: 12px;
      }
      .login-form {
        padding: 32px 26px;
      }
      .login-form h1 {
        font-size: 27px;
      }
      .login-intro {
        margin-bottom: 25px;
      }
      .login-bottom {
        margin-bottom: 0;
      }
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
