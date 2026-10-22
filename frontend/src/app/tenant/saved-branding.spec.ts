import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { BehaviorSubject, Subject, of, throwError } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';
import { vi } from 'vitest';
import { SavedBranding } from './saved-branding';
import { BrandingPreview } from './branding-preview';
import { TenantGateway } from './tenant.gateway';
import { ASSET_URL, FORM_OPTIONS, Tenant, emptyTenant } from './tenant.types';
import { routes } from '../app.routes';
import { Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { TenantForm } from './tenant-form';

describe('saved branding navigation', () => {
  it('cancels a previous tenant request when route parameters change', () => {
    const params = new BehaviorSubject(convertToParamMap({ id: 'one' }));
    const first = new Subject<Tenant>();
    const second = new Subject<Tenant>();
    const load = vi.fn((id: string) => (id === 'one' ? first : second));
    TestBed.configureTestingModule({
      imports: [SavedBranding],
      providers: [
        provideRouter([]),
        { provide: TenantGateway, useValue: { load } },
        { provide: ActivatedRoute, useValue: { paramMap: params } },
      ],
    });
    const fixture = TestBed.createComponent(SavedBranding);
    fixture.detectChanges();
    const view = fixture.componentInstance;
    expect(view.loading()).toBe(true);
    params.next(convertToParamMap({ id: 'two' }));
    first.next({ ...emptyTenant(), id: 'one' });
    expect(view.tenant()).toBeNull();
    second.next({ ...emptyTenant(), id: 'two', company_name: 'Saved two' });
    fixture.detectChanges();
    expect(view.tenant()?.id).toBe('two');
    expect(view.loading()).toBe(false);
  });
  it('shows denied access without stale saved values and supports retry', () => {
    const load = vi
      .fn()
      .mockReturnValueOnce(throwError(() => new HttpErrorResponse({ status: 403 })))
      .mockReturnValue(of({ ...emptyTenant(), id: 'one' }));
    TestBed.configureTestingModule({
      imports: [SavedBranding],
      providers: [
        provideRouter([]),
        { provide: TenantGateway, useValue: { load } },
        { provide: ActivatedRoute, useValue: { paramMap: of(convertToParamMap({ id: 'one' })) } },
      ],
    });
    const fixture = TestBed.createComponent(SavedBranding);
    fixture.detectChanges();
    expect(fixture.componentInstance.error()).toContain('do not have access');
    fixture.componentInstance.load();
    expect(fixture.componentInstance.tenant()?.id).toBe('one');
  });
  it('renders approved saved asset URLs and typography independently of form drafts', () => {
    TestBed.configureTestingModule({
      imports: [BrandingPreview],
      providers: [
        { provide: ASSET_URL, useValue: (id: string) => `https://assets.example.invalid/${id}` },
        {
          provide: FORM_OPTIONS,
          useValue: {
            typography: [{ id: 'approved', label: 'Approved font', fontFamily: 'serif' }],
          },
        },
      ],
    });
    const fixture = TestBed.createComponent(BrandingPreview);
    const t = emptyTenant();
    t.company_name = 'Saved company';
    t.company_name_display = true;
    t.branding.typography = 'approved';
    t.branding.logo_attachment_id = 'saved-logo';
    fixture.componentRef.setInput('tenant', t);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Saved company');
    expect(fixture.nativeElement.querySelector('img').getAttribute('src')).toBe(
      'https://assets.example.invalid/saved-logo',
    );
    expect(fixture.componentInstance.font()).toBe('serif');
  });
  it('keeps contact drafts when the user cancels navigation', async () => {
    TestBed.configureTestingModule({
      providers: [provideRouter(routes), { provide: TenantGateway, useValue: { load: vi.fn() } }],
    });
    const harness = await RouterTestingHarness.create('/tenants/new');
    const form = harness.routeDebugElement!.componentInstance as TenantForm;
    form.addContact();
    const confirm = vi.spyOn(globalThis, 'confirm').mockReturnValue(false);
    const router = TestBed.inject(Router);
    expect(await router.navigateByUrl('/tenants/one/branding')).toBe(false);
    expect(form.contacts.length).toBe(2);
    expect(confirm).toHaveBeenCalled();
    confirm.mockRestore();
  });
});
