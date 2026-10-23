import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { Observable, Subject, of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { Session } from '../navigation/session';
import { TenantForm } from './tenant-form';
import { TenantGateway } from './tenant.gateway';
import { ASSET_UPLOAD, FORM_OPTIONS, FormOptions, Tenant, emptyTenant } from './tenant.types';

// Synthetic test data only; never injected into the running application.
function savedTenant(): Tenant {
  const t = emptyTenant();
  return {
    ...t,
    id: 'tenant-1',
    company_name: 'Saved company',
    description: 'Saved description',
    industry_id: 'saved-industry',
    responsible_admin_ids: ['saved-admin'],
    schema_name: 'must-not-be-sent',
    lifecycle_status: 'must-not-be-sent',
    contacts: [
      { id: 'contact-1', name: 'Example', email: 'contact@example.invalid', primary: true },
    ],
    branding: {
      ...t.branding,
      logo_attachment_id: 'saved-logo',
      favicon_attachment_id: 'saved-icon',
      primary_colour: '#123456',
    },
    subscription: {
      ...t.subscription,
      currency: 'saved-currency',
      fee: '123.4500',
      discount: { type: 'saved-type', value: 'unchanged', duration: 'unchanged-duration' },
    },
  };
}
function settings(): FormOptions {
  return {
    industries: [],
    currencies: [],
    admins: [],
    typography: [],
    paymentMethods: [],
    discountTypes: [],
    contractApproved: true,
    assignment: 'many',
    discountDurationLabel: 'Approved duration unit',
    requiredFields: [],
  };
}
async function setup(
  id?: string,
  options = settings(),
  pending?: Subject<Tenant>,
  upload: unknown = null,
) {
  const gateway = {
    load: vi.fn(() => pending || of(savedTenant())),
    save: vi.fn((t: Tenant, _id?: string): Observable<Tenant> =>
      of({ ...t, id: id || 'created-1' }),
    ),
  };
  await TestBed.configureTestingModule({
    imports: [TenantForm],
    providers: [
      provideRouter([]),
      { provide: Session, useValue: { actor: () => ({ role: 'super_admin' }) } },
      { provide: TenantGateway, useValue: gateway },
      { provide: FORM_OPTIONS, useValue: options },
      { provide: ASSET_UPLOAD, useValue: upload },
      {
        provide: ActivatedRoute,
        useValue: {
          paramMap: of(convertToParamMap(id ? { id } : {})),
          snapshot: { paramMap: convertToParamMap(id ? { id } : {}) },
        },
      },
    ],
  }).compileComponents();
  const fixture = TestBed.createComponent(TenantForm);
  fixture.detectChanges();
  return {
    fixture,
    form: fixture.componentInstance,
    gateway,
    dom: fixture.nativeElement as HTMLElement,
  };
}

describe('tenant form', () => {
  it('does not invent required company fields or a primary contact', async () => {
    const { form } = await setup();
    expect(form.form.controls.fields.controls['company_name'].valid).toBe(true);
    expect(form.contacts.hasError('primaryContact')).toBe(true);
    form.choosePrimary(0);
    expect(form.form.valid).toBe(true);
  });
  it('applies explicitly supplied required fields and optional email syntax', async () => {
    const options = settings();
    options.requiredFields = ['company_name'];
    const { form } = await setup(undefined, options);
    form.choosePrimary(0);
    expect(form.form.invalid).toBe(true);
    form.form.controls.fields.controls['company_name'].setValue('Example');
    form.contacts.at(0).controls.email.setValue('invalid');
    expect(form.form.invalid).toBe(true);
    form.contacts.at(0).controls.email.setValue('');
    expect(form.form.valid).toBe(true);
  });
  it('adds contacts and switches the single primary through labelled native controls', async () => {
    const { form, fixture, dom } = await setup();
    Array.from(dom.querySelectorAll('button'))
      .find((b) => b.textContent?.includes('Add contact'))!
      .click();
    fixture.detectChanges();
    const radios = dom.querySelectorAll<HTMLInputElement>('input[type=radio]');
    radios[0].click();
    fixture.detectChanges();
    radios[1].click();
    fixture.detectChanges();
    expect(form.contacts.getRawValue().map((c) => c.primary)).toEqual([false, true]);
    expect(form.contacts.valid).toBe(true);
  });
  it('does not automatically replace a removed primary and rejects zero contacts', async () => {
    const { form } = await setup();
    form.choosePrimary(0);
    form.addContact();
    form.removeContact(0);
    expect(form.contacts.hasError('primaryContact')).toBe(true);
    form.removeContact(0);
    expect(form.contacts.invalid).toBe(true);
  });
  it('rejects multiple primary contacts even if form values bypass the UI', async () => {
    const { form, gateway } = await setup();
    form.addContact();
    form.contacts.controls.forEach((c) => c.controls.primary.setValue(true));
    form.submit();
    expect(gateway.save).not.toHaveBeenCalled();
    expect(form.errors().join()).toContain('Exactly one');
  });
  it('keeps persistence unavailable when contracts remain unapproved', async () => {
    const options = settings();
    options.contractApproved = false;
    const { form, gateway, dom } = await setup(undefined, options);
    form.choosePrimary(0);
    form.submit();
    expect(gateway.save).not.toHaveBeenCalled();
    expect(dom.textContent).toContain('Saving is temporarily unavailable');
    expect(form.errors().join()).toContain('temporarily unavailable');
  });
  it('loads edit values and preserves exact fees, contact IDs and unchanged assets in PATCH data', async () => {
    const { form, gateway } = await setup('tenant-1');
    expect(form.form.controls.fields.controls['company_name'].value).toBe('Saved company');
    form.form.controls.fields.controls['description'].setValue('Updated');
    form.submit();
    const [payload, id] = gateway.save.mock.calls[0] as unknown as [Tenant, string];
    expect(id).toBe('tenant-1');
    expect(payload.description).toBe('Updated');
    expect(payload.subscription.fee).toBe('123.4500');
    expect(payload.branding.logo_attachment_id).toBe('saved-logo');
    expect(payload.branding.favicon_attachment_id).toBe('saved-icon');
    expect(payload.contacts[0].id).toBe('contact-1');
    expect(payload.responsible_admin_ids).toEqual(['saved-admin']);
    expect(payload['schema_name']).toBeUndefined();
    expect(payload['lifecycle_status']).toBeUndefined();
    expect(form.status()).toBe('success');
  });
  it('disables edits during loading and refuses save after load failure', async () => {
    const pending = new Subject<Tenant>();
    const { form, gateway } = await setup('tenant-1', settings(), pending);
    expect(form.status()).toBe('loading');
    expect(form.form.disabled).toBe(true);
    pending.error(new HttpErrorResponse({ status: 404 }));
    form.submit();
    expect(form.loaded).toBe(false);
    expect(gateway.save).not.toHaveBeenCalled();
  });
  it('retains draft values, exposes field errors and focuses their summary after a 422', async () => {
    const { form, gateway, fixture, dom } = await setup('tenant-1');
    gateway.save.mockReturnValue(
      throwError(
        () =>
          new HttpErrorResponse({
            status: 422,
            error: { error: { fields: { 'contacts.0.email': ['Rejected by server'] } } },
          }),
      ),
    );
    form.form.controls.fields.controls['description'].setValue('Keep this draft');
    form.submit();
    fixture.detectChanges();
    await fixture.whenStable();
    expect(form.form.controls.fields.controls['description'].value).toBe('Keep this draft');
    expect(form.errors().join()).toContain('Contact 1 email: Rejected by server');
    expect(form.status()).toBe('failed');
    expect(form.form.enabled).toBe(true);
    expect(dom.ownerDocument.activeElement?.getAttribute('aria-label')).toBe('Form errors');
  });
  it.each([0, 401, 403, 409, 500])(
    'handles API failure %s without claiming success',
    async (status) => {
      const { form, gateway } = await setup('tenant-1');
      gateway.save.mockReturnValue(throwError(() => new HttpErrorResponse({ status })));
      form.submit();
      expect(form.status()).toBe('failed');
      expect(form.errors().length).toBeGreaterThan(0);
      expect(form.saved()?.company_name).toBe('Saved company');
    },
  );
  it('prevents duplicate submissions while saving', async () => {
    const { form, gateway } = await setup('tenant-1');
    const pending = new Subject<Tenant>();
    gateway.save.mockReturnValue(pending);
    form.submit();
    form.submit();
    expect(gateway.save).toHaveBeenCalledTimes(1);
    expect(form.form.disabled).toBe(true);
    pending.next(savedTenant());
    pending.complete();
    expect(form.form.enabled).toBe(true);
  });
  it('blocks missing upload integration without discarding the selected file or saved asset', async () => {
    const { form, gateway } = await setup('tenant-1');
    const file = new File(['test'], 'logo.bin');
    form.files.set({ logo: file });
    form.submit();
    expect(gateway.save).not.toHaveBeenCalled();
    expect(form.files().logo).toBe(file);
    expect(form.draft().branding.logo_attachment_id).toBe('saved-logo');
  });
  it('replaces only successfully uploaded assets and preserves their IDs across a save retry', async () => {
    const upload = vi.fn(() => of({ id: 'new-logo' }));
    const { form, gateway } = await setup('tenant-1', settings(), undefined, upload);
    gateway.save.mockReturnValueOnce(throwError(() => new HttpErrorResponse({ status: 500 })));
    form.files.set({ logo: new File(['test'], 'logo.bin') });
    form.submit();
    expect(form.draft().branding.logo_attachment_id).toBe('new-logo');
    expect(form.files().logo).toBeUndefined();
    form.submit();
    expect(upload).toHaveBeenCalledTimes(1);
    expect(gateway.save.mock.calls[1][0].branding.favicon_attachment_id).toBe('saved-icon');
  });
  it('keeps saved settings separate from unsaved preview changes', async () => {
    const { form } = await setup('tenant-1');
    form.form.controls.fields.controls['primary_colour'].setValue('#abcdef');
    expect(form.draft().branding.primary_colour).toBe('#abcdef');
    expect(form.saved()?.branding.primary_colour).toBe('#123456');
  });
  it('keeps keyboard focus in contacts after removing a row', async () => {
    const { form, fixture, dom } = await setup();
    form.addContact();
    fixture.detectChanges();
    dom.querySelector<HTMLButtonElement>('button[aria-label="Remove contact 2"]')!.click();
    await fixture.whenStable();
    expect(dom.ownerDocument.activeElement).toBe(dom.querySelector('input[type=radio]'));
    dom.querySelector<HTMLButtonElement>('button[aria-label="Remove contact 1"]')!.click();
    await fixture.whenStable();
    expect(dom.ownerDocument.activeElement?.textContent).toContain('Add contact');
  });
  it('retains a failed upload selection and completed IDs after partial upload failure', async () => {
    const upload = vi.fn((kind: string) =>
      kind === 'logo' ? of({ id: 'new-logo' }) : throwError(() => new Error('Upload failed')),
    );
    const { form, gateway } = await setup('tenant-1', settings(), undefined, upload);
    const icon = new File(['test'], 'icon.bin');
    form.files.set({ logo: new File(['test'], 'logo.bin'), favicon: icon });
    form.submit();
    expect(gateway.save).not.toHaveBeenCalled();
    expect(form.status()).toBe('failed');
    expect(form.draft().branding.logo_attachment_id).toBe('new-logo');
    expect(form.draft().branding.favicon_attachment_id).toBe('saved-icon');
    expect(form.files().favicon).toBe(icon);
    expect(form.files().logo).toBeUndefined();
  });
  it('revokes local image previews on replacement, cancellation and destruction', async () => {
    const OriginalURL = URL;
    const create = vi
      .fn()
      .mockReturnValueOnce('blob:first')
      .mockReturnValueOnce('blob:second')
      .mockReturnValueOnce('blob:third');
    const revoke = vi.fn();
    class TestURL extends OriginalURL {
      static override createObjectURL(_file: Blob | MediaSource) {
        return create();
      }
      static override revokeObjectURL(url: string) {
        revoke(url);
      }
    }
    vi.stubGlobal('URL', TestURL);
    try {
      const { form, fixture } = await setup();
      const event = () =>
        ({
          target: { files: [new File(['test'], 'logo.png', { type: 'image/png' })], value: '' },
        }) as unknown as Event;
      form.selectFile('logo', event());
      form.selectFile('logo', event());
      expect(revoke).toHaveBeenCalledWith('blob:first');
      form.cancelFile('logo');
      expect(revoke).toHaveBeenCalledWith('blob:second');
      form.selectFile('logo', event());
      fixture.destroy();
      expect(revoke).toHaveBeenCalledWith('blob:third');
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
