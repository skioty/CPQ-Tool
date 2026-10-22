import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { map } from 'rxjs';
import { Tenant } from './tenant.types';

// Proposed contract adapter only. No mock backend or local simulated persistence.
@Injectable({ providedIn: 'root' })
export class TenantGateway {
  private readonly http = inject(HttpClient);
  private path(id: string) {
    return `/api/v1/tenants/${encodeURIComponent(id)}`;
  }
  load(id: string) {
    return this.http.get<{ data: Tenant }>(this.path(id)).pipe(map((r) => this.complete(r.data)));
  }
  save(value: Tenant, id?: string) {
    const body = { tenant: value };
    return (
      id
        ? this.http.patch<{ data: Tenant }>(this.path(id), body)
        : this.http.post<{ data: Tenant }>('/api/v1/tenants', body)
    ).pipe(map((r) => this.complete(r.data)));
  }
  private complete(t: Tenant): Tenant {
    // Refuse partial edit responses rather than replacing missing server settings with blanks.
    if (
      typeof t?.id !== 'string' ||
      !t.id ||
      typeof t.company_name !== 'string' ||
      typeof t.company_name_display !== 'boolean' ||
      typeof t.description !== 'string' ||
      typeof t.industry_id !== 'string' ||
      !Array.isArray(t.contacts) ||
      !Array.isArray(t.responsible_admin_ids) ||
      !t.contacts.every(
        (c) =>
          c &&
          typeof c.name === 'string' &&
          typeof c.email === 'string' &&
          typeof c.primary === 'boolean',
      ) ||
      !t.responsible_admin_ids.every((id) => typeof id === 'string') ||
      !t.branding ||
      !t.subscription?.discount ||
      ![
        'primary_colour',
        'secondary_colour',
        'typography',
        'logo_attachment_id',
        'favicon_attachment_id',
      ].every((k) => k in t.branding) ||
      !['primary_colour', 'secondary_colour', 'typography'].every(
        (k) => typeof t.branding[k] === 'string',
      ) ||
      !['logo_attachment_id', 'favicon_attachment_id'].every(
        (k) => t.branding[k] === null || typeof t.branding[k] === 'string',
      ) ||
      !['currency', 'fee', 'payment_method'].every((k) => typeof t.subscription[k] === 'string') ||
      !['type', 'value', 'duration'].every((k) => typeof t.subscription.discount[k] === 'string')
    ) {
      throw new Error(
        'The API returned incomplete tenant settings. Editing requires a complete detail response.',
      );
    }
    return t;
  }
}
