import { FORM_OPTIONS } from '../tenant/tenant.types';
import { DatePipe } from '@angular/common';
import { Component, DestroyRef, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Subject, catchError, of, startWith, switchMap, tap } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DIRECTORY_POLICY, TenantDirectory, TenantPage, apiMessage } from './tenant-directory';
import { Session } from './session';
import { CreationNotice } from './creation-notice';

@Component({
  imports: [FormsModule, RouterLink, DatePipe],
  host: { class: 'directory-page' },
  template: `<div class="heading portfolio-heading">
      <div>
        <p class="eyebrow">ORGANIZATION WORKSPACES</p>
        <h1>Tenant management</h1>
        <p class="subheading">
          Manage company workspaces, contacts and subscriptions in one place.
        </p>
      </div>
      @if (session.actor()?.role === 'super_admin') {
        <a class="button primary" routerLink="/tenants/new"
          ><span aria-hidden="true">＋</span> Create tenant</a
        >
      }
    </div>
    @if (created) {
      <p class="success" role="status">Tenant created successfully.</p>
    }
    <div class="tenant-summary" aria-label="Tenant summary">
      <div>
        <span>Total tenants</span
        ><strong>{{ result()?.summary?.total ?? result()?.meta?.total_count ?? '—' }}</strong
        ><small>{{ result()?.summary?.industries ?? '—' }} industries</small>
      </div>
      <div>
        <span>Active tenants</span><strong>{{ result()?.summary?.active ?? '—' }}</strong
        ><small>Workspace access enabled</small>
      </div>
      <div>
        <span>Inactive tenants</span><strong>{{ result()?.summary?.inactive ?? '—' }}</strong
        ><small>Workspace access disabled</small>
      </div>
      <div>
        <span>Suspended</span><strong>{{ result()?.summary?.suspended ?? '—' }}</strong
        ><small>Administratively restricted</small>
      </div>
    </div>
    <section class="directory-panel" aria-label="Tenant directory" [attr.aria-busy]="loading()">
      <div class="panel-heading">
        <div>
          <h2>Tenant directory</h2>
          <p>Companies available to your administrator account.</p>
        </div>
        <span class="panel-label">COMPANY WORKSPACES</span>
      </div>
      <form class="filters" (ngSubmit)="search()">
        <label class="search-label"
          >Search company name
          <div class="search-input">
            <svg aria-hidden="true" viewBox="0 0 24 24">
              <circle cx="10.5" cy="10.5" r="6.5" />
              <path d="m16 16 4.5 4.5" /></svg
            ><input
              name="query"
              [(ngModel)]="query"
              type="search"
              placeholder="Search organizations or tenant ID…"
            /></div
        ></label>
        <label class="status-label"
          >Status<select name="status" [(ngModel)]="status" [disabled]="!policy.statuses.length">
            <option value="">All statuses</option>
            @for (s of policy.statuses; track s.value) {
              <option [value]="s.value">{{ s.label }}</option>
            }
          </select></label
        >
        <label class="status-label"
          >Industry<select name="industry" [(ngModel)]="industry">
            <option value="">All industries</option>
            @for (choice of options.industries; track choice.id) {
              <option [value]="choice.id">{{ choice.label }}</option>
            }
          </select></label
        >
        <button class="filter-submit">Search</button>
        @if (hasFilters()) {
          <button class="clear-filters" type="button" (click)="clearFilters()">
            Clear filters
          </button>
        }
      </form>
      @if (loading()) {
        <div class="loading-state" role="status">
          <span class="loading-dot"></span>
          <h2>Loading your tenants</h2>
          <p>Getting the latest company information.</p>
        </div>
      } @else if (error()) {
        <div class="state empty-state" role="alert">
          <div class="state-symbol">!</div>
          <h2>We couldn’t load your tenants</h2>
          <p>{{ error() }}</p>
          <div class="actions">
            <button (click)="reload()">Retry</button><a routerLink="/login">Administrator login</a>
          </div>
        </div>
      } @else if (result(); as r) {
        <div class="results-bar">
          <p role="status">
            <strong>{{ r.meta.total_count }}</strong> matching tenants
          </p>
          <span>Updated from your workspace</span>
        </div>
        @if (!r.data.length) {
          <div class="empty-state">
            <div class="state-symbol">⌕</div>
            <h2>{{ hasFilters() ? 'No tenants match your filters' : 'No tenants yet' }}</h2>
            <p>
              {{
                hasFilters()
                  ? 'Try a different company name or clear your filters to see all available tenants.'
                  : session.actor()?.role === 'super_admin'
                    ? 'Create a tenant to bring company details, contacts and branding into your workspace.'
                    : 'Companies will appear here when a Super Admin assigns them to you.'
              }}
            </p>
            @if (hasFilters()) {
              <button type="button" (click)="clearFilters()">Clear filters</button>
            }
            @if (!hasFilters() && session.actor()?.role === 'super_admin') {
              <a class="button primary" routerLink="/tenants/new">Create your first tenant</a>
            }
          </div>
        } @else {
          <div class="row-head" aria-hidden="true">
            <span>ORGANIZATION</span><span>INDUSTRY</span><span>STATUS</span><span>USERS</span
            ><span>CREATED</span><span>ACTIONS</span>
          </div>
          <ul class="tenant-rows">
            @for (t of r.data; track t.id) {
              <li class="tenant-row">
                <div class="tenant-identity">
                  <span class="company-avatar" aria-hidden="true">{{
                    initials(t.company_name)
                  }}</span>
                  <div>
                    <a [routerLink]="['/tenants', t.id]">{{
                      t.company_name || 'Unnamed company'
                    }}</a>
                    <p>{{ t.description || 'Company workspace' }}</p>
                  </div>
                </div>
                <div class="row-industry">
                  <span class="mobile-label">Industry</span>{{ industryLabel(t.industry_id) }}
                </div>
                <div class="row-status">
                  <span class="badge" [attr.data-status]="t.lifecycle_status">{{
                    t.lifecycle_status || 'Not set'
                  }}</span>
                  @if (t.provisioning_status !== 'ready') {
                    <small>Setup in progress</small>
                  }
                </div>
                <div class="row-users">
                  <span class="mobile-label">Tenant accounts</span>{{ t.user_count ?? '—' }}
                </div>
                <div class="row-created">
                  <span class="mobile-label">Created</span
                  >{{ t.created_at ? (t.created_at | date: 'dd MMM yyyy') : 'Not available' }}
                </div>
                <a
                  class="row-open"
                  [routerLink]="['/tenants', t.id]"
                  [attr.aria-label]="'View ' + t.company_name"
                  ><span aria-hidden="true">↗</span></a
                >
              </li>
            }
          </ul>
        }
        <nav class="pagination" aria-label="Tenant pages">
          <label class="page-size"
            >Rows per page
            <select aria-label="Rows per page" [ngModel]="perPage" (ngModelChange)="resize($event)">
              <option [ngValue]="20">20</option>
              <option [ngValue]="50">50</option>
              <option [ngValue]="100">100</option>
            </select>
          </label>
          <span
            >Page <strong>{{ r.meta.page }}</strong> of {{ r.meta.total_pages || 1 }}</span
          >
          <div>
            <button [disabled]="r.meta.page <= 1" (click)="page(r.meta.page - 1)">
              <span aria-hidden="true">←</span> Previous</button
            ><button [disabled]="r.meta.page >= r.meta.total_pages" (click)="page(r.meta.page + 1)">
              Next <span aria-hidden="true">→</span>
            </button>
          </div>
        </nav>
      }
    </section>`,
})
export class TenantList {
  readonly created = inject(CreationNotice).consume();
  readonly session = inject(Session);
  readonly options = inject(FORM_OPTIONS);
  industryLabel(id: string | null) {
    return this.options.industries.find((c) => c.id === id)?.label || id || 'Not set';
  }
  readonly policy = inject(DIRECTORY_POLICY);
  private api = inject(TenantDirectory);
  initials(name: string | null) {
    return (name || 'Company')
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((n) => n[0])
      .join('')
      .toUpperCase();
  }
  primaryName(contacts: { name: string | null; primary: boolean }[]) {
    return contacts.find((c) => c.primary)?.name || 'Primary contact';
  }
  query = this.api.view().query;
  status = this.api.view().status;
  perPage = this.api.view().perPage;
  industry = this.api.view().industry || '';
  private activeIndustry = this.industry;
  private activeQuery = this.query;
  private activeStatus = this.status;
  private currentPage = this.api.view().page;
  readonly loading = signal(false);
  readonly error = signal('');
  readonly result = signal<TenantPage | null>(null);
  private changes = new Subject<void>();
  constructor() {
    this.changes
      .pipe(
        startWith(undefined),
        tap(() => {
          this.loading.set(true);
          this.error.set('');
          this.result.set(null);
        }),
        switchMap(() =>
          this.api
            .list(
              this.activeQuery,
              this.activeStatus,
              this.currentPage,
              this.perPage,
              this.activeIndustry,
            )
            .pipe(
              catchError((e) => {
                this.error.set(apiMessage(e));
                return of(null);
              }),
            ),
        ),
        takeUntilDestroyed(inject(DestroyRef)),
      )
      .subscribe((r) => {
        this.result.set(r);
        this.loading.set(false);
      });
  }
  hasFilters() {
    return Boolean(this.activeQuery || this.activeStatus || this.activeIndustry);
  }
  clearFilters() {
    this.query = '';
    this.status = '';
    this.industry = '';
    this.search();
  }
  search() {
    this.activeQuery = this.query.trim();
    this.activeStatus = this.status;
    this.activeIndustry = this.industry;
    this.currentPage = 1;
    this.reload();
  }
  page(page: number) {
    this.currentPage = page;
    this.reload();
  }
  resize(size: number) {
    if (![20, 50, 100].includes(size)) return;
    this.perPage = size;
    this.currentPage = 1;
    this.reload();
  }
  reload() {
    this.api.view.set({
      query: this.activeQuery,
      status: this.activeStatus,
      industry: this.activeIndustry,
      page: this.currentPage,
      perPage: this.perPage,
    });
    this.changes.next();
  }
}
