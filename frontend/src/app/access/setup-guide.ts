import { Component, DestroyRef, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Subject, catchError, EMPTY, startWith, switchMap, tap } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { LifecycleDialog } from '../navigation/lifecycle-dialog';
import { TenantDirectory } from '../navigation/tenant-directory';
import { accessError } from './access-api';
export interface SetupReview {
  tenant_id: string;
  company_name: string;
  lifecycle_status: string;
  complete: boolean;
  can_activate: boolean;
  checks: { key: string; label: string; complete: boolean; errors: Record<string, string[]> }[];
}
@Component({
  imports: [RouterLink, LifecycleDialog],
  host: { class: 'directory-page' },
  template: `
    <nav class="breadcrumb" aria-label="Breadcrumb">
      <a routerLink="/tenants">Tenants</a><span>/</span><span>Guided setup</span>
    </nav>
    <div class="heading">
      <div>
        <p class="eyebrow">GETTING STARTED</p>
        <h1>Tenant setup</h1>
        <p class="subheading">
          Review saved settings, resolve anything missing and activate when ready.
        </p>
      </div>
    </div>
    @if (loading()) {
      <p role="status">Checking saved tenant setup…</p>
    }
    @if (error()) {
      <div class="error-summary" role="alert">
        <p>{{ error() }}</p>
        <button (click)="load()">Retry setup check</button>
      </div>
    }
    @if (review(); as r) {
      <section class="card setup-summary">
        <div>
          <span class="badge" [attr.data-status]="r.lifecycle_status">{{
            r.lifecycle_status
          }}</span>
          <h2>{{ r.company_name }}</h2>
          <p>{{ completed() }} of {{ r.checks.length }} checks complete</p>
          <progress
            [value]="completed()"
            [max]="r.checks.length"
            aria-label="Saved setup checks complete"
          ></progress>
        </div>
        <a class="button" [routerLink]="['/tenants', r.tenant_id]">Company overview</a>
      </section>
      <ol class="setup-steps">
        @for (check of r.checks; track check.key; let index = $index) {
          <li class="card">
            <span class="step-marker" [class.done]="check.complete" aria-hidden="true">{{
              check.complete ? '✓' : index + 1
            }}</span>
            <div>
              <h2>{{ check.label }}</h2>
              <p class="check-status">{{ check.complete ? 'Complete' : 'Needs attention' }}</p>
              @for (message of messages(check.errors); track $index) {
                <p class="error-text">{{ message }}</p>
              }
              @if (check.key === 'branding') {
                <p class="muted">Defaults are valid. Logos and favicons are optional.</p>
              }
              @if (check.key === 'provisioning') {
                <p class="muted">Provisioning must be marked ready before activation.</p>
              }
            </div>
            @if (check.key !== 'provisioning') {
              <a
                class="button"
                [routerLink]="['/tenants', r.tenant_id, 'edit']"
                [fragment]="fragment(check.key)"
                >Review</a
              >
            }
          </li>
        }
      </ol>
      <section class="card setup-finish">
        <div>
          <h2>{{ r.complete ? 'Saved setup is complete' : 'Finish the checks above' }}</h2>
          <p class="muted">
            Activation still follows your role and the approved tenant status rules.
          </p>
        </div>
        @if (r.can_activate) {
          <button class="primary" [disabled]="busy()" (click)="confirming.set(true)">
            Activate workspace
          </button>
        }
        <a class="button" [routerLink]="['/tenants', r.tenant_id, 'access']"
          >Manage tenant access</a
        >
      </section>
      @if (message()) {
        <p class="success" role="status">{{ message() }}</p>
      }
      @if (confirming()) {
        <app-lifecycle-dialog
          [action]="activation"
          [company]="r.company_name"
          (cancelled)="confirming.set(false)"
          (confirmed)="activate()"
        />
      }
    }
  `,
  styles: `
    .setup-summary,
    .setup-finish {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 20px;
      flex-wrap: wrap;
    }
    .setup-summary h2 {
      margin: 12px 0 8px;
    }
    .setup-summary progress {
      width: min(400px, 100%);
      accent-color: var(--success);
      height: 12px;
    }
    .setup-steps {
      list-style: none;
      padding: 0;
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 20px;
      margin: 24px 0;
    }
    .setup-steps li {
      display: flex;
      align-items: flex-start;
      gap: 16px;
    }
    .setup-steps li > div {
      min-width: 0;
      flex: 1;
    }
    .step-marker {
      width: 32px;
      height: 32px;
      border-radius: 50%;
      background: var(--accent-soft);
      color: var(--accent);
      display: grid;
      place-items: center;
      flex-shrink: 0;
    }
    .step-marker.done {
      background: var(--success-soft);
      color: var(--success);
    }
    .check-status {
      font-size: 13px;
    }
    .error-text {
      font-size: 13px;
      color: var(--danger);
    }
    @media (max-width: 1000px) {
      .setup-steps {
        grid-template-columns: 1fr;
      }
    }
    @media (max-width: 450px) {
      .setup-steps li {
        flex-wrap: wrap;
      }
      .setup-steps li > a {
        margin-left: 48px;
      }
    }
  `,
})
export class SetupGuide {
  private http = inject(HttpClient);
  private route = inject(ActivatedRoute);
  private directory = inject(TenantDirectory);
  private refresh = new Subject<void>();
  readonly review = signal<SetupReview | null>(null);
  readonly error = signal('');
  readonly loading = signal(false);
  readonly busy = signal(false);
  readonly confirming = signal(false);
  readonly message = signal('');
  readonly activation = {
    code: 'activate',
    label: 'Activate workspace',
    confirmation:
      'Enable tenant-user access after required setup is complete. Subscription charges are unchanged.',
  };
  constructor() {
    this.route.paramMap
      .pipe(
        switchMap((params) =>
          this.refresh.pipe(
            startWith(undefined),
            tap(() => {
              this.loading.set(true);
              this.error.set('');
              this.review.set(null);
            }),
            switchMap(() =>
              this.http
                .get<{ data: SetupReview }>(
                  `/api/v1/tenants/${encodeURIComponent(params.get('id') || '')}/setup_review`,
                )
                .pipe(
                  catchError((e) => {
                    this.error.set(accessError(e));
                    this.loading.set(false);
                    return EMPTY;
                  }),
                ),
            ),
          ),
        ),
        takeUntilDestroyed(inject(DestroyRef)),
      )
      .subscribe((r) => {
        this.review.set(r.data);
        this.loading.set(false);
      });
  }
  load() {
    this.refresh.next();
  }
  completed() {
    return this.review()?.checks.filter((c) => c.complete).length || 0;
  }
  messages(errors: Record<string, string[]>) {
    return Object.entries(errors).flatMap(([key, values]) =>
      values.map((v) => `${key.replaceAll('_', ' ').replaceAll('.', ' ')}: ${v}`),
    );
  }
  fragment(key: string) {
    return 'section-' + (({ assignment: 'company' } as Record<string, string>)[key] || key);
  }
  activate() {
    const r = this.review();
    if (!r?.can_activate || this.busy()) return;
    this.confirming.set(false);
    this.busy.set(true);
    this.directory.lifecycle(r.tenant_id, 'activate').subscribe({
      next: () => {
        this.busy.set(false);
        this.message.set('Tenant activated.');
        this.load();
      },
      error: (e) => {
        this.busy.set(false);
        this.error.set(accessError(e));
      },
    });
  }
}
