import { Injectable, InjectionToken, inject, signal } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';

export interface DirectoryTenant {
  id: string;
  created_at?: string;
  user_count?: number;
  permitted_actions?: string[];
  company_name: string | null;
  display_name?: string|null;
  country?: string|null;
  time_zone?: string|null;
  company_name_display: boolean | null;
  description: string | null;
  industry_id: string | null;
  lifecycle_status: string | null;
  provisioning_status: string;
  responsible_admin_ids: string[];
  contacts: {
    id: string;
    name: string | null;
    email: string | null;
    phone?: string | null;
    primary: boolean;
  }[];
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
  summary?: {total:number;active:number;inactive:number;suspended:number;industries:number};
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
          (
            {
              activate:
                'Enable this tenant workspace once required setup is complete. Subscription charges are unchanged.',
              deactivate:
                'Block tenant-user access until the workspace is activated again. Company records and subscription settings are retained.',
              suspend:
                'Administratively block tenant-user access. A Super Admin must return the tenant to Inactive before activating it again. Records are retained.',
              reactivate:
                'Return this tenant to Inactive. Tenant-user access remains blocked. Activation is a separate step.',
              archive:
                'Retire this tenant and block tenant-user access. Company records, branding, audit history and the tenant schema are retained. You can restore it to Inactive.',
              restore:
                'Restore this tenant to Inactive with its retained records. Activation is a separate step.',
            } as Record<string, string>
          )[code] || 'Confirm this tenant status change? Subscription charges are unchanged.',
      })),
  }),
});
@Injectable({ providedIn: 'root' })
export class TenantDirectory {
  private http = inject(HttpClient);
  readonly view = signal({ query: '', status: '', industry: '', page: 1, perPage: 20 });
  list(query: string, status: string, page: number, perPage = 20, industry = '') {
    let params = new HttpParams().set('page', page).set('per_page', perPage);
    if (query) params = params.set('q', query);
    if (status) params = params.set('status', status);
    if (industry) params = params.set('industry', industry);
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
