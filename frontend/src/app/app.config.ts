import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter, withInMemoryScrolling } from '@angular/router';

import { FORM_OPTIONS, ASSET_UPLOAD, ASSET_URL, AssetKind, Asset } from './tenant/tenant.types';
import { approvedFormOptions } from './tenant/reference-data';
import { HttpClient } from '@angular/common/http';
import { inject } from '@angular/core';
import { routes } from './app.routes';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { sessionHeaders } from './navigation/session';

export const appConfig: ApplicationConfig = {
  providers: [
    provideHttpClient(withInterceptors([sessionHeaders])),
    provideBrowserGlobalErrorListeners(),
    provideRouter(
      routes,
      withInMemoryScrolling({ anchorScrolling: 'enabled', scrollPositionRestoration: 'enabled' }),
    ),
    { provide: FORM_OPTIONS, useFactory: approvedFormOptions },
    {
      provide: ASSET_URL,
      useValue: (id: string) => `/api/v1/brand_assets/${encodeURIComponent(id)}`,
    },
    {
      provide: ASSET_UPLOAD,
      useFactory: () => {
        const http = inject(HttpClient);
        return (kind: AssetKind, file: File, tenantId?: string) => {
          const body = new FormData();
          body.set('kind', kind);
          body.set('file', file);
          if (tenantId) body.set('tenant_id', tenantId);
          return http.post<Asset>('/api/v1/brand_assets', body);
        };
      },
    },
  ],
};
