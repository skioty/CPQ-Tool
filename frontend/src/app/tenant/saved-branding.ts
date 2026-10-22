import { Component, DestroyRef, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TenantGateway } from './tenant.gateway';
import { Tenant } from './tenant.types';
import { BrandingPreview } from './branding-preview';

@Component({
  selector: 'app-saved-branding',
  imports: [RouterLink, BrandingPreview],
  template: `
    <p>WORKSPACE BRANDING</p>
    <h1>Saved branding preview</h1>
    <p>This view loads saved settings from the API. Unsaved form edits are not shown.</p>
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
      <app-branding-preview [tenant]="t" />
      @if (t.branding.logo_attachment_id || t.branding.favicon_attachment_id) {
        <p>
          Saved asset references are retained; displaying them awaits the approved asset URL
          adapter.
        </p>
      }
      <p><a [routerLink]="['/tenants', t.id, 'edit']">Edit branding settings</a></p>
    }
  `,
  styles: `
    :host {
      display: block;
      max-width: 900px;
      margin: auto;
    }
    p {
      line-height: 1.6;
    }
    button {
      padding: 12px;
      font: inherit;
    }
    a {
      color: #58418d;
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
  constructor() {
    this.load();
  }
  load() {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) return;
    this.loading.set(true);
    this.error.set('');
    this.tenant.set(null);
    this.gateway
      .load(id)
      .pipe(takeUntilDestroyed(this.destroy))
      .subscribe({
        next: (t) => {
          this.tenant.set(t);
          this.loading.set(false);
        },
        error: () => {
          this.error.set(
            'Saved branding could not be loaded. The tenant API, authentication and asset integration are not yet available in the foundation.',
          );
          this.loading.set(false);
        },
      });
  }
}
