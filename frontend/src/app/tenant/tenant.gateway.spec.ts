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
    api.save(emptyTenant(), 'id/with spaces').subscribe();
    const request = http.expectOne('/api/v1/tenants/id%2Fwith%20spaces');
    expect(request.request.method).toBe('PATCH');
    request.flush({ data: { ...emptyTenant(), id: 'id/with spaces' } });
  });
  it('rejects partial detail data rather than blanking saved values', () => {
    let message = '';
    api.load('one').subscribe({ error: (e) => (message = e.message) });
    http.expectOne('/api/v1/tenants/one').flush({ data: { id: 'one', company_name: 'Partial' } });
    expect(message).toContain('incomplete tenant settings');
  });
});
