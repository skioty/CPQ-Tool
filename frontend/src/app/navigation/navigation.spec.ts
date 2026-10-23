import { TestBed } from '@angular/core/testing';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { BehaviorSubject, of } from 'rxjs';
import { signal } from '@angular/core';
import { vi } from 'vitest';
import { Session, sessionHeaders } from './session';
import { Login } from './login';
import { TenantList } from './tenant-list';
import { TenantDetail } from './tenant-detail';
import { DIRECTORY_POLICY, DirectoryTenant } from './tenant-directory';
import { LifecycleDialog } from './lifecycle-dialog';

const tenant: DirectoryTenant = {
  id: 'tenant-one',
  company_name: 'Test company',
  company_name_display: null,
  description: null,
  industry_id: null,
  lifecycle_status: null,
  provisioning_status: 'ready',
  contacts: [{ id: 'contact-one', name: 'Test contact', email: null, primary: true }],
  responsible_admin_ids: ['assigned-id'],
  branding: { primary_colour: null, logo_attachment_id: 'saved-reference' },
  subscription: {
    currency: null,
    fee: '0.00',
    payment_method: null,
    discount: { type: null, value: null, duration: null },
  },
};
const page = { data: [tenant], meta: { page: 1, per_page: 20, total_count: 21, total_pages: 2 } };

describe('session integration', () => {
  let http: HttpTestingController;
  let session: Session;
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([sessionHeaders])),
        provideHttpClientTesting(),
        provideRouter([]),
      ],
    });
    http = TestBed.inject(HttpTestingController);
    session = TestBed.inject(Session);
  });
  afterEach(() => http.verify());
  it('obtains CSRF before login and retains the rotated token only in memory', () => {
    session.login('user@example.invalid', 'synthetic-password').subscribe();
    http.expectOne('/api/v1/session/csrf').flush({ csrf_token: 'before' });
    const request = http.expectOne('/api/v1/session');
    expect(request.request.headers.get('X-CSRF-Token')).toBe('before');
    expect(request.request.body.administrator.email).toBe('user@example.invalid');
    request.flush({ data: { id: 'actor', role: 'admin' }, csrf_token: 'after' });
    expect(session.actor()?.role).toBe('admin');
    expect(session.token()).toBe('after');
  });
  it('signs out using a current CSRF token and clears identity', () => {
    session.actor.set({ id: 'actor', role: 'admin' });
    session.logout().subscribe();
    http.expectOne('/api/v1/session/csrf').flush({ csrf_token: 'logout' });
    const request = http.expectOne('/api/v1/session');
    expect(request.request.method).toBe('DELETE');
    expect(request.request.headers.get('X-CSRF-Token')).toBe('logout');
    request.flush(null);
    expect(session.actor()).toBeNull();
    expect(session.token()).toBeNull();
  });
  it('clears expired identity and never retries a failed mutation', () => {
    session.actor.set({ id: 'actor', role: 'admin' });
    session.refresh().subscribe();
    http.expectOne('/api/v1/session').flush({}, { status: 401, statusText: 'Unauthorized' });
    expect(session.actor()).toBeNull();
  });
  it('ignores a stale anonymous session response after a newer login', () => {
    session.refresh().subscribe();
    const old = http.expectOne('/api/v1/session');
    session.login('user@example.invalid', 'synthetic-password').subscribe();
    http.expectOne('/api/v1/session/csrf').flush({ csrf_token: 'before' });
    http
      .expectOne('/api/v1/session')
      .flush({ data: { id: 'new-actor', role: 'admin' }, csrf_token: 'after' });
    old.flush({}, { status: 401, statusText: 'Unauthorized' });
    expect(session.actor()?.id).toBe('new-actor');
    expect(session.token()).toBe('after');
  });
  it('login prevents duplicate submits and clears password after API failure', () => {
    const fixture = TestBed.createComponent(Login);
    fixture.detectChanges();
    fixture.componentInstance.form.setValue({
      email: 'user@example.invalid',
      password: 'synthetic-password',
    });
    fixture.componentInstance.submit();
    fixture.componentInstance.submit();
    http.expectOne('/api/v1/session/csrf').flush({ csrf_token: 'login' });
    http.expectOne('/api/v1/session').flush({}, { status: 401, statusText: 'Unauthorized' });
    expect(fixture.componentInstance.busy()).toBe(false);
    expect(fixture.componentInstance.form.controls.password.value).toBe('');
    expect(fixture.componentInstance.error()).toContain('Invalid email');
  });
});

