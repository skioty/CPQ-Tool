import { Component, DestroyRef, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  EMPTY,
  Subject,
  catchError,
  distinctUntilChanged,
  map,
  startWith,
  switchMap,
  tap,
  takeUntil,
} from 'rxjs';
import {
  DIRECTORY_POLICY,
  DirectoryTenant,
  LifecycleAction,
  TenantDirectory,
  apiMessage,
} from './tenant-directory';
import { LifecycleDialog } from './lifecycle-dialog';

@Component({
  imports: [RouterLink, LifecycleDialog],
  styleUrl: './directory.scss',
  template: ` <a routerLink="/tenants">← Tenant list</a>
    @if (loading()) {
      <p role="status">Loading tenant details…</p>
    } @else if (error()) {
      <p role="alert">{{ error() }}</p>
      <button (click)="reload()">Retry</button>
    } @else if (tenant(); as t) {
      <div class="heading">
        <h1>{{ t.company_name || 'Company name not set' }}</h1>
        <div class="actions">
          <a [routerLink]="['/tenants', t.id, 'edit']">Edit tenant</a
          ><a [routerLink]="['/tenants', t.id, 'branding']">Saved branding preview</a>
        </div>
      </div>
      @if (success()) {
        <p role="status">{{ success() }}</p>
      }
      <div class="tenant-grid">
        <section class="card">
          <h2>Company</h2>
          <p>{{ t.description || 'Description not set' }}</p>
          <dl>
            <dt>Display company name</dt>
            <dd>
              {{
                t.company_name_display === null ? 'Not set' : t.company_name_display ? 'Yes' : 'No'
              }}
            </dd>
            <dt>Industry reference</dt>
            <dd>{{ t.industry_id || 'Not set' }}</dd>
            <dt>Lifecycle</dt>
            <dd>{{ t.lifecycle_status || 'Not assigned' }}</dd>
            <dt>Provisioning</dt>
            <dd>{{ t.provisioning_status }}</dd>
          </dl>
        </section>
        <section class="card">
          <h2>Contacts</h2>
          <ul>
            @for (c of t.contacts; track c.id) {
              <li>
                <strong>{{ c.name || 'Name not set' }}</strong> {{ c.primary ? '— Primary' : '' }}
                <p>{{ c.email || 'Email not set' }}</p>
              </li>
            }
          </ul>
          <h3>Responsible CPQ Admin references</h3>
          @for (id of t.responsible_admin_ids; track id) {
            <p>{{ id }}</p>
          } @empty {
            <p>Not assigned</p>
          }
        </section>
        <section class="card">
          <h2>Branding</h2>
          <dl>
            @for (key of brandingKeys; track key) {
              <dt>{{ key.replaceAll('_', ' ') }}</dt>
              <dd>{{ t.branding[key] || 'Not set' }}</dd>
            }
          </dl>
          <p class="muted">
            Asset references are preserved. Authorized image URLs await upload integration.
          </p>
        </section>
        <section class="card">
          <h2>Subscription</h2>
          <dl>
            <dt>Currency</dt>
            <dd>{{ t.subscription.currency || 'Not set' }}</dd>
            <dt>Fee</dt>
            <dd>{{ t.subscription.fee ?? 'Not set' }}</dd>
            <dt>Payment method</dt>
            <dd>{{ t.subscription.payment_method || 'Not set' }}</dd>
            <dt>Discount type</dt>
            <dd>{{ t.subscription.discount.type || 'Not set' }}</dd>
            <dt>Discount value</dt>
            <dd>{{ t.subscription.discount.value ?? 'Not set' }}</dd>
            <dt>Discount duration</dt>
            <dd>{{ t.subscription.discount.duration || 'Not set' }}</dd>
          </dl>
          <p class="muted">No billing interval, discount unit or currency conversion is assumed.</p>
        </section>
      </div>
      <section class="card">
        <h2>Lifecycle actions</h2>
        @if (actionError()) {
          <p role="alert">{{ actionError() }}</p>
        }
        @for (action of policy.actions(t); track action.code) {
          <button [disabled]="busy()" (click)="selected.set(action)">{{ action.label }}</button>
        } @empty {
          <p>
            Actions unavailable: transition permissions and archive/deletion policy are not
            approved.
          </p>
        }
      </section>
      @if (selected(); as action) {
        <app-lifecycle-dialog
          [action]="action"
          [company]="t.company_name || t.id"
          (cancelled)="selected.set(null)"
          (confirmed)="confirm()"
        />
      }
    }`,
})
export class TenantDetail {
  private api = inject(TenantDirectory);
  readonly policy = inject(DIRECTORY_POLICY);
  readonly tenant = signal<DirectoryTenant | null>(null);
  readonly loading = signal(false);
  readonly busy = signal(false);
  readonly error = signal('');
  readonly success = signal('');
  readonly selected = signal<LifecycleAction | null>(null);
  readonly actionError = signal('');
  private actionCancel = new Subject<void>();
  readonly brandingKeys = [
    'primary_colour',
    'secondary_colour',
    'typography',
    'logo_attachment_id',
    'favicon_attachment_id',
  ];
  private retry = new Subject<void>();
  private destroy = inject(DestroyRef);
  constructor() {
    inject(ActivatedRoute)
      .paramMap.pipe(
        map((p) => p.get('id')),
        distinctUntilChanged(),
        tap(() => {
          this.actionCancel.next();
          this.busy.set(false);
          this.success.set('');
          this.actionError.set('');
        }),
        switchMap((id) =>
          this.retry.pipe(
            startWith(undefined),
            switchMap(() => {
              this.loading.set(true);
              this.error.set('');
              this.tenant.set(null);
              this.selected.set(null);
              return this.api.detail(id || '').pipe(
                catchError((e) => {
                  this.loading.set(false);
                  this.error.set(apiMessage(e));
                  return EMPTY;
                }),
              );
            }),
          ),
        ),
        takeUntilDestroyed(this.destroy),
      )
      .subscribe((r) => {
        this.tenant.set(r.data);
        this.loading.set(false);
      });
  }
  reload() {
    this.retry.next();
  }
  confirm() {
    const t = this.tenant(),
      action = this.selected();
    if (!t || !action || this.busy() || !this.policy.actions(t).some((a) => a.code === action.code))
      return;
    this.selected.set(null);
    this.busy.set(true);
    this.success.set('');
    this.actionError.set('');
    this.api
      .lifecycle(t.id, action.code)
      .pipe(takeUntil(this.actionCancel), takeUntilDestroyed(this.destroy))
      .subscribe({
        next: () => {
          this.busy.set(false);
          this.success.set('Action completed; details refreshed.');
          this.reload();
        },
        error: (e) => {
          this.busy.set(false);
          this.actionError.set(apiMessage(e));
        },
      });
  }
}
