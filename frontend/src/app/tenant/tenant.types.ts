import { InjectionToken } from '@angular/core';
import { Observable } from 'rxjs';

export interface Contact {
  id?: string;
  name: string;
  email: string;
  phone?: string;
  primary: boolean;
  [key: string]: unknown;
}
export interface Branding {
  primary_colour: string;
  secondary_colour: string;
  typography: string;
  logo_attachment_id: string | null;
  favicon_attachment_id: string | null;
  [key: string]: unknown;
}
export interface Tenant {
  id?: string;
  company_name: string;
  display_name?: string;
  country?: string;
  time_zone?: string;
  user_limit?: number;
  primary_contact_role?: string;
  company_name_display: boolean;
  description: string;
  industry_id: string;
  responsible_admin_ids: string[];
  contacts: Contact[];
  branding: Branding;
  subscription: {
    pricing_mode?: string;
    pricing_conversion?: {
      converted?: boolean;
      source_fee?: string;
      source_currency?: string;
      rate_time?: string;
      rate?: string;
    } | null;
    currency: string;
    fee: string;
    payment_method: string;
    payment_method_description?: string;
    discount: { type: string; value: string; duration: string; [key: string]: unknown };
    [key: string]: unknown;
  };
  [key: string]: unknown;
}
export interface Choice {
  id: string;
  label: string;
  fontFamily?: string;
}
export interface PricingTier {
  currency: string;
  min_users: number;
  max_users: number;
  fee: string;
}
export interface FormOptions {
  pricingTiers?: PricingTier[];
  countryTimeZones?: Record<string, string[]>;
  countryCurrencies?: Record<string, string[]>;
  countries?: Choice[];
  timeZones?: Choice[];
  canManageIndustries?: boolean;
  // No fabricated reference lists. Supply approved values after contract review.
  industries: Choice[];
  currencies: Choice[];
  admins: Choice[];
  typography: Choice[];
  paymentMethods: Choice[];
  discountTypes: Choice[];
  contractApproved: boolean;
  assignment: 'one' | 'many' | null;
  discountDurationLabel: string | null;
  requiredFields: string[];
}
export const FORM_OPTIONS = new InjectionToken<FormOptions>('TENANT_FORM_OPTIONS', {
  providedIn: 'root',
  factory: () => ({
    industries: [],
    currencies: [],
    admins: [],
    typography: [],
    paymentMethods: [],
    discountTypes: [],
    contractApproved: false,
    assignment: null,
    discountDurationLabel: null,
    requiredFields: [],
  }),
});
export interface Asset {
  id: string;
  url?: string;
}
export type AssetKind = 'logo' | 'favicon';
export const ASSET_UPLOAD = new InjectionToken<
  ((kind: AssetKind, file: File, tenantId?: string) => Observable<Asset>) | null
>('TENANT_ASSET_UPLOAD', { providedIn: 'root', factory: () => null });
export const ASSET_URL = new InjectionToken<(id: string) => string | null>('TENANT_ASSET_URL', {
  providedIn: 'root',
  factory: () => () => null,
});
export function emptyTenant(): Tenant {
  return {
    company_name: '',
    company_name_display: false,
    description: '',
    industry_id: '',
    responsible_admin_ids: [],
    contacts: [{ name: '', email: '', primary: false }],
    branding: {
      primary_colour: '',
      secondary_colour: '',
      typography: '',
      logo_attachment_id: null,
      favicon_attachment_id: null,
    },
    subscription: {
      currency: '',
      fee: '',
      payment_method: '',
      discount: { type: '', value: '', duration: '' },
    },
  };
}
