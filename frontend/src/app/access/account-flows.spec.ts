import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { BehaviorSubject, of } from 'rxjs';
import { signal } from '@angular/core';
import { vi } from 'vitest';
import { InvitationLink } from './invitation-link';
import { SetupGuide } from './setup-guide';
import { AdministratorManager } from './administrator-manager';
import { TenantInvitations } from './tenant-invitations';
import { InvitationAccept } from './invitation-accept';
import { TenantSession } from './access-api';
import { TenantWorkspaces } from './tenant-workspaces';

const ready = {
  tenant_id: 'one',
  company_name: 'Synthetic company',
  lifecycle_status: 'inactive',
  complete: true,
  can_activate: true,
  checks: [
    { key: 'company', label: 'Company information', complete: true, errors: {} },
    { key: 'provisioning', label: 'Schema provisioning', complete: true, errors: {} },
  ],
};
describe('account management and guided setup', () => {
  let http: HttpTestingController;
  let params: BehaviorSubject<any>;
  beforeEach(() => {
    params = new BehaviorSubject(convertToParamMap({ id: 'one' }));
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: {
            paramMap: params,
            fragment: of('token=synthetic-test-token-that-is-long-enough'),
          },
        },
      ],
    });
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => {
    http.verify();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });
  it('uses authoritative setup checks and never offers activation without permission', () => {
    const f = TestBed.createComponent(SetupGuide);
    f.detectChanges();
    http
      .expectOne('/api/v1/tenants/one/setup_review')
      .flush({ data: { ...ready, can_activate: false } });
    f.detectChanges();
    expect(f.nativeElement.textContent).toContain('2 of 2 checks complete');
    expect(f.nativeElement.querySelector('progress').value).toBe(2);
    expect(f.nativeElement.textContent).not.toContain('Activate workspace');
    f.componentInstance.activate();
    http.expectNone((r) => r.method === 'POST');
    expect(f.componentInstance.fragment('assignment')).toBe('section-company');
  });
  it('prevents duplicate activation and refreshes setup only after success', () => {
    const f = TestBed.createComponent(SetupGuide);
    f.detectChanges();
    http.expectOne('/api/v1/tenants/one/setup_review').flush({ data: ready });
    f.detectChanges();
    f.componentInstance.activate();
    f.componentInstance.activate();
    const r = http.expectOne('/api/v1/tenants/one/lifecycle');
    expect(r.request.body).toEqual({ action: 'activate' });
    r.flush({});
    http
      .expectOne('/api/v1/tenants/one/setup_review')
      .flush({ data: { ...ready, can_activate: false, lifecycle_status: 'active' } });
    expect(f.componentInstance.message()).toContain('activated');
  });
  it('creates a one-time staff link without email configuration and dismisses it', () => {
    const f = TestBed.createComponent(AdministratorManager);
    f.detectChanges();
    http
      .expectOne('/api/v1/administrators')
      .flush({ data: [], invitation_delivery: 'manual_link' });
    f.componentInstance.email = 'staff@example.invalid';
    f.componentInstance.create();
    http.expectOne('/api/v1/administrators').flush({
      invitation_token: 'synthetic-secret-token',
      invitation: { email: 'staff@example.invalid' },
    });
    http
      .expectOne('/api/v1/administrators')
      .flush({ data: [], invitation_delivery: 'manual_link' });
    f.detectChanges();
    expect(f.nativeElement.querySelector('#issued-invitation-link').value).toContain(
      '#token=synthetic-secret-token',
    );
    expect(f.nativeElement.textContent).toContain('No email is sent');
    f.nativeElement.querySelector('[aria-label="Dismiss invitation link"]').click();
    f.detectChanges();
    expect(f.nativeElement.querySelector('#issued-invitation-link')).toBeNull();
    expect(f.componentInstance.issuedToken()).toBe('');
  });
  it('copies only the newly issued link and reports clipboard failure honestly', async () => {
    const copy = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { clipboard: { writeText: copy } });
    const f = TestBed.createComponent(InvitationLink);
    f.componentRef.setInput('token', 'synthetic-copy-token');
    f.componentRef.setInput('email', 'recipient@example.invalid');
    f.detectChanges();
    await f.componentInstance.copy();
    expect(copy).toHaveBeenCalledWith(
      location.origin + '/invitations/accept#token=synthetic-copy-token',
    );
    expect(f.componentInstance.copied()).toBe(true);
    copy.mockRejectedValueOnce(new Error('Clipboard denied'));
    await f.componentInstance.copy();
    expect(f.componentInstance.note()).toContain('use Ctrl+C');
    expect(f.componentInstance.copying()).toBe(false);
  });
  it('replaces a tenant invitation link and clears it when navigating to another tenant', () => {
    const f = TestBed.createComponent(TenantInvitations);
    f.detectChanges();
    http
      .expectOne('/api/v1/tenants/one/invitations')
      .flush({ data: [], members: [], invitation_delivery: 'manual_link' });
    f.componentInstance.resend('old');
    http
      .expectOne('/api/v1/invitations/old/resend')
      .flush({ invitation_token: 'fresh-secret', data: { email: 'recipient@example.invalid' } });
    http
      .expectOne('/api/v1/tenants/one/invitations')
      .flush({ data: [], members: [], invitation_delivery: 'manual_link' });
    expect(f.componentInstance.issuedToken()).toBe('fresh-secret');
    params.next(convertToParamMap({ id: 'two' }));
    expect(f.componentInstance.issuedToken()).toBe('');
    http
      .expectOne('/api/v1/tenants/two/invitations')
      .flush({ data: [], members: [], invitation_delivery: 'manual_link' });
  });
  it('distinguishes failed email delivery from invitation creation and offers replacement retry', () => {
    const f = TestBed.createComponent(TenantInvitations);
    f.detectChanges();
    http
      .expectOne('/api/v1/tenants/one/invitations')
      .flush({ data: [], members: [], company_name: 'Synthetic company' });
    f.componentInstance.email = 'recipient@example.invalid';
    f.componentInstance.confirmedSend();
    http
      .expectOne('/api/v1/tenants/one/invitations')
      .flush({
        data: { email_delivery_status: 'failed', email: 'recipient@example.invalid' },
        invitation_token: 'synthetic-private-link',
      });
    http.expectOne('/api/v1/tenants/one/invitations').flush({ data: [], members: [] });
    expect(f.componentInstance.message()).toContain('email delivery failed');
    expect(f.componentInstance.message()).not.toContain('email accepted');
    f.componentInstance.resend('failed');
    const retry = http.expectOne('/api/v1/invitations/failed/resend');
    expect(retry.request.body.delivery).toBe('email');
    retry.flush({ data: { email_delivery_status: 'sent' } });
    http.expectOne('/api/v1/tenants/one/invitations').flush({ data: [], members: [] });
    expect(f.componentInstance.message()).toContain('Inbox delivery is not confirmed');
  });
  it('sends no staff password and preserves API failure without claiming success', () => {
    const f = TestBed.createComponent(AdministratorManager);
    f.detectChanges();
    http
      .expectOne('/api/v1/administrators')
      .flush({ data: [], invitation_delivery: 'manual_link' });
    f.componentInstance.email = 'staff@example.invalid';
    f.componentInstance.name = 'Synthetic staff';
    f.componentInstance.create();
    f.componentInstance.create();
    const r = http.expectOne('/api/v1/administrators');
    expect(r.request.body).toEqual({
      administrator: { email: 'staff@example.invalid', name: 'Synthetic staff' },
    });
    r.flush(
      { error: { message: 'Invitation could not be created' } },
      { status: 503, statusText: 'Unavailable' },
    );
    http
      .expectOne('/api/v1/administrators')
      .flush({ data: [], invitation_delivery: 'manual_link' });
    expect(f.componentInstance.message()).toBe('');
    expect(f.componentInstance.error()).toContain('could not be created');
    expect(f.componentInstance.email).toBe('staff@example.invalid');
  });
  it('loads explicit memberships and sends tenant invitations only after an explicit action', () => {
    const f = TestBed.createComponent(TenantInvitations);
    f.detectChanges();
    http
      .expectOne('/api/v1/tenants/one/invitations')
      .flush({ data: [], members: [], invitation_delivery: 'manual_link' });
    f.detectChanges();
    expect(f.nativeElement.textContent).toContain('No tenant accounts have accepted');
    http.expectNone((r) => r.method === 'POST');
    f.componentInstance.email = 'contact@example.invalid';
    f.componentInstance.send();
    expect(f.componentInstance.confirmation()).toBe(true);
    http.expectNone((r) => r.method === 'POST');
    f.componentInstance.confirmedSend();
    f.componentInstance.confirmedSend();
    const r = http.expectOne('/api/v1/tenants/one/invitations');
    expect(r.request.body).toEqual({ email: 'contact@example.invalid', delivery: 'email' });
    r.flush({});
    http
      .expectOne('/api/v1/tenants/one/invitations')
      .flush({ data: [], members: [], invitation_delivery: 'manual_link' });
    expect(f.componentInstance.message()).toContain('No account access');
  });
  it('clears the fragment from browser history and uses an existing account password without resetting it', () => {
    const replace = vi.spyOn(history, 'replaceState').mockImplementation(() => {});
    const f = TestBed.createComponent(InvitationAccept);
    f.detectChanges();
    const preview = http.expectOne('/api/v1/invitation_preview');
    expect(preview.request.body.token).toBe('synthetic-test-token-that-is-long-enough');
    preview.flush({
      data: {
        email: 'existing@example.invalid',
        kind: 'tenant',
        company_name: 'Synthetic company',
        existing_account: true,
      },
    });
    f.detectChanges();
    expect(replace).toHaveBeenCalled();
    expect(f.nativeElement.textContent).toContain('existing tenant account password');
    expect(f.nativeElement.querySelector('#accept-confirmation')).toBeNull();
    f.componentInstance.password = 'synthetic-password';
    f.componentInstance.submit();
    f.componentInstance.submit();
    const accept = http.expectOne('/api/v1/invitation_acceptance');
    expect(accept.request.body.password).toBe('synthetic-password');
    accept.flush({});
    expect(f.componentInstance.complete()).toBe(true);
    expect(f.componentInstance.password).toBe('');
  });
  it('shows expired invitation errors without displaying an activation form', () => {
    vi.spyOn(history, 'replaceState').mockImplementation(() => {});
    const f = TestBed.createComponent(InvitationAccept);
    f.detectChanges();
    http
      .expectOne('/api/v1/invitation_preview')
      .flush({ error: { message: 'Invitation expired' } }, { status: 410, statusText: 'Gone' });
    f.detectChanges();
    expect(f.nativeElement.querySelector('[role=alert]').textContent).toContain('expired');
    expect(f.nativeElement.querySelector('form')).toBeNull();
  });
  it('keeps tenant-session identity separate and ignores a stale anonymous response after login', () => {
    const session = TestBed.inject(TenantSession);
    session.refresh().subscribe();
    const old = http.expectOne('/api/v1/tenant_session');
    session.login('tenant@example.invalid', 'synthetic-password').subscribe();
    const login = http.expectOne('/api/v1/tenant_session');
    expect(login.request.body).toEqual({
      tenant_user: { email: 'tenant@example.invalid', password: 'synthetic-password' },
    });
    login.flush({ data: { id: 'user', email: 'tenant@example.invalid' }, csrf_token: 'rotated' });
    old.flush({}, { status: 401, statusText: 'Unauthorized' });
    expect(session.actor()?.id).toBe('user');
  });
  it('cancels the old workspace request when tenant navigation changes', () => {
    vi.spyOn(TestBed.inject(TenantSession), 'refresh').mockReturnValue(
      of({ data: { id: 'user', email: 'user@example.invalid' } }),
    );
    const icon = document.createElement('link');
    icon.rel = 'icon'; icon.href = '/favicon.svg'; icon.type = 'image/svg+xml';
    document.head.append(icon);
    const f = TestBed.createComponent(TenantWorkspaces);
    f.detectChanges();
    const old = http.expectOne('/api/v1/my_workspaces/one');
    params.next(convertToParamMap({ id: 'two' }));
    expect(old.cancelled).toBe(true);
    http.expectOne('/api/v1/my_workspaces/two').flush({
      data: {
        id: 'two',
        company_name: 'Second workspace',
        description: null,
        company_name_display: true,
        role: 'tenant_admin',
        branding: {
          primary_colour: '#FFFFFF',
          secondary_colour: '#000000',
          typography: 'system',
          logo_attachment_id: null,
          favicon_attachment_id: 'saved-favicon',
        },
      },
    });
    f.detectChanges();
    expect(f.componentInstance.workspace()?.id).toBe('two');
    expect(document.title).toBe('Second workspace · Workspace');
    expect(icon.getAttribute('href')).toBe('/api/v1/my_workspaces/two/assets/saved-favicon');
    expect(icon.hasAttribute('type')).toBe(false);
    params.next(convertToParamMap({}));
    expect(document.title).not.toContain('Second workspace');
    expect(icon.getAttribute('href')).toBe('/favicon.svg');
    expect(icon.getAttribute('type')).toBe('image/svg+xml');
    http.expectOne('/api/v1/my_workspaces').flush({ data: [] });
    f.destroy(); icon.remove();
  });
});
