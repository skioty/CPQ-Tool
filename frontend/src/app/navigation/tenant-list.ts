import { DecimalPipe } from '@angular/common';
import { Component, DestroyRef, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Subject, catchError, of, startWith, switchMap, tap } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DIRECTORY_POLICY, TenantDirectory, TenantPage, apiMessage } from './tenant-directory';
import { Session } from './session';

@Component({
  imports: [FormsModule, RouterLink, DecimalPipe],
  host: { class: 'directory-page' },
  template: `<div class="heading portfolio-heading">
      <div>
        <p class="eyebrow">TENANT OPERATIONS</p>
        <h1>Tenants</h1>
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
    <div class="portfolio-context">
      <div class="portfolio-context-icon" aria-hidden="true">
        <svg viewBox="0 0 24 24">
          <path d="M4 21V5l8-3v19M12 8h8v13M2 21h20M7 7h2M7 11h2M7 15h2M15 12h2M15 16h2" />
        </svg>
      </div>
      <div>
        <h2>{{ hasFilters() ? 'Your filtered portfolio' : 'Your company workspaces' }}</h2>
        <p>Open a company to review its setup, manage access or update its details.</p>
      </div>
      @if (result(); as page) {
        <div class="portfolio-total">
          <strong>{{ page.meta.total_count }}</strong
          ><span>{{ hasFilters() ? 'matching tenants' : 'accessible tenants' }}</span>
        </div>
      }
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
              placeholder="Search by company name…"
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
            <span>COMPANY</span><span>CONTACTS</span><span>SUBSCRIPTION</span><span>STATUS</span
            ><span></span>
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
                <div class="row-contacts">
                  <span class="mobile-label">Contacts</span
                  ><strong
                    >{{ t.contacts.length }}
                    {{ t.contacts.length === 1 ? 'contact' : 'contacts' }}</strong
                  ><small>{{ primaryName(t.contacts) }}</small>
                </div>
                <div class="row-subscription">
                  <span class="mobile-label">Subscription</span
                  ><strong
                    >{{
                      t.subscription.fee === null ? '—' : (t.subscription.fee | number: '1.2-2')
                    }}
                    <span>{{ t.subscription.currency || '' }}</span></strong
                  ><small>per month</small>
                </div>
                <div class="row-status">
                  <span class="badge" [attr.data-status]="t.lifecycle_status">{{
                    t.lifecycle_status || 'Not set'
                  }}</span>
                  @if (t.provisioning_status !== 'ready') {
                    <small>Setup in progress</small>
                  }
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
  readonly session = inject(Session);
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
          this.api.list(this.activeQuery, this.activeStatus, this.currentPage, this.perPage).pipe(
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
    return Boolean(this.activeQuery || this.activeStatus);
  }
  clearFilters() {
    this.query = '';
    this.status = '';
    this.search();
  }
  search() {
    this.activeQuery = this.query.trim();
    this.activeStatus = this.status;
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
      page: this.currentPage,
      perPage: this.perPage,
    });
    this.changes.next();
  }
}