describe('tenant directory', () => {
  let http: HttpTestingController;
  const params = new BehaviorSubject(convertToParamMap({ id: 'one' }));
  beforeEach(() => {
    params.next(convertToParamMap({ id: 'one' }));
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: ActivatedRoute, useValue: { paramMap: params } },
        {
          provide: Session,
          useValue: {
            actor: signal({ id: 'actor', role: 'super_admin' }),
            refresh: () => of(null),
          },
        },
      ],
    });
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());
  it('lists real API records and paginates with the submitted search', () => {
    const fixture = TestBed.createComponent(TenantList);
    fixture.detectChanges();
    http.expectOne((r) => r.url === '/api/v1/tenants').flush(page);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Test company');
    fixture.componentInstance.query = 'A & B';
    fixture.componentInstance.search();
    const search = http.expectOne((r) => r.url === '/api/v1/tenants');
    expect(search.request.params.get('q')).toBe('A & B');
    search.flush(page);
    fixture.componentInstance.query = 'Not submitted';
    fixture.componentInstance.page(2);
    const next = http.expectOne((r) => r.url === '/api/v1/tenants');
    expect(next.request.params.get('q')).toBe('A & B');
    expect(next.request.params.get('page')).toBe('2');
    next.flush({ ...page, meta: { ...page.meta, page: 2 } });
  });
  it('cancels a superseded request and displays empty results', async () => {
    const fixture = TestBed.createComponent(TenantList);
    fixture.detectChanges();
    const first = http.expectOne((r) => r.url === '/api/v1/tenants');
    fixture.componentInstance.search();
    expect(first.cancelled).toBe(true);
    http
      .expectOne((r) => r.url === '/api/v1/tenants')
      .flush({ data: [], meta: { page: 1, per_page: 20, total_count: 0, total_pages: 0 } });
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('No tenants found');
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('select').disabled).toBe(false);
  });
  it('shows denied/connection failures and retries without stale tenant rows', () => {
    const fixture = TestBed.createComponent(TenantList);
    fixture.detectChanges();
    http
      .expectOne((r) => r.url === '/api/v1/tenants')
      .flush({}, { status: 401, statusText: 'Unauthorized' });
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('login is required');
    fixture.componentInstance.reload();
    http.expectOne((r) => r.url === '/api/v1/tenants').flush(page);
    expect(fixture.componentInstance.result()?.data[0].id).toBe(tenant.id);
  });
  it('sends status only from configured approved choices', () => {
    TestBed.inject(DIRECTORY_POLICY).statuses.push({ value: 'fixture-status', label: 'Fixture' });
    const fixture = TestBed.createComponent(TenantList);
    fixture.detectChanges();
    http.expectOne((r) => r.url === '/api/v1/tenants').flush(page);
    fixture.componentInstance.status = 'fixture-status';
    fixture.componentInstance.search();
    const request = http.expectOne((r) => r.url === '/api/v1/tenants');
    expect(request.request.params.get('status')).toBe('fixture-status');
    request.flush(page);
  });
  it('shows nullable detail fields, raw admin/asset references and navigation', () => {
    const fixture = TestBed.createComponent(TenantDetail);
    fixture.detectChanges();
    http.expectOne('/api/v1/tenants/one').flush({ data: tenant });
    fixture.detectChanges();
    const text = fixture.nativeElement.textContent;
    expect(text).toContain('Test contact');
    expect(text).toContain('assigned-id');
    expect(text).toContain('saved-reference');
    expect(text).toContain('0.00');
    expect(text).toContain('Actions unavailable');
    expect(fixture.nativeElement.querySelector('a[href="/tenants/tenant-one/edit"]')).toBeTruthy();
    expect(
      fixture.nativeElement.querySelector('a[href="/tenants/tenant-one/branding"]'),
    ).toBeTruthy();
  });
  it('cancels stale detail navigation and clears denied data', () => {
    const fixture = TestBed.createComponent(TenantDetail);
    fixture.detectChanges();
    const first = http.expectOne('/api/v1/tenants/one');
    params.next(convertToParamMap({ id: 'two' }));
    expect(first.cancelled).toBe(true);
    http.expectOne('/api/v1/tenants/two').flush({}, { status: 404, statusText: 'Not found' });
    fixture.detectChanges();
    expect(fixture.componentInstance.tenant()).toBeNull();
    expect(fixture.nativeElement.textContent).toContain('not found');
  });
  it('never submits an unapproved lifecycle action', () => {
    const fixture = TestBed.createComponent(TenantDetail);
    fixture.detectChanges();
    http.expectOne('/api/v1/tenants/one').flush({ data: tenant });
    fixture.componentInstance.selected.set({
      code: 'unapproved',
      label: 'Unapproved',
      confirmation: 'Not approved',
    });
    fixture.componentInstance.confirm();
    http.expectNone((r) => r.method === 'POST');
  });
  it('retains details on lifecycle failure using synthetic approved test policy', () => {
    const action = {
      code: 'fixture-action',
      label: 'Fixture action',
      confirmation: 'Synthetic test confirmation',
    };
    TestBed.inject(DIRECTORY_POLICY).actions = () => [action];
    const fixture = TestBed.createComponent(TenantDetail);
    fixture.detectChanges();
    http.expectOne('/api/v1/tenants/one').flush({ data: tenant });
    fixture.componentInstance.selected.set(action);
    fixture.componentInstance.confirm();
    fixture.componentInstance.confirm();
    const request = http.expectOne('/api/v1/tenants/tenant-one/lifecycle');
    expect(request.request.body).toEqual({ action: 'fixture-action' });
    request.flush({}, { status: 503, statusText: 'Unavailable' });
    expect(fixture.componentInstance.tenant()?.id).toBe(tenant.id);
    expect(fixture.componentInstance.actionError()).toContain('approved policy');
  });
});

