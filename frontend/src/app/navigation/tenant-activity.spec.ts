import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TenantActivity } from './tenant-activity';

const page = {
  data: [
    {
      id: 'event',
      action: 'activate',
      occurred_at: '2026-10-25T00:00:00Z',
      changed_fields: ['lifecycle_status'],
    },
  ],
  meta: { page: 1, per_page: 20, total_count: 21, total_pages: 2 },
};
describe('tenant activity', () => {
  let http: HttpTestingController;
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());
  function setup() {
    const fixture = TestBed.createComponent(TenantActivity);
    fixture.componentRef.setInput('tenantId', 'one');
    fixture.detectChanges();
    return fixture;
  }
  it('loads real event fields and paginates without inventing event identities', () => {
    const fixture = setup();
    expect(fixture.nativeElement.textContent).toContain('Loading tenant activity');
    http.expectOne((r) => r.url === '/api/v1/tenants/one/activity').flush(page);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Tenant activated');
    expect(fixture.nativeElement.textContent).toContain('Fields: Status');
    expect(fixture.nativeElement.querySelector('time').getAttribute('datetime')).toBe(
      '2026-10-25T00:00:00Z',
    );
    fixture.componentInstance.page(2);
    const next = http.expectOne((r) => r.url === '/api/v1/tenants/one/activity');
    expect(next.request.params.get('page')).toBe('2');
    next.flush({ ...page, meta: { ...page.meta, page: 2 } });
  });
  it('cancels the previous tenant request and clears its history when tenant input changes', () => {
    const fixture = setup();
    const old = http.expectOne((r) => r.url === '/api/v1/tenants/one/activity');
    fixture.componentRef.setInput('tenantId', 'two');
    fixture.detectChanges();
    expect(old.cancelled).toBe(true);
    expect(fixture.componentInstance.result()).toBeNull();
    http
      .expectOne((r) => r.url === '/api/v1/tenants/two/activity')
      .flush({ data: [], meta: { page: 1, per_page: 20, total_count: 0, total_pages: 0 } });
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('No recorded activity');
  });
  it('shows authorization failure without old events and retries on request', () => {
    const fixture = setup();
    http
      .expectOne((r) => r.url === '/api/v1/tenants/one/activity')
      .flush({}, { status: 404, statusText: 'Not found' });
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[role=alert]').textContent).toContain(
      'unavailable',
    );
    fixture.nativeElement.querySelector('button').click();
    http.expectOne((r) => r.url === '/api/v1/tenants/one/activity').flush(page);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[role=alert]')).toBeNull();
  });
});
