import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TenantGateway } from './tenant.gateway';
import { emptyTenant } from './tenant.types';

describe('proposed tenant HTTP adapter', () => {
  let api: TenantGateway;
  let http: HttpTestingController;
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    api = TestBed.inject(TenantGateway);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());
  it('wraps create payload and emits only a complete saved response', () => {
    const tenant = { ...emptyTenant(), id: 'new-1' };
    let result;
    api.save(emptyTenant()).subscribe((t) => (result = t));
    const request = http.expectOne('/api/v1/tenants');
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({ tenant: emptyTenant() });
    request.flush({ data: tenant });
    expect(result).toEqual(tenant);
  });
  it('uses the tenant identifier and PATCH when editing', () => {
    api.load('id/with spaces').subscribe();
    http
      .expectOne('/api/v1/tenants/id%2Fwith%20spaces')
      .flush({ data: { ...emptyTenant(), id: 'id/with spaces' } }, { headers: { ETag: '"3"' } });
    api.save(emptyTenant(), 'id/with spaces').subscribe();
    const request = http.expectOne('/api/v1/tenants/id%2Fwith%20spaces');
    expect(request.request.method).toBe('PATCH');
    expect(request.request.headers.get('If-Match')).toBe('"3"');
    request.flush({ data: { ...emptyTenant(), id: 'id/with spaces' } });
  });
  it('normalizes nullable fields for display but preserves unchanged nulls in edits', () => {
    const raw = {
      ...emptyTenant(),
      id: 'nullable',
      company_name: null,
      company_name_display: null,
      description: null,
    };
    let loaded = emptyTenant();
    api.load('nullable').subscribe((t) => (loaded = t));
    http.expectOne('/api/v1/tenants/nullable').flush({ data: raw }, { headers: { ETag: '"1"' } });
    expect(loaded.company_name).toBe('');
    api.save(loaded, 'nullable').subscribe();
    const request = http.expectOne('/api/v1/tenants/nullable');
    expect(request.request.body.tenant.description).toBeNull();
    expect(request.request.body.tenant.company_name_display).toBeNull();
    request.flush({ data: raw });
  });
  it('rejects partial detail data rather than blanking saved values', () => {
    let message = '';
    api.load('one').subscribe({ error: (e) => (message = e.message) });
    http.expectOne('/api/v1/tenants/one').flush({ data: { id: 'one', company_name: 'Partial' } });
    expect(message).toContain('incomplete tenant settings');
  });
});
