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
          Saved asset references are retained; displaying them uses the approved asset URL adapter.
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
                      : 'Saved branding could not be loaded. Check your API connection and administrator access, then retry.',
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
