import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { signal } from '@angular/core';
import { vi } from 'vitest';
import { TenantForm } from '../../tenant/tenant-form';
import { TenantGateway } from '../../tenant/tenant.gateway';
import { FORM_OPTIONS, emptyTenant } from '../../tenant/tenant.types';
import { approvedFormOptions } from '../../tenant/reference-data';
import { Session } from '../../navigation/session';
import { FactorVerification, MicrosoftSignIn } from '../../access/account-security';
import { TenantRetention } from './tenant-retention';

describe('Figma registration and account security', () => {
  afterEach(() => vi.restoreAllMocks());
  it('requires a primary contact before advancing and creates only after review', async () => {
    const options = {
      ...approvedFormOptions(),
      industries: [{ id: 'sector', label: 'Synthetic sector' }],
      currencies: [{ id: 'BTN', label: 'BTN' }],
      admins: [{ id: 'admin', label: 'Synthetic administrator' }],
      typography: [{ id: 'system', label: 'System font' }],
    };
    const gateway = { save: vi.fn((tenant: any) => of({ ...tenant, id: 'new-tenant' })) };
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: Session, useValue: { actor: signal({ id: 'super', role: 'super_admin' }) } },
        { provide: FORM_OPTIONS, useValue: options },
        { provide: TenantGateway, useValue: gateway },
        {
          provide: ActivatedRoute,
          useValue: { paramMap: of(convertToParamMap({})), fragment: of(null) },
        },
      ],
    });
    vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    const f = TestBed.createComponent(TenantForm);
    f.detectChanges();
    const form = f.componentInstance;
    form.advance();
    expect(form.step()).toBe(0);
    expect(gateway.save).not.toHaveBeenCalled();
    form.form.controls.fields.patchValue({
      company_name: 'Synthetic company', user_limit:'10',
      industry_id: 'sector',
      currency: 'BTN',
      fee: '0',
      display_name: 'Synthetic display',
      country: 'Bhutan',
      time_zone: 'Asia/Thimphu',
    });
    form.form.controls.admins.setValue(['admin']);
    form.contacts.at(0).patchValue({ name: 'Synthetic contact', email: 'contact@example.invalid' });
    form.choosePrimary(0);
    form.onFormSubmit();
    expect(form.step()).toBe(1);
    expect(gateway.save).not.toHaveBeenCalled();
    form.onFormSubmit();
    expect(form.step()).toBe(2);
    expect(gateway.save).not.toHaveBeenCalled();
    f.detectChanges();
    expect(f.nativeElement.textContent).toContain('Pricing summary');
    form.reviewEdit('Contacts');
    expect(form.step()).toBe(0);
    expect(form.contacts.at(0).controls.name.value).toBe('Synthetic contact');
    form.goStep(2);
    form.onFormSubmit();
    expect(gateway.save).toHaveBeenCalledTimes(1);
    expect(gateway.save.mock.calls[0][0].country).toBe('Bhutan');
    expect(gateway.save.mock.calls[0][0].workspace_identifier).toBeUndefined();
  });
  function setupHttp() {
    const platform = {
      actor: signal({ id: 'super', role: 'super_admin' }),
      token: signal<string | null>(null),
      refresh: vi.fn(() => of({ data: { id: 'super', role: 'super_admin' } })),
      clear: vi.fn(),
    };
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: Session, useValue: platform },
      ],
    });
    return { http: TestBed.inject(HttpTestingController), platform };
  }
  it('masks the enrollment key, clears failed codes and requires recovery-code acknowledgement', () => {
    const { http, platform } = setupHttp();
    const router = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
    const f = TestBed.createComponent(FactorVerification);
    http
      .expectOne('/api/v1/factor')
      .flush({
        data: {
          enrollment: true,
          setup_key: 'synthetic-setup-key',
          email: 'synthetic@example.invalid',
          account_scope: 'administrator',
        },
      });
    f.detectChanges();
    expect(f.nativeElement.querySelector('#setup-key').type).toBe('password');
    f.componentInstance.code = '000000';
    f.componentInstance.verify();
    http
      .expectOne('/api/v1/factor')
      .flush(
        { error: { message: 'Invalid authenticator code' } },
        { status: 422, statusText: 'Unprocessable' },
      );
    expect(f.componentInstance.code).toBe('');
    expect(f.componentInstance.error()).toContain('Invalid');
    expect(router).not.toHaveBeenCalled();
    f.componentInstance.code = '123456';
    f.componentInstance.verify();
    http
      .expectOne('/api/v1/factor')
      .flush({
        data: { account_scope: 'administrator' },
        recovery_codes: ['synthetic-recovery'],
        csrf_token: 'new-csrf',
      });
    f.detectChanges();
    expect(f.componentInstance.state()).toBeNull();
    expect(platform.token()).toBe('new-csrf');
    f.componentInstance.continue();
    expect(router).not.toHaveBeenCalled();
    f.componentInstance.savedCodes = true;
    f.componentInstance.continue();
    expect(router).toHaveBeenCalledWith('/tenants');
    expect(f.componentInstance.recoveryCodes()).toEqual([]);
    http.verify();
  });
  it('cancels a pending enrollment response when leaving the security page', () => {
    const { http } = setupHttp();
    const f = TestBed.createComponent(FactorVerification);
    const request = http.expectOne('/api/v1/factor');
    f.destroy();
    expect(request.cancelled).toBe(true);
    http.verify();
  });
  it('keeps Microsoft unavailable without configuration and never simulates sign in', () => {
    const { http } = setupHttp();
    const f = TestBed.createComponent(MicrosoftSignIn);
    http.expectOne('/api/v1/microsoft/status').flush({ data: { configured: false } });
    f.detectChanges();
    expect(f.nativeElement.textContent).toContain('has not enabled Microsoft');
    f.componentInstance.start();
    http.expectNone((r) => r.method === 'POST');
    http.verify();
  });
  it('honors server deletion blockers and cancels stale retention requests on tenant changes', () => {
    const { http } = setupHttp();
    const f = TestBed.createComponent(TenantRetention);
    f.componentRef.setInput('tenantId', 'one');
    f.componentRef.setInput('company', 'Synthetic company');
    f.detectChanges();
    http
      .expectOne('/api/v1/tenants/one/retention')
      .flush({
        data: {
          eligible: false,
          eligible_at: null,
          archived_at: null,
          retention_days: 90,
          blocking_reasons: ['Legal hold status is unknown'],
          clearances: { legal_hold: null },
        },
      });
    f.detectChanges();
    expect(f.nativeElement.textContent).toContain('Legal hold status is unknown');
    f.componentInstance.open();
    expect(f.componentInstance.confirming()).toBe(false);
    f.componentInstance.password = 'synthetic-password';
    f.componentInstance.confirmation = 'Synthetic company';
    f.componentInstance.remove();
    http.expectNone((r) => r.method === 'DELETE');
    f.componentInstance.load();
    const old = http.expectOne('/api/v1/tenants/one/retention');
    f.componentRef.setInput('tenantId', 'two');
    f.detectChanges();
    expect(old.cancelled).toBe(true);
    expect(f.componentInstance.password).toBe('');
    http
      .expectOne('/api/v1/tenants/two/retention')
      .flush({
        data: {
          eligible: false,
          eligible_at: null,
          archived_at: null,
          retention_days: 90,
          blocking_reasons: ['Not archived'],
          clearances: {},
        },
      });
    http.verify();
  });
  it('does not abort a retention review when its busy state changes', () => {
    const { http } = setupHttp();
    const f = TestBed.createComponent(TenantRetention);
    f.componentRef.setInput('tenantId', 'one');
    f.componentRef.setInput('company', 'Synthetic company');
    f.detectChanges();
    const report = {
      eligible: false,
      eligible_at: null,
      archived_at: null,
      retention_days: 90,
      blocking_reasons: ['Not archived'],
      clearances: { legal_hold: false },
    };
    http.expectOne('/api/v1/tenants/one/retention').flush({ data: report });
    f.detectChanges();
    f.componentInstance.note = 'Reviewed synthetic records';
    f.componentInstance.save();
    f.detectChanges();
    const request = http.expectOne('/api/v1/tenants/one/retention');
    expect(request.cancelled).toBe(false);
    expect(request.request.method).toBe('PATCH');
    request.flush({ data: report });
    expect(f.componentInstance.message()).toContain('recorded');
    http.verify();
  });
});
