import { Component, DestroyRef, inject, input, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Subscription } from 'rxjs';
import { apiMessage } from './tenant-directory';

export interface ActivityPage {
  data: { id: string; action: string; occurred_at: string; changed_fields: string[] }[];
  meta: { page: number; per_page: number; total_count: number; total_pages: number };
}

@Component({
  selector: 'app-tenant-activity',
  imports: [DatePipe],
  template: `
    @if (loading()) {
      <p role="status">Loading tenant activity…</p>
    } @else if (error()) {
      <div role="alert">
        <p>{{ error() }}</p>
        <button type="button" (click)="load()">Retry activity</button>
      </div>
    } @else if (result(); as r) {
      <p class="activity-count" role="status">
        {{ r.meta.total_count }} recorded {{ r.meta.total_count === 1 ? 'event' : 'events' }}
      </p>
      <ol aria-label="Tenant activity, newest first">
        @for (event of r.data; track event.id) {
          <li>
            <span class="event-dot" aria-hidden="true"></span>
            <div>
              <strong>{{ label(event.action) }}</strong>
              @if (event.changed_fields.length) {
                <p>Fields: {{ event.changed_fields.map(fieldLabel).join(', ') }}</p>
              }
            </div>
            <time [attr.datetime]="event.occurred_at">{{
              event.occurred_at | date: 'medium'
            }}</time>
          </li>
        } @empty {
          <li>No recorded activity for this tenant.</li>
        }
      </ol>
      @if (r.meta.total_pages > 1) {
        <nav aria-label="Activity pages">
          <span>Page {{ r.meta.page }} of {{ r.meta.total_pages }}</span>
          <div>
            <button type="button" [disabled]="r.meta.page <= 1" (click)="page(r.meta.page - 1)">
              Previous events
            </button>
            <button
              type="button"
              [disabled]="r.meta.page >= r.meta.total_pages"
              (click)="page(r.meta.page + 1)"
            >
              Next events
            </button>
          </div>
        </nav>
      }
    }
  `,
  styles: `
    :host {
      display: block;
      min-width: 0;
    }
    ol {
      list-style: none;
      margin: 0;
      padding: 0;
    }
    li {
      display: grid;
      grid-template-columns: 12px minmax(0, 1fr) auto;
      gap: 12px;
      padding: 16px 0;
      border-top: 1px solid var(--line);
      align-items: start;
    }
    li strong {
      font-size: 14px;
    }
    p,
    .activity-count {
      font-size: 13px;
      color: var(--muted);
      margin: 4px 0 0;
    }
    .activity-count {
      margin-bottom: 16px;
    }
    .event-dot {
      width: 8px;
      height: 8px;
      background: var(--accent);
      border-radius: 50%;
      margin-top: 7px;
    }
    time {
      font-size: 12px;
      color: var(--muted);
    }
    nav {
      display: flex;
      gap: 16px;
      align-items: center;
      justify-content: space-between;
      font-size: 13px;
      border-top: 1px solid var(--line);
      padding-top: 16px;
    }
    nav div {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
    }
    @media (max-width: 700px) {
      li {
        grid-template-columns: 12px minmax(0, 1fr);
      }
      time {
        grid-column: 2;
      }
      nav {
        align-items: flex-start;
        flex-direction: column;
      }
    }
  `,
})
export class TenantActivity {
  readonly tenantId = input.required<string>();
  readonly loading = signal(false);
  readonly error = signal('');
  readonly result = signal<ActivityPage | null>(null);
  private http = inject(HttpClient);
  private request?: Subscription;
  private currentPage = 1;
  constructor() {
    inject(DestroyRef).onDestroy(() => this.request?.unsubscribe());
  }
  ngOnChanges() {
    this.currentPage = 1;
    this.load();
  }
  page(page: number) {
    if (!this.loading()) {
      this.currentPage = page;
      this.load();
    }
  }
  load() {
    this.request?.unsubscribe();
    this.result.set(null);
    this.error.set('');
    this.loading.set(true);
    this.request = this.http
      .get<ActivityPage>(`/api/v1/tenants/${encodeURIComponent(this.tenantId())}/activity`, {
        params: { page: this.currentPage, per_page: 20 },
      })
      .subscribe({
        next: (result) => {
          this.result.set(result);
          this.loading.set(false);
        },
        error: (error) => {
          this.error.set(apiMessage(error));
          this.loading.set(false);
        },
      });
  }
  label(action: string) {
    return (
      (
        {
          created: 'Tenant created',
          updated: 'Tenant updated',
          activate: 'Tenant activated',
          deactivate: 'Tenant deactivated',
          suspend: 'Tenant suspended',
          reactivate: 'Returned to inactive',
          archive: 'Tenant archived',
          restore: 'Tenant restored to inactive',
        } as Record<string, string>
      )[action] || action.replaceAll('_', ' ')
    );
  }
  readonly fieldLabel = (field: string) =>
    (
      ({
        company_name: 'Company name',
        company_name_display: 'Company name display',
        description: 'Description',
        industry_id: 'Industry',
        contacts: 'Contacts',
        responsible_admin_ids: 'Responsible CPQ Admin',
        branding: 'Branding',
        subscription: 'Subscription',
        lifecycle_status: 'Status',
      }) as Record<string, string>
    )[field] || field.replaceAll('_', ' ');
}
