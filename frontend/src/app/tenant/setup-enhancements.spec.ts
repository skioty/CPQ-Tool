import { TestBed } from '@angular/core/testing';
import { FormControl } from '@angular/forms';
import { SearchChoice } from './search-choice';
import { TenantForm } from './tenant-form';
import { TenantGateway } from './tenant.gateway';
import { FORM_OPTIONS, emptyTenant } from './tenant.types';
import { approvedFormOptions } from './reference-data';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { signal } from '@angular/core';
import { vi } from 'vitest';
import { Session } from '../navigation/session';
import { CreationNotice } from '../navigation/creation-notice';

it('searches country/time-zone labels and selects with the keyboard using stable IDs', () => {
  const f = TestBed.createComponent(SearchChoice);
  const control = new FormControl('', { nonNullable: true });
  f.componentRef.setInput('id', 'zone');
  f.componentRef.setInput('control', control);
  f.componentRef.setInput('choices', [
    { id: 'Asia/Thimphu', label: 'Asia/Thimphu (UTC+06:00)' },
    { id: 'Europe/London', label: 'Europe/London (UTC+00:00)' },
  ]);
  f.detectChanges();
  const input = f.nativeElement.querySelector('input') as HTMLInputElement;
  input.dispatchEvent(new FocusEvent('focus'));
  input.value = 'thim';
  input.dispatchEvent(new Event('input'));
  f.detectChanges();
  expect(f.nativeElement.querySelectorAll('[role=option]').length).toBe(1);
  input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  f.detectChanges();
  expect(control.value).toBe('Asia/Thimphu');
  expect(input.value).toContain('UTC+06:00');
  expect(input.getAttribute('aria-expanded')).toBe('false');
});

async function formFixture() {
  const options = {
    ...approvedFormOptions(),
    canManageIndustries: true,
    industries: [{ id: 'services', label: 'Services' }],
    countries: [{ id: 'BT', label: 'Bhutan' }],
    timeZones: [{ id: 'Asia/Thimphu', label: 'Asia/Thimphu (UTC+06:00)' }],
    admins: [{ id: 'owner', label: 'Owner' }],
    currencies: [{ id: 'BTN', label: 'BTN' }],
    typography: [{ id: 'system', label: 'System' }],
  };
  const gateway = { save: vi.fn((t: any) => of({ ...t, id: 'created' })) };
  TestBed.configureTestingModule({
    providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
      provideRouter([]),
      { provide: FORM_OPTIONS, useValue: options },
      { provide: TenantGateway, useValue: gateway },
      { provide: Session, useValue: { actor: signal({ role: 'super_admin' }) } },
      {
        provide: ActivatedRoute,
        useValue: { paramMap: of(convertToParamMap({})), fragment: of(null) },
      },
    ],
  });
  const router = TestBed.inject(Router);
  vi.spyOn(router, 'navigate').mockResolvedValue(true);
  TestBed.inject(CreationNotice).consume();
  const f = TestBed.createComponent(TenantForm);
  f.detectChanges();
  const form = f.componentInstance;
  form.form.controls.fields.patchValue({
    company_name: 'New company',
    industry_id: 'services',
    user_limit: '2',
    country: 'BT',
    time_zone: 'Asia/Thimphu',
    currency: 'BTN',
    fee: '0',
  });
  form.form.controls.admins.setValue(['owner']);
  form.contacts.at(0).patchValue({ name: 'Primary', email: 'primary@example.invalid' });
  form.choosePrimary(0);
  return { f, form, gateway, router, http: TestBed.inject(HttpTestingController) };
}