describe('native lifecycle confirmation dialog', () => {
  it('labels the modal and emits cancel/confirm without defining a business action', async () => {
    const show = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, 'showModal');
    const close = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, 'close');
    Object.defineProperty(HTMLDialogElement.prototype, 'showModal', {
      configurable: true,
      value: vi.fn(),
    });
    Object.defineProperty(HTMLDialogElement.prototype, 'close', {
      configurable: true,
      value: vi.fn(),
    });
    const fixture = TestBed.createComponent(LifecycleDialog);
    fixture.componentRef.setInput('action', {
      code: 'fixture',
      label: 'Fixture action',
      confirmation: 'Synthetic confirmation',
    });
    fixture.componentRef.setInput('company', 'Fixture company');
    const cancel = vi.fn(),
      confirm = vi.fn();
    fixture.componentInstance.cancelled.subscribe(cancel);
    fixture.componentInstance.confirmed.subscribe(confirm);
    fixture.detectChanges();
    await fixture.whenStable();
    const dialog = fixture.nativeElement.querySelector('dialog');
    expect(dialog.getAttribute('aria-labelledby')).toBe('action-title');
    dialog.dispatchEvent(new Event('cancel'));
    fixture.nativeElement.querySelectorAll('button')[1].click();
    expect(cancel).toHaveBeenCalledOnce();
    expect(confirm).toHaveBeenCalledOnce();
    fixture.destroy();
    if (show) Object.defineProperty(HTMLDialogElement.prototype, 'showModal', show);
    else delete (HTMLDialogElement.prototype as Partial<HTMLDialogElement>).showModal;
    if (close) Object.defineProperty(HTMLDialogElement.prototype, 'close', close);
    else delete (HTMLDialogElement.prototype as Partial<HTMLDialogElement>).close;
  });
});
