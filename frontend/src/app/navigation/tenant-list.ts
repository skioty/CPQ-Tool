import { Component, DestroyRef, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Subject, catchError, of, startWith, switchMap, tap } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DIRECTORY_POLICY, TenantDirectory, TenantPage, apiMessage } from './tenant-directory';
import { Session } from './session';

@Component({
  imports: [FormsModule, RouterLink],
  styleUrl: './directory.scss',
  template: `<div class="heading">
      <div>
        <p class="eyebrow">PLATFORM ADMINISTRATION</p>
        <h1>Tenants</h1>
      </div>
      @if (session.actor()?.role === 'super_admin') {
        <a class="button" routerLink="/tenants/new">Create tenant</a>
      }
    </div>
    <p>Manage tenants available to your administrator account.</p>
    <form class="filters" (ngSubmit)="search()">
      <label>Search company name<input name="query" [(ngModel)]="query" type="search" /></label>
      <label
        >Status<select name="status" [(ngModel)]="status" [disabled]="!policy.statuses.length">
          <option value="">All statuses</option>
          @for (s of policy.statuses; track s.value) {
            <option [value]="s.value">{{ s.label }}</option>
          }
        </select></label
      >
      <button>Search</button>
    </form>
    @if (!policy.statuses.length) {
      <p class="muted">Status filters await an approved status catalogue.</p>
    }
    @if (loading()) {
      <p role="status">Loading tenants…</p>
    } @else if (error()) {
      <div role="alert">
        <p>{{ error() }}</p>
        <button (click)="reload()">Retry</button><a routerLink="/login">Administrator login</a>
      </div>
    } @else if (result(); as r) {
      <p role="status">{{ r.meta.total_count }} matching tenants</p>
      @if (!r.data.length) {
        <div class="card">
          <h2>No tenants found</h2>
          <p>Try another search, or confirm tenant assignments with your Super Admin.</p>
        </div>
      } @else {
        <ul class="tenant-grid">
          @for (t of r.data; track t.id) {
            <li class="card">
              <a [routerLink]="['/tenants', t.id]"
                ><h2>{{ t.company_name || 'Company name not set' }}</h2></a
              >
              <p>{{ t.description || 'No description provided' }}</p>
              <dl>
                <dt>Lifecycle</dt>
                <dd>{{ t.lifecycle_status || 'Not assigned' }}</dd>
                <dt>Provisioning</dt>
                <dd>{{ t.provisioning_status }}</dd>
              </dl>
            </li>
          }
        </ul>
      }
      <nav class="pagination" aria-label="Tenant pages">
        <button [disabled]="r.meta.page <= 1" (click)="page(r.meta.page - 1)">Previous</button
        ><span>Page {{ r.meta.page }} of {{ r.meta.total_pages || 1 }}</span
        ><button [disabled]="r.meta.page >= r.meta.total_pages" (click)="page(r.meta.page + 1)">
          Next
        </button>
      </nav>
    }`,
})
export class TenantList {
  readonly session = inject(Session);
  readonly policy = inject(DIRECTORY_POLICY);
  private api = inject(TenantDirectory);
  query = '';
  status = '';
  private activeQuery = '';
  private activeStatus = '';
  private currentPage = 1;
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
          this.api.list(this.activeQuery, this.activeStatus, this.currentPage).pipe(
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
  reload() {
    this.changes.next();
  }
}
