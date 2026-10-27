import { Component, DestroyRef, inject, signal } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { Title } from '@angular/platform-browser';
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute, RouterLink, Router } from '@angular/router';
import { catchError, EMPTY, switchMap, Subscription } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TenantSession, accessError } from './access-api';
import { brandingInk } from '../tenant/branding-colour';
import { TenantDashboard } from '../tenant/tenant-dashboard';
interface Workspace {
  id: string;
  company_name: string;
  display_name?: string;
  description: string | null;
  company_name_display: boolean;
  role: string;
  country?: string;
  time_zone?: string;
  currency?: string;
  branding: {
    primary_colour: string;
    secondary_colour: string;
    typography: string;
    logo_attachment_id: string | null;
    favicon_attachment_id?: string | null;
  };
}
@Component({
  imports: [RouterLink, TenantDashboard],
  host: { class: 'workspace-page' },
  template: `<p class="eyebrow">TENANT ADMINISTRATION</p>
    <h1>{{ workspace() ? 'Company workspace' : 'Your workspaces' }}</h1>
    @if (error()) {
      <p class="error-summary" role="alert">{{ error() }}</p>
      <button (click)="load()">Retry workspace</button>
    }
    @if (loading()) {
      <p role="status">Loading your workspace access…</p>
    }
    @if (workspace(); as w) {
      <a routerLink="/workspaces" class="back-link">← All workspaces</a>
      <button type="button" (click)="load()">Refresh saved branding</button>
      <p class="muted">
        Saved company settings · Changes made by your platform administrator appear after refresh.
      </p>
      <p class="muted">
        Country: {{ countryName(w.country) }} · Time zone: {{ w.time_zone || 'Not specified' }} ·
        Currency: {{ w.currency || 'Not specified' }}
      </p>
      <app-tenant-dashboard
        [identity]="w"
        [font]="font(w)"
        [logo]="w.branding.logo_attachment_id ? asset(w.id, w.branding.logo_attachment_id) : null"
        [favicon]="
          w.branding.favicon_attachment_id ? asset(w.id, w.branding.favicon_attachment_id) : null
        "
      />
    } @else if (!loading() && !error()) {
      <p class="subheading">
        Only companies with an explicit membership appear here. Open an Active workspace to
        continue.
      </p>
      <ul class="workspaces">
        @for (w of workspaces(); track w.id) {
          <li>
            <div>
              <h2>{{ w.company_name }}</h2>
              <span class="badge" [attr.data-status]="w.status">{{ w.status }}</span>
            </div>
            @if (w.status === 'active') {
              <a class="button primary" [routerLink]="['/workspaces', w.id]">Open workspace</a>
            } @else {
              <p class="muted">Access is unavailable until SELISE activates this tenant.</p>
            }
          </li>
        } @empty {
          <li>No tenant memberships are available. Ask your administrator for an invitation.</li>
        }
      </ul>
    }`,
  styles: `
    :host {
      display: block;
      width: 100%;
      max-width: 1100px;
    }
    .workspaces {
      list-style: none;
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 24px;
      padding: 0;
      margin: 24px 0;
    }
    .workspaces li,
    .tenant-workspace {
      background: white;
      border: 1px solid var(--line);
      border-radius: var(--radius);
      overflow: hidden;
    }
    .workspaces li {
      padding: 24px;
      display: flex;
      gap: 20px;
      align-items: flex-start;
      justify-content: space-between;
      flex-wrap: wrap;
    }
    .workspaces li > div {
      min-width: 0;
    }
    .workspaces h2 {
      overflow-wrap: anywhere;
    }
    .back-link {
      display: inline-block;
      margin: 12px 0 24px;
    }
    .tenant-workspace header {
      padding: 24px;
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 16px;
      overflow-wrap: anywhere;
    }
    .tenant-workspace header img {
      max-width: 120px;
      max-height: 64px;
      object-fit: contain;
    }
    .tenant-workspace > div {
      padding: 32px;
    }
    .tenant-workspace h2 {
      font-size: 24px;
      margin: 20px 0;
    }
    .muted {
      font-size: 13px;
      color: var(--muted);
    }
    @media (max-width: 700px) {
      .workspaces {
        grid-template-columns: 1fr;
      }
      .tenant-workspace > div {
        padding: 24px;
      }
    }
  `,
})
export class TenantWorkspaces {
  private session = inject(TenantSession);
  private document = inject(DOCUMENT);
  private title = inject(Title);
  private originalTitle = this.title.getTitle();
  private icon = this.document.querySelector<HTMLLinkElement>('link[rel="icon"]');
  private originalIcon = this.icon?.getAttribute('href') || '/favicon.ico';
  private originalIconType = this.icon?.getAttribute('type');
  private faviconFailed = () => this.icon?.setAttribute('href', this.originalIcon);
  private clearBrowserBrand() {
    this.title.setTitle(this.originalTitle);
    this.icon?.setAttribute('href', this.originalIcon);
    if (this.originalIconType) this.icon?.setAttribute('type', this.originalIconType);
  }
  private http = inject(HttpClient);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private request?: Subscription;
  private readonly destroy = inject(DestroyRef);
  private id: string | null = null;
  readonly workspace = signal<Workspace | null>(null);
  readonly workspaces = signal<{ id: string; company_name: string; status: string }[]>([]);
  readonly error = signal('');
  readonly loading = signal(true);
  readonly ink = brandingInk;
  constructor() {
    this.icon?.addEventListener('error', this.faviconFailed);
    this.destroy.onDestroy(() => {
      this.request?.unsubscribe();
      this.clearBrowserBrand();
      this.icon?.removeEventListener('error', this.faviconFailed);
    });
    this.route.paramMap.pipe(takeUntilDestroyed(inject(DestroyRef))).subscribe((p) => {
      this.id = p.get('id');
      this.load();
    });
  }
  load() {
    this.request?.unsubscribe();
    this.loading.set(true);
    this.error.set('');
    this.workspace.set(null);
    this.clearBrowserBrand();
    this.workspaces.set([]);
    const id = this.id;
    this.request = this.session
      .refresh()
      .pipe(
        switchMap((actor) => {
          if (!actor) {
            void this.router.navigateByUrl('/tenant-login');
            return EMPTY;
          }
          return this.http.get<{ data: any }>(
            id ? '/api/v1/my_workspaces/' + encodeURIComponent(id) : '/api/v1/my_workspaces',
          );
        }),
        catchError((e) => {
          if (id === this.id) {
            this.error.set(accessError(e));
            this.loading.set(false);
          }
          return EMPTY;
        }),
      )
      .subscribe((r) => {
        if (id !== this.id) return;
        if (id) {
          this.workspace.set(r.data);
          this.title.setTitle(
            (r.data.company_name_display
              ? r.data.display_name || r.data.company_name
              : 'Company workspace') + ' · Workspace',
          );
          const asset = r.data.branding?.favicon_attachment_id;
          if (asset) {
            this.icon?.removeAttribute('type');
            this.icon?.setAttribute('href', this.asset(id, asset));
          }
        } else this.workspaces.set(r.data);
        this.loading.set(false);
      });
  }
  countryName(code?: string) {
    if (!code) return 'Not specified';
    try {
      return new Intl.DisplayNames(['en'], { type: 'region' }).of(code) || code;
    } catch {
      return code;
    }
  }
  font(w: Workspace) {
    return w.branding.typography === 'open_sans'
      ? "'Open Sans', sans-serif"
      : w.branding.typography === 'serif'
        ? 'Georgia, serif'
        : 'system-ui, sans-serif';
  }
  colour(value: string) {
    return /^#[0-9a-f]{6}$/i.test(value) ? value : '#17365D';
  }
  asset(id: string, asset: string) {
    return (
      '/api/v1/my_workspaces/' + encodeURIComponent(id) + '/assets/' + encodeURIComponent(asset)
    );
  }
}