it('renders every country and time-zone option without truncating the list and supports the final option by keyboard', () => {
  const fixture = TestBed.createComponent(SearchChoice);
  const control = new FormControl('', { nonNullable: true });
  const choices = Array.from({ length: 600 }, (_, i) => ({
    id: 'zone-' + i,
    label: 'Time zone ' + i,
  }));
  fixture.componentRef.setInput('id', 'all-zones');
  fixture.componentRef.setInput('control', control);
  fixture.componentRef.setInput('choices', choices);
  fixture.detectChanges();
  const input = fixture.nativeElement.querySelector('input') as HTMLInputElement;
  input.dispatchEvent(new FocusEvent('focus'));
  fixture.detectChanges();
  expect(fixture.nativeElement.querySelectorAll('[role=option]').length).toBe(600);
  input.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true }));
  input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  fixture.detectChanges();
  expect(control.value).toBe('zone-599');
});
it('creates a trimmed custom industry then saves its code and redirects with a durable success notice', async () => {
  const { form, gateway, router, http } = await formFixture();
  form.form.controls.fields.controls['industry_id'].setValue('__create_industry__');
  form.customIndustryName.setValue('  Aerospace  ');
  form.submit();
  const req = http.expectOne('/api/v1/reference_options');
  expect(req.request.body.option.label).toBe('Aerospace');
  expect(gateway.save).not.toHaveBeenCalled();
  req.flush({ data: { code: 'custom_aerospace', label: 'Aerospace' } });
  const saved = gateway.save.mock.calls[0][0];
  expect(saved.industry_id).toBe('custom_aerospace');
  expect(saved.user_limit).toBe(2);
  expect(saved.primary_contact_role).toBe('tenant_admin');
  expect(saved.country).toBe('BT');
  expect(saved.time_zone).toBe('Asia/Thimphu');
  expect(router.navigate).toHaveBeenCalledWith(['/tenants'], { replaceUrl: true });
  expect(TestBed.inject(CreationNotice).consume()).toBe(true);
  expect(TestBed.inject(CreationNotice).consume()).toBe(false);
  http.verify();
});
it('rejects duplicate names and invalid limits and preserves inputs on a failed save', async () => {
  const { form, gateway, router } = await formFixture();
  form.form.controls.fields.controls['industry_id'].setValue('__create_industry__');
  form.customIndustryName.setValue(' SERVICES ');
  form.submit();
  expect(gateway.save).not.toHaveBeenCalled();
  expect(form.customIndustryName.hasError('duplicate')).toBe(true);
  form.form.controls.fields.controls['industry_id'].setValue('services');
  for (const limit of ['', '0', '-1', '1.5']) {
    form.form.controls.fields.controls['user_limit'].setValue(limit);
    form.submit();
    expect(gateway.save).not.toHaveBeenCalled();
  }
  form.form.controls.fields.controls['user_limit'].setValue('2');
  gateway.save.mockReturnValue(throwError(() => new Error('Service unavailable')));
  form.submit();
  expect(form.form.controls.fields.controls['company_name'].value).toBe('New company');
  expect(form.contacts.at(0).controls.email.value).toBe('primary@example.invalid');
  expect(form.status()).toBe('failed');
  expect(router.navigate).not.toHaveBeenCalled();
  expect(form.choices('primary_contact_role')).toEqual([
    { id: 'tenant_admin', label: 'Tenant Admin' },
  ]);
});

it('uses a regular industry select without removal controls in tenant setup', async () => {
  const { f } = await formFixture();
  f.detectChanges();
  expect(f.nativeElement.querySelector('select#industry_id')).toBeTruthy();
  expect(f.nativeElement.querySelector('app-industry-picker')).toBeNull();
  expect(f.nativeElement.querySelector('.industry-actions').textContent).not.toContain('Delete');
});
it('creates and selects an industry through its button without submitting the tenant', async () => {
  const { form, http, gateway } = await formFixture();
  form.createIndustry();
  expect(form.creatingIndustry).toBe(true);
  form.customIndustryName.setValue('  Aviation  ');
  form.createIndustry();
  const request = http.expectOne('/api/v1/reference_options');
  expect(request.request.body.option.label).toBe('Aviation');
  request.flush({ data: { code: 'custom_aviation', label: 'Aviation' } });
  expect(form.form.controls.fields.controls['industry_id'].value).toBe('custom_aviation');
  expect(form.industryBusy()).toBe(false);
  expect(gateway.save).not.toHaveBeenCalled();
  http.verify();
});

