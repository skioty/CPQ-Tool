import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { catchError, of, tap } from 'rxjs';
import { FORM_OPTIONS, FormOptions } from './tenant.types';
export const approvedFormOptions = (): FormOptions => ({
  industries: [],
  admins: [],
  currencies: [],
  typography: [],
  paymentMethods: [],
  discountTypes: [{ id: 'percentage', label: 'Percentage' }],
  contractApproved: true,
  assignment: 'one',
  discountDurationLabel: 'Discount duration (monthly cycles)',
  requiredFields: [
    'company_name',
    'industry_id',
    'subscription.currency',
    'subscription.fee',
    'responsible_admin_ids',
    'contacts.name',
    'contacts.email',
  ],
});
export interface ReferenceOption {
  id: string;
  kind: string;
  code: string;
  label: string;
  enabled: boolean;
}
export interface ReferenceResponse {
  data: ReferenceOption[];
  admins: { id: string; label: string }[];
  typography: { id: string; label: string; fontFamily: string }[];
  countries?: { id: string; label: string }[];
  time_zones?: { id: string; label: string }[];
  can_manage_industries?: boolean;
}
@Injectable({ providedIn: 'root' })
export class ReferenceData {
  private http = inject(HttpClient);
  private options = inject(FORM_OPTIONS);
  load() {
    return this.http.get<ReferenceResponse>('/api/v1/reference_options').pipe(
      tap((r) => {
        const choices = (kind: string) =>
          r.data.filter((o) => o.kind === kind).map((o) => ({ id: o.code, label: o.label }));
        Object.assign(this.options, {
          industries: choices('industry'),
          currencies: choices('currency'),
          paymentMethods: choices('payment_method'),
          admins: r.admins,
          typography: r.typography,
          countries: r.countries || [],
          timeZones: r.time_zones || [],
          canManageIndustries: r.can_manage_industries === true,
        });
      }),
    );
  }
}
export const loadReferences = () => {
  const router = inject(Router);
  return inject(ReferenceData)
    .load()
    .pipe(
      catchError((e) => {
        if (e.status === 401) {
          void router.navigateByUrl('/login');
          return of(null);
        }
        // Keep the form available with explicit missing reference options; writes still validate on server.
        return of(null);
      }),
    );
};
