import { Component, DestroyRef, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TenantGateway } from './tenant.gateway';
import { Tenant } from './tenant.types';
import { BrandingPreview } from './branding-preview';
import { HttpErrorResponse } from '@angular/common/http';
import { EMPTY, Subject, catchError, distinctUntilChanged, map, startWith, switchMap } from 'rxjs';

@Component({
  selector: 'app-saved-branding',
  imports: [RouterLink, BrandingPreview],
  template: `
    <div class="breadcrumb">
      <a routerLink="/tenants">Tenants</a><span>/</span><span>Workspace branding</span>
    </div>
    <p class="eyebrow">COMPANY IDENTITY</p>
    <h1>Branding preview</h1>
    <p class="subheading">A closer look at your company’s saved workspace identity.</p>
    @if (loading()) {
      <p role="status">Loading saved branding…</p>
    }
    @if (error()) {
      <div role="alert">
        <p>{{ error() }}</p>
        <button type="button" (click)="load()">Retry</button>
      </div>
    }
    @if (tenant(); as t) {
      <div class="preview-frame">
        <div class="browser-bar">
          <span></span><span></span><span></span>
          <div>{{ t.company_name || 'Company workspace' }}</div>
        </div>
        <app-branding-preview [tenant]="t" />
      </div>
      @if (t.branding.logo_attachment_id || t.branding.favicon_attachment_id) {
        <p>Your saved company images are shown above.</p>
      }
      <p><a [routerLink]="['/tenants', t.id, 'edit']">Edit branding settings</a></p>
    }
  `,
  styles: `
    :host {
      display: block;
      max-width: 920px;
      margin: auto;
    }
    .preview-frame {
      margin-top: 30px;
      padding: 0 24px 24px;
      border: 1px solid var(--line);
      border-radius: 14px;
      background: white;
      box-shadow: 0 8px 40px #17233a06;
    }
    .browser-bar {
      height: 60px;
      display: flex;
      align-items: center;
      gap: 5px;
    }
    .browser-bar > span {
      height: 7px;
      width: 7px;
      border-radius: 50%;
      background: #e5e9ef;
    }
    .browser-bar > span:first-child {
      background: #eac8c1;
    }
    .browser-bar > div {
      margin: auto;
      font-size: 10px;
      color: #9ba4b2;
      background: #f6f7f9;
      padding: 6px 30px;
      border-radius: 5px;
    }
    .preview-frame + p {
      color: var(--muted);
      font-size: 11px;
      margin-top: 18px;
    }
    a {
      font-size: 12px;
      text-decoration: none;
    }
    button {
      font: inherit;
    }
    @media (max-width: 520px) {
      .preview-frame {
        padding: 0 14px 14px;
      }
      .browser-bar > div {
        padding-inline: 12px;
      }
    }
  `,
})
export class SavedBranding {
  private readonly gateway = inject(TenantGateway);
  private readonly route = inject(ActivatedRoute);
  private readonly destroy = inject(DestroyRef);
  readonly tenant = signal<Tenant | null>(null);
  readonly loading = signal(false);
  readonly error = signal('');
  private readonly retry = new Subject<void>();
  constructor() {
    this.route.paramMap
      .pipe(
        map((params) => params.get('id')),
        distinctUntilChanged(),
        switchMap((id) =>
          this.retry.pipe(
            startWith(undefined),
            switchMap(() => {
              this.loading.set(true);
              this.error.set('');
              this.tenant.set(null);
              if (!id) {
                this.loading.set(false);
                this.error.set('A tenant identifier is required.');
                return EMPTY;
              }
              return this.gateway.load(id).pipe(
                catchError((error) => {
                  this.loading.set(false);
                  this.error.set(
                    error instanceof HttpErrorResponse && error.status === 403
                      ? 'You do not have access to this tenant.'
                      : 'We couldn’t load this branding. Check your connection and sign-in access, then retry.',
                  );
                  return EMPTY;
                }),
              );
            }),
          ),
        ),
        takeUntilDestroyed(this.destroy),
      )
      .subscribe((t) => {
        this.tenant.set(t);
        this.loading.set(false);
      });
  }
  load() {
    this.retry.next();
  }
}