it('selects a sole country zone and restricts multi-zone choices without overwriting saved edits', async () => {
  const { form } = await formFixture();
  form.options.countryTimeZones = {
    BT: ['Asia/Thimphu'],
    US: ['America/New_York', 'America/Chicago'],
  };
  form.options.timeZones = [
    ...form.options.timeZones!,
    { id: 'America/New_York', label: 'New York' },
    { id: 'America/Chicago', label: 'Chicago' },
  ];
  const c = form.form.controls.fields.controls;
  c['country'].setValue('BT');
  expect(c['time_zone'].value).toBe('Asia/Thimphu');
  c['country'].setValue('US');
  expect(c['time_zone'].value).toBe('');
  expect(form.choices('time_zone').map((z) => z.id)).toEqual([
    'America/New_York',
    'America/Chicago',
  ]);
  const saved = { ...form.draft(), country: 'US', time_zone: 'America/Chicago' };
  form.patch(saved);
  expect(c['time_zone'].value).toBe('America/Chicago');
});
it('previews automatic tiers, preserves a negotiated custom fee and reports missing tiers', async () => {
  const { form } = await formFixture();
  form.options.pricingTiers = [
    { currency: 'BTN', min_users: 1, max_users: 25, fee: '100.00' },
    { currency: 'BTN', min_users: 26, max_users: 50, fee: '180.00' },
  ];
  const c = form.form.controls.fields.controls;
  c['fee'].setValue('321.45');
  c['user_limit'].setValue('30');
  expect(c['fee'].value).toBe('321.45');
  c['pricing_mode'].setValue('automatic');
  expect(c['fee'].value).toBe('180.00');
  c['user_limit'].setValue('25');
  expect(c['fee'].value).toBe('100.00');
  c['discount_value'].setValue('10');
  expect(form.discountedFee()).toBe('90.00');
  c['user_limit'].setValue('51');
  expect(c['fee'].value).toBe('');
  expect(form.pricingMessage()).toContain('No automatic price is configured');
  c['pricing_mode'].setValue('custom');
  expect(c['fee'].value).toBe('321.45');
});

it('shows missing automatic configuration rather than a required editable fee, and refreshes the 50-user boundary without losing inputs', async () => {
  const { f, form, http, gateway } = await formFixture();
  const c = form.form.controls.fields.controls;
  c['user_limit'].setValue('50');
  c['pricing_mode'].setValue('automatic');
  form.step.set(1);
  form.form.markAllAsTouched();
  f.detectChanges();
  expect(f.nativeElement.querySelector('input#fee')).toBeNull();
  expect(f.nativeElement.querySelector('#calculated-fee').textContent).toContain('Not configured');
  expect(f.nativeElement.textContent).not.toContain('Subscription fee is required.');
  expect(f.nativeElement.textContent).not.toContain('After discount: Not available');
  expect(form.pricingMessage()).toContain('50 users in BTN');
  form.submit();
  expect(gateway.save).not.toHaveBeenCalled();
  expect(form.errors().join(' ')).toContain('Configure a tier');
  form.reloadPricing();
  http
    .expectOne('/api/v1/reference_options')
    .flush({ pricing_tiers: [{ currency: 'BTN', min_users: 26, max_users: 50, fee: '4500.00' }] });
  f.detectChanges();
  expect(c['fee'].value).toBe('4500.00');
  expect(f.nativeElement.querySelector('#calculated-fee').textContent).toContain(
    '4500.00 BTN / month',
  );
  c['discount_value'].setValue('15');
  c['discount_duration'].setValue('3');
  expect(form.discountedFee()).toBe('3825.00');
  expect(form.errors()).toEqual([]);
  expect(c['company_name'].value).toBe('New company');
  expect(c['user_limit'].value).toBe('50');
  c['pricing_mode'].setValue('custom');
  f.detectChanges();
  expect(f.nativeElement.querySelector('input#fee')).toBeTruthy();
  expect(c['fee'].value).toBe('0');
  http.verify();
});
it('retains the tenant draft and explains a failed pricing refresh', async () => {
  const { form, http } = await formFixture();
  form.reloadPricing();
  http.expectOne('/api/v1/reference_options').flush({}, { status: 503, statusText: 'Unavailable' });
  expect(form.pricingLoading()).toBe(false);
  expect(form.pricingLoadError()).toContain('Your tenant details are retained');
  expect(form.form.controls.fields.controls['company_name'].value).toBe('New company');
  http.verify();
});

