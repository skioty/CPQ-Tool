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

it('keeps create and delete industry actions visible and removes a successful deletion from the selector', async () => {
  const { f, form, http } = await formFixture();
  f.detectChanges();
  const actions = f.nativeElement.querySelector('.industry-actions');
  expect(actions.textContent).toContain('Create industry');
  expect(actions.textContent).toContain('Delete industry');
  form.confirmIndustryDeletion();
  expect(form.industryToDelete()?.label).toBe('Services');
  form.deleteIndustry();
  http
    .expectOne('/api/v1/reference_options')
    .flush({ data: [{ id: 'industry-record', kind: 'industry', code: 'services' }] });
  const request = http.expectOne('/api/v1/reference_options/industry-record');
  expect(request.request.method).toBe('DELETE');
  request.flush(null);
  expect(form.options.industries).toEqual([]);
  expect(form.form.controls.fields.controls['industry_id'].value).toBe('');
  f.detectChanges();
  expect(f.nativeElement.querySelector('.industry-actions').textContent).toContain(
    'Delete industry',
  );
  http.verify();
});
it('retains industry choices and the draft when the backend blocks deletion of a referenced industry', async () => {
  const { form, http } = await formFixture();
  form.confirmIndustryDeletion();
  form.deleteIndustry();
  http
    .expectOne('/api/v1/reference_options')
    .flush({ data: [{ id: 'industry-record', kind: 'industry', code: 'services' }] });
  http
    .expectOne('/api/v1/reference_options/industry-record')
    .flush(
      { error: { message: 'Industry is referenced by a tenant. Deactivate it instead.' } },
      { status: 409, statusText: 'Conflict' },
    );
  expect(form.form.controls.fields.controls['industry_id'].value).toBe('services');
  expect(form.options.industries.length).toBe(1);
  expect(form.industryMessage()).toContain('Deactivate');
  expect(form.form.controls.fields.controls['company_name'].value).toBe('New company');
  http.verify();
});

it('creates and selects an industry through its button without submitting the tenant', async () => {
  const {form,http,gateway}=await formFixture();
  form.createIndustry();
  expect(form.creatingIndustry).toBe(true);
  form.customIndustryName.setValue('  Aviation  ');
  form.createIndustry();
  const request=http.expectOne('/api/v1/reference_options');
  expect(request.request.body.option.label).toBe('Aviation');
  request.flush({data:{code:'custom_aviation',label:'Aviation'}});
  expect(form.form.controls.fields.controls['industry_id'].value).toBe('custom_aviation');
  expect(form.industryBusy()).toBe(false);
  expect(gateway.save).not.toHaveBeenCalled();
  http.verify();
});
