import { TenantRetention } from '../features/tenants/tenant-retention';
import { TenantActivity } from './tenant-activity';
import { brandingInk } from '../tenant/branding-colour';
import { DatePipe, DecimalPipe } from '@angular/common';
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
import { FORM_OPTIONS, ASSET_URL } from '../tenant/tenant.types';
import { LifecycleDialog } from './lifecycle-dialog';

@Component({
  imports: [RouterLink, LifecycleDialog, DatePipe, DecimalPipe, TenantActivity, TenantRetention],
  host: { class: 'directory-page' },
  template: `<div class="breadcrumb">
      <a routerLink="/tenants">Tenants</a><span>/</span><span>Company overview</span>
    </div>
    @if (loading()) {
      <div class="loading-state" role="status">
        <span class="loading-dot"></span>
        <h1>Loading tenant details…</h1>
      </div>
    } @else if (error()) {
      <div class="state empty-state" role="alert">
        <div class="state-symbol">!</div>
        <h1>Tenant unavailable</h1>
        <p>{{ error() }}</p>
        <button (click)="reload()">Retry</button>
      </div>
    } @else if (tenant(); as t) {
      <div class="detail-hero">
        <span class="company-avatar" aria-hidden="true">{{ initials(t.company_name) }}</span>
        <div class="hero-copy">
          <p class="eyebrow">COMPANY WORKSPACE</p>
          <h1>{{ t.company_name || 'Unnamed company' }}</h1>
          <div class="hero-meta">
            <span class="badge" [attr.data-status]="t.lifecycle_status">{{
              t.lifecycle_status || 'Not set'
            }}</span
            ><small>{{ industry(t.industry_id) }}</small>
          </div>
        </div>
        <div class="actions">
          <a class="button" [routerLink]="['/tenants', t.id, 'setup']">Review setup</a
          ><a class="button" [routerLink]="['/tenants', t.id, 'access']">Invite Tenant Admin</a>
          <a class="button" [routerLink]="['/tenants', t.id, 'branding']">Branding preview</a
          ><a class="button primary" [routerLink]="['/tenants', t.id, 'edit']"
            >Edit tenant <span aria-hidden="true">↗</span></a
          >
        </div>
      </div>
      @if (success()) {
        <p class="success" role="status">{{ success() }}</p>
      }
      <nav class="detail-tabs" aria-label="Tenant profile sections">
        @for (section of profileSections; track section) {
          <button
            type="button"
            [class.active]="tab() === section"
            [attr.aria-current]="tab() === section ? 'page' : null"
            (click)="selectTab(section)"
          >
            {{ section }}{{ section === 'Contacts' ? ' (' + t.contacts.length + ')' : '' }}
          </button>
        }
      </nav>
      <div class="tenant-grid" [class.single-profile-panel]="tab() !== 'Overview'">
        <section class="card" [hidden]="tab() !== 'Overview'">
          <div class="card-heading">
            <h2>Company information</h2>
            <span class="section-kicker">OVERVIEW</span>
          </div>
          <p class="muted">{{ t.description || 'No company description added.' }}</p>
          <dl>
            <dt>Industry</dt>
            <dd>{{ industry(t.industry_id) }}</dd>
            <dt>Display name</dt>
            <dd>{{ t.display_name || t.company_name }}</dd>
            <dt>Country</dt>
            <dd>{{ referenceLabel('country', t.country) }}</dd>
            <dt>Time zone</dt>
            <dd>{{ referenceLabel('time_zone', t.time_zone) }}</dd>
            <dt>Company name in branding</dt>
            <dd>{{ t.company_name_display ? 'Visible' : 'Hidden' }}</dd>
            <dt>Workspace setup</dt>
            <dd>{{ t.provisioning_status === 'ready' ? 'Complete' : 'In progress' }}</dd>
            <dt>Tenant status</dt>
            <dd>
              <span class="badge" [attr.data-status]="t.lifecycle_status">{{
                t.lifecycle_status || 'Not set'
              }}</span>
            </dd>
          </dl>
        </section>
        @if (tab() === 'Overview') {
          <section class="card workspace-profile">
            <h2>Workspace configuration</h2>
            <p class="workspace-account-count">{{ t.user_count ?? '—' }} tenant accounts</p>
            <p class="muted">Accepted, enabled memberships</p>
            <dl>
              <dt>Billing currency</dt>
              <dd>{{ t.subscription.currency || 'Not set' }}</dd>
              <dt>User limit</dt>
              <dd>{{ t.user_limit }} seats</dd>
              <dt>Occupied seats</dt>
              <dd>{{ t.occupied_seats }} (including primary contact)</dd>
              <dt>Primary contact role</dt>
              <dd>Tenant Admin · Invitation required</dd>
              <dt>Provisioning</dt>
              <dd>{{ t.provisioning_status === 'ready' ? 'Ready' : 'In progress' }}</dd>
            </dl>
            <a class="button" [routerLink]="['/tenants', t.id, 'access']"
              >Manage workspace access</a
            >
          </section>
        }
        <section class="card" [hidden]="tab() !== 'Contacts'">
          <div class="card-heading">
            <h2>Contacts</h2>
            <span class="section-kicker"
              >{{ t.contacts.length }} {{ t.contacts.length === 1 ? 'CONTACT' : 'CONTACTS' }}</span
            >
          </div>
          <ul class="contacts-list">
            @for (c of t.contacts; track c.id) {
              <li class="contact-row">
                <span class="contact-avatar" aria-hidden="true">{{ initials(c.name) }}</span>
                <div>
                  <strong>{{ c.name || 'Unnamed contact' }}</strong>
                  <p>{{ c.email || 'No email provided' }}</p>
                  @if (c.phone) {
                    <p>{{ c.phone }}</p>
                  }
                </div>
                @if (c.primary) {
                  <span class="badge" data-status="active">Primary</span>
                }
              </li>
            }
          </ul>
          <div class="admin-owner">
            <h3>Responsible SELISE CPQ Admin</h3>
            @for (id of t.responsible_admin_ids; track id) {
              <p>{{ admin(id) }}</p>
            } @empty {
              <p>Not assigned</p>
            }
          </div>
        </section>
        <section class="card" [hidden]="tab() !== 'Branding'">
          <div class="card-heading">
            <h2>Workspace branding</h2>
            <a class="text-link" [routerLink]="['/tenants', t.id, 'branding']">Full preview ↗</a>
          </div>
          <div class="inline-preview">
            <header
              [style.background-color]="colour(t.branding['primary_colour'])"
              [style.color]="ink(t.branding['primary_colour'])"
            >
              @if (assetUrl(t.branding['logo_attachment_id']); as logo) {
                <img [src]="logo" alt="Company logo" />
              }
              @if (t.company_name_display) {
                <strong>{{ t.company_name }}</strong>
              } @else {
                <strong>Workspace</strong>
              }
            </header>
            <footer>Your company identity, across the workspace.</footer>
          </div>
          <div class="swatches">
            <div
              class="swatch"
              [style.background-color]="colour(t.branding['primary_colour'])"
              [style.color]="ink(t.branding['primary_colour'])"
              aria-hidden="true"
            ></div>
            <div>
              <div class="swatch-label">Primary colour</div>
              <strong>{{ t.branding['primary_colour'] || 'Default' }}</strong>
            </div>
            <div
              class="swatch"
              [style.background-color]="colour(t.branding['secondary_colour'])"
              aria-hidden="true"
            ></div>
            <div>
              <div class="swatch-label">Secondary colour</div>
              <strong>{{ t.branding['secondary_colour'] || 'Default' }}</strong>
            </div>
          </div>
          <dl>
            <dt>Typography</dt>
            <dd>{{ font(t.branding['typography']) }}</dd>
            <dt>Company logo</dt>
            <dd>{{ t.branding['logo_attachment_id'] ? 'Uploaded' : 'Default' }}</dd>
            <dt>Favicon</dt>
            <dd>{{ t.branding['favicon_attachment_id'] ? 'Uploaded' : 'Default' }}</dd>
          </dl>
        </section>
        <section class="card" [hidden]="tab() !== 'Billing'">
          <div class="card-heading">
            <h2>Subscription</h2>
            <span class="section-kicker">MONTHLY PLAN</span>
          </div>
          <div class="subscription-total">
            {{ t.subscription.fee === null ? '—' : (t.subscription.fee | number: '1.2-2') }}
            <span>{{ t.subscription.currency || '' }} / month</span>
          </div>
          <p class="muted">Subscription configuration</p>
          @if (t.subscription.pricing_conversion?.converted) {
            <p class="muted">
              Converted from {{ t.subscription.pricing_conversion?.source_fee }}
              {{ t.subscription.pricing_conversion?.source_currency }} using the saved rate dated
              {{ t.subscription.pricing_conversion?.rate_time | date: 'mediumDate' }}.
              <a href="https://www.exchangerate-api.com" target="_blank" rel="noopener"
                >Rates By Exchange Rate API</a
              >
            </p>
          }
          <dl>
            <dt>Pricing mode</dt>
            <dd>{{ t.subscription.pricing_mode === 'automatic' ? 'Automatic' : 'Custom' }}</dd>
            <dt>User limit</dt>
            <dd>{{ t.user_limit }}</dd>
            <dt>Billing interval</dt>
            <dd>Monthly</dd>
            <dt>Billing currency</dt>
            <dd>{{ t.subscription.currency || 'Not specified' }}</dd>
            <dt>Payment method</dt>
            <dd>{{ payment(t.subscription.payment_method) }}</dd>
            @if (t.subscription.payment_method_description) {
              <dt>Payment description</dt>
              <dd>{{ t.subscription.payment_method_description }}</dd>
            }
            <dt>Subscription discount</dt>
            <dd>
              {{ t.subscription.discount.value || '0'
              }}{{ t.subscription.discount.type === 'percentage' ? '%' : '' }}
            </dd>
            <dt>Discount duration</dt>
            <dd>
              {{
                t.subscription.discount.duration
                  ? t.subscription.discount.duration + ' monthly cycles'
                  : 'Not applied'
              }}
            </dd>
          </dl>
        </section>
      </div>
      <section class="card lifecycle-panel">
        <div>
          <p class="eyebrow">WORKSPACE ACCESS</p>
          <h2>Tenant status</h2>
          <p>Manage availability while keeping company records intact.</p>
          @if (actionError()) {
            <p class="action-error" role="alert">{{ actionError() }}</p>
          }
        </div>
        @if (busy()) {
          <p class="busy-status" role="status">Updating tenant status…</p>
        }
        <div class="actions">
          @for (action of policy.actions(t); track action.code) {
            <button
              [attr.data-action]="action.code"
              [disabled]="busy()"
              (click)="selected.set(action)"
            >
              {{ action.label }}
            </button>
          } @empty {
            <p class="muted">No actions available for your role and the current tenant status.</p>
          }
        </div>
      </section>
      <section
        class="card activity-panel"
        [hidden]="tab() !== 'Activity'"
        aria-labelledby="activity-heading"
      >
        <div class="card-heading">
          <div>
            <h2 id="activity-heading">Tenant activity</h2>
            <p class="muted">Recorded changes and lifecycle actions for this company.</p>
          </div>
          <button
            type="button"
            [attr.aria-expanded]="activityOpen()"
            aria-controls="tenant-activity"
            (click)="activityOpen.set(!activityOpen())"
          >
            {{ activityOpen() ? 'Hide activity' : 'View activity' }}
          </button>
        </div>
        <div id="tenant-activity" [hidden]="!activityOpen()">
          @if (activityOpen()) {
            <app-tenant-activity [tenantId]="t.id" />
          }
        </div>
      </section>
      @if (tab() === 'Retention') {
        <app-tenant-retention [tenantId]="t.id" [company]="t.company_name || 'this tenant'" />
      }
      @if (selected(); as action) {
        <app-lifecycle-dialog
          [action]="action"
          [company]="t.company_name || 'this tenant'"
          (cancelled)="selected.set(null)"
          (confirmed)="confirm()"
        />
      }
    }`,
})
export class TenantDetail {
  readonly profileSections = [
    'Overview',
    'Contacts',
    'Branding',
    'Billing',
    'Activity',
    'Retention',
  ];
  readonly tab = signal('Overview');
  selectTab(section: string) {
    this.tab.set(section);
    if (section === 'Activity') this.activityOpen.set(true);
  }
  readonly ink = brandingInk;
  private api = inject(TenantDirectory);
  private references = inject(FORM_OPTIONS);
  private asset = inject(ASSET_URL);
  initials(name: string | null) {
    return (name || 'Company')
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((n) => n[0])
      .join('')
      .toUpperCase();
  }
  referenceLabel(kind: string, id: string | null | undefined) {
    const list = kind === 'country' ? this.references.countries : this.references.timeZones;
    return list?.find((c) => c.id === id)?.label || id || 'Not provided';
  }
  industry(id: string | null) {
    return (
      this.references.industries.find((v) => v.id === id)?.label ||
      (id ? id.replaceAll('_', ' ').replaceAll('-', ' ') : 'Industry not specified')
    );
  }
  admin(id: string) {
    return this.references.admins.find((v) => v.id === id)?.label || 'Assigned administrator';
  }
  font(id: string | null) {
    return this.references.typography.find((v) => v.id === id)?.label || 'System font';
  }
  payment(id: string | null) {
    return (
      this.references.paymentMethods.find((v) => v.id === id)?.label ||
      (id ? id.replaceAll('_', ' ') : 'Not specified')
    );
  }
  assetUrl(id: string | null | undefined) {
    return id ? this.asset(id) : null;
  }
  colour(value: string | null | undefined) {
    return /^#[0-9a-f]{6}$/i.test(value || '') ? value : '#17365d';
  }
  readonly policy = inject(DIRECTORY_POLICY);
  readonly tenant = signal<DirectoryTenant | null>(null);
  readonly loading = signal(false);
  readonly busy = signal(false);
  readonly error = signal('');
  readonly success = signal('');
  readonly selected = signal<LifecycleAction | null>(null);
  readonly actionError = signal('');
  readonly activityOpen = signal(false);
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
          this.activityOpen.set(false);
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
          this.success.set('Tenant status updated.');
          this.reload();
        },
        error: (e) => {
          this.busy.set(false);
          this.actionError.set(apiMessage(e));
        },
      });
  }
}