it('defaults currency from country, converts the automatic BTN tier, and ignores older quotes', async () => {
  const { form, http } = await formFixture();
  form.options.countryCurrencies = { BT: ['BTN', 'INR'], US: ['USD'], DE: ['EUR'] };
  form.options.currencies = [
    { id: 'BTN', label: 'BTN' },
    { id: 'USD', label: 'USD' },
    { id: 'EUR', label: 'EUR' },
  ];
  form.options.pricingTiers = [{ currency: 'BTN', min_users: 26, max_users: 50, fee: '4500.00' }];
  const c = form.form.controls.fields.controls;
  c['user_limit'].setValue('50');
  c['pricing_mode'].setValue('automatic');
  c['country'].setValue('US');
  expect(c['currency'].value).toBe('USD');
  const older = http.expectOne(
    (r) => r.url === '/api/v1/subscription_quote' && r.params.get('currency') === 'USD',
  );
  c['country'].setValue('DE');
  expect(older.cancelled).toBe(true);
  http
    .expectOne((r) => r.url === '/api/v1/subscription_quote' && r.params.get('currency') === 'EUR')
    .flush({
      data: {
        fee: '45.00',
        currency: 'EUR',
        converted: true,
        source_fee: '4500.00',
        source_currency: 'BTN',
        rate: '0.01',
        rate_time: '2026-10-28T00:00:00Z',
      },
    });
  expect(c['fee'].value).toBe('45.00');
  expect(form.pricingLoading()).toBe(false);
  expect(form.conversionNote()).toContain('2026-10-28');
  c['discount_value'].setValue('15');
  expect(form.discountedFee()).toBe('38.25');
  c['time_zone'].setValue('Europe/Berlin');
  expect(c['currency'].value).toBe('EUR');
  c['country'].setValue('BT');
  expect(c['currency'].value).toBe('BTN');
  expect(c['fee'].value).toBe('4500.00');
  http.verify();
});
it('converts a negotiated Custom fee on currency change but preserves it on capacity changes and loading', async () => {
  const { form, http } = await formFixture();
  const c = form.form.controls.fields.controls;
  c['fee'].setValue('4500');
  c['currency'].setValue('USD');
  const request = http.expectOne(
    (r) => r.url === '/api/v1/subscription_quote' && r.params.get('source_currency') === 'BTN',
  );
  expect(request.request.params.get('amount')).toBe('4500');
  request.flush({
    data: {
      fee: '50.00',
      currency: 'USD',
      converted: true,
      source_fee: '4500',
      source_currency: 'BTN',
      rate: '0.011111111',
      rate_time: '2026-10-28T00:00:00Z',
    },
  });
  c['user_limit'].setValue('100');
  expect(c['fee'].value).toBe('50.00');
  expect(form.conversionNote()).toContain('2026-10-28');
  form.patch(form.draft());
  expect(c['currency'].value).toBe('USD');
  expect(c['fee'].value).toBe('50.00');
  http.expectNone('/api/v1/subscription_quote');
  http.verify();
});
