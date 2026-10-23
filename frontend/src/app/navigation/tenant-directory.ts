import { Injectable, InjectionToken, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';

export interface DirectoryTenant {
  id: string;
  permitted_actions?: string[];
  company_name: string | null;
  company_name_display: boolean | null;
  description: string | null;
  industry_id: string | null;
  lifecycle_status: string | null;
  provisioning_status: string;
  responsible_admin_ids: string[];
  contacts: { id: string; name: string | null; email: string | null; primary: boolean }[];
  branding: Record<string, string | null>;
  subscription: {
    currency: string | null;
    fee: string | null;
    payment_method: string | null;
    payment_method_description?: string | null;
    discount: { type: string | null; value: string | null; duration: string | null };
  };
}
export interface TenantPage {
  data: DirectoryTenant[];
  meta: { page: number; per_page: number; total_count: number; total_pages: number };
}
export interface LifecycleAction {
  code: string;
  label: string;
  confirmation: string;
}
// Display only capabilities returned by the backend for this tenant.
export const DIRECTORY_POLICY = new InjectionToken<{
  statuses: { value: string; label: string }[];
  actions: (tenant: DirectoryTenant) => LifecycleAction[];
}>('DIRECTORY_POLICY', {
  providedIn: 'root',
  factory: () => ({
    statuses: ['inactive', 'active', 'suspended', 'archived'].map((value) => ({
      value,
      label: value[0].toUpperCase() + value.slice(1),
    })),
    actions: (tenant) =>
      (tenant.permitted_actions || []).map((code) => ({
        code,
        label:
          (
            {
              activate: 'Activate',
              deactivate: 'Deactivate',
              suspend: 'Suspend',
              reactivate: 'Return to inactive',
              archive: 'Archive',
              restore: 'Restore to inactive',
            } as Record<string, string>
          )[code] || code,
        confirmation:
          code === 'archive'
            ? 'Archive this tenant? Company records and workspace data will be retained. Tenant users will no longer have access.'
            : code === 'restore' || code === 'reactivate'
              ? 'Return this tenant to inactive? Activation is a separate step.'
              : `Confirm ${code}? Status changes do not automatically change subscription charges.`,
      })),
  }),
});
@Injectable({ providedIn: 'root' })
export class TenantDirectory {
  private http = inject(HttpClient);
  list(query: string, status: string, page: number) {
    let params = new HttpParams().set('page', page).set('per_page', 20);
    if (query) params = params.set('q', query);
    if (status) params = params.set('status', status);
    return this.http.get<TenantPage>('/api/v1/tenants', { params });
  }
  detail(id: string) {
    return this.http.get<{ data: DirectoryTenant }>(`/api/v1/tenants/${encodeURIComponent(id)}`);
  }
  lifecycle(id: string, action: string) {
    return this.http.post(`/api/v1/tenants/${encodeURIComponent(id)}/lifecycle`, { action });
  }
}
export function apiMessage(error: { status?: number }) {
  return (
    (
      {
        401: 'Administrator login is required.',
        403: 'You do not have permission for this action.',
        404: 'Tenant not found or unavailable to your account.',
        409: 'Tenant changed. Refresh before trying again.',
        503: 'This action is temporarily unavailable. Try again or contact your platform administrator.',
      } as Record<number, string>
    )[error.status || 0] || 'The request failed. Check your connection and retry.'
  );
}
