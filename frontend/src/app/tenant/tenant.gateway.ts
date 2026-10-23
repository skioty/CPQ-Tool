import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { map, throwError } from 'rxjs';
import { Tenant } from './tenant.types';

// Proposed contract adapter only. No mock backend or local simulated persistence.
@Injectable({ providedIn: 'root' })
export class TenantGateway {
  private readonly http = inject(HttpClient);
  private readonly originals = new Map<string, Tenant>();
  private readonly etags = new Map<string, string>();
  private path(id: string) {
    return `/api/v1/tenants/${encodeURIComponent(id)}`;
  }
  load(id: string) {
    return this.http.get<{ data: Tenant }>(this.path(id), { observe: 'response' }).pipe(
      map((r) => {
        const t = this.complete(r.body!.data);
        const etag = r.headers.get('ETag');
        if (etag) this.etags.set(id, etag);
        return t;
      }),
    );
  }
  save(value: Tenant, id?: string) {
    if (id && !this.etags.has(id))
      return throwError(
        () => new Error('Reload tenant details before editing; a saved version is required.'),
      );
    const cleaned = structuredClone(value) as Tenant;
    if (cleaned.description === '') (cleaned as Record<string, unknown>)['description'] = null;
    if (cleaned.subscription) {
      if (!cleaned.subscription.payment_method_description)
        (cleaned.subscription as Record<string, unknown>)['payment_method_description'] = null;
      if (cleaned.subscription.discount?.value === '0' && !cleaned.subscription.discount.duration)
        (cleaned.subscription.discount as Record<string, unknown>)['duration'] = null;
    }
    const body = { tenant: id ? this.preserveNulls(this.originals.get(id), cleaned) : cleaned };
    return (
      id
        ? this.http.patch<{ data: Tenant }>(this.path(id), body, {
            observe: 'response',
            headers: { 'If-Match': this.etags.get(id)! },
          })
        : this.http.post<{ data: Tenant }>('/api/v1/tenants', body, { observe: 'response' })
    ).pipe(
      map((r) => {
        const t = this.complete(r.body!.data);
        const etag = r.headers.get('ETag');
        if (t.id && etag) this.etags.set(t.id, etag);
        return t;
      }),
    );
  }
  private preserveNulls(original: unknown, value: unknown): unknown {
    if (original === null && (value === '' || value === false)) return null;
    if (Array.isArray(value))
      return value.map((item) =>
        this.preserveNulls(
          Array.isArray(original)
            ? original.find((old) => old?.id && old.id === item?.id)
            : undefined,
          item,
        ),
      );
    if (value && typeof value === 'object')
      return Object.fromEntries(
        Object.entries(value).map(([key, item]) => [
          key,
          this.preserveNulls((original as Record<string, unknown> | undefined)?.[key], item),
        ]),
      );
    return value;
  }
  private complete(t: Tenant): Tenant {
    const raw = structuredClone(t);
    t = structuredClone(t);
    if (t && typeof t === 'object') {
      for (const key of ['company_name', 'description', 'industry_id'])
        if (t[key] === null) t[key] = '';
      if (t.company_name_display === null) t.company_name_display = false;
      if (Array.isArray(t.contacts))
        t.contacts.forEach((c) => {
          if (c?.name === null) c.name = '';
          if (c?.email === null) c.email = '';
        });
      if (t.branding)
        for (const key of ['primary_colour', 'secondary_colour', 'typography'])
          if (t.branding[key] === null) t.branding[key] = '';
      if (t.subscription) {
        for (const key of ['currency', 'fee', 'payment_method'])
          if (t.subscription[key] === null) t.subscription[key] = '';
        if (t.subscription.discount)
          for (const key of ['type', 'value', 'duration'])
            if (t.subscription.discount[key] === null) t.subscription.discount[key] = '';
      }
    }
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
      throw new Error('Some tenant settings could not be loaded. Reload this page before editing.');
    }
    this.originals.set(t.id!, raw);
    return t;
  }
}
