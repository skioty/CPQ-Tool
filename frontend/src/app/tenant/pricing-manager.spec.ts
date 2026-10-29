import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { PricingManager } from './pricing-manager';
it('loads saved tiers and saves explicit fees with the current configuration version', () => {
  TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
  const fixture = TestBed.createComponent(PricingManager),
    http = TestBed.inject(HttpTestingController);
  http
    .expectOne('/api/v1/reference_options')
    .flush({ data: [{ id: 'c', kind: 'currency', code: 'BTN', label: 'BTN', enabled: true }] });
  http.expectOne('/api/v1/subscription_pricing').flush({ data: { tiers: [], lock_version: 4 } });
  fixture.detectChanges();
  expect(fixture.nativeElement.textContent).toContain('No automatic pricing tiers configured');
  fixture.componentInstance.add();
  expect(fixture.componentInstance.tiers[0].fee).toBe('');
  fixture.componentInstance.tiers[0] = {
    currency: 'BTN',
    min_users: 1,
    max_users: 25,
    fee: '123.45',
  };
  fixture.componentInstance.save();
  const req = http.expectOne('/api/v1/subscription_pricing');
  expect(req.request.method).toBe('PATCH');
  expect(req.request.body.pricing.lock_version).toBe(4);
  expect(req.request.body.pricing.tiers[0].fee).toBe('123.45');
  req.flush({ data: { tiers: fixture.componentInstance.tiers, lock_version: 5 } });
  expect(fixture.componentInstance.message()).toContain('saved');
  http.verify();
});
it('keeps draft pricing after a stale-version error and disables saving when loading fails', () => {
  TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
  const fixture = TestBed.createComponent(PricingManager),
    http = TestBed.inject(HttpTestingController),
    manager = fixture.componentInstance;
  http.expectOne('/api/v1/reference_options').flush({ data: [] });
  http.expectOne('/api/v1/subscription_pricing').flush({ data: { tiers: [], lock_version: 1 } });
  manager.tiers = [{ currency: 'BTN', min_users: 1, max_users: 25, fee: '123' }];
  manager.save();
  http
    .expectOne('/api/v1/subscription_pricing')
    .flush(
      { error: { message: 'Pricing changed. Reload before saving.' } },
      { status: 409, statusText: 'Conflict' },
    );
  expect(manager.tiers[0].fee).toBe('123');
  expect(manager.error()).toContain('Reload');
  manager.load();
  http.expectOne('/api/v1/subscription_pricing').flush({}, { status: 500, statusText: 'Failure' });
  manager.save();
  http.expectNone('/api/v1/subscription_pricing');
  expect(manager.loaded()).toBe(false);
  http.verify();
});
