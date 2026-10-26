import {
  Component,
  DestroyRef,
  ElementRef,
  Injector,
  OnInit,
  inject,
  signal,
  viewChild,
  viewChildren,
  afterNextRender,
} from '@angular/core';
import {
  FormArray,
  FormBuilder,
  FormControl,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { Subscription, concatMap, finalize, from, switchMap, tap, toArray } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  ASSET_UPLOAD,
  Asset,
  AssetKind,
  Choice,
  Contact,
  FORM_OPTIONS,
  Tenant,
  emptyTenant,
} from './tenant.types';
import { commercialErrors } from './approved-validation';
import { Session } from '../navigation/session';
import { TenantGateway } from './tenant.gateway';
import { Field, TenantField } from './tenant-field';
import { BrandingPreview } from './branding-preview';

export const FIELDS: Field[] = [
  {
    key: 'payment_method_description',
    path: 'subscription.payment_method_description',
    label: 'Payment description (required)',
    section: 'Subscription',
  },
  { key: 'company_name', path: 'company_name', label: 'Company name', section: 'Company' },
  {
    key: 'description',
    path: 'description',
    label: 'Description',
    section: 'Company',
    kind: 'textarea',
  },
  {
    key: 'industry_id',
    path: 'industry_id',
    label: 'Industry',
    section: 'Company',
    kind: 'select',
  },
  {
    key: 'currency',
    path: 'subscription.currency',
    label: 'Currency',
    section: 'Subscription',
    kind: 'select',
  },
  {
    key: 'fee',
    path: 'subscription.fee',
    label: 'Subscription fee',
    section: 'Subscription',
    help: 'Monthly subscription fee. Zero is allowed; use at most two decimal places.',
  },
  {
    key: 'payment_method',
    path: 'subscription.payment_method',
    label: 'Payment method',
    section: 'Subscription',
    kind: 'select',
  },
  {
    key: 'discount_type',
    path: 'subscription.discount.type',
    label: 'Discount type',
    section: 'Subscription',
    kind: 'select',
  },
  {
    key: 'discount_value',
    path: 'subscription.discount.value',
    label: 'Discount value',
    section: 'Subscription',
    help: 'Percentage from 0 to 100, up to two decimal places.',
  },
  {
    key: 'discount_duration',
    path: 'subscription.discount.duration',
    label: 'Discount duration',
    section: 'Subscription',
    help: 'Positive whole monthly billing cycles beginning with the first applicable cycle.',
  },
  {
    key: 'primary_colour',
    path: 'branding.primary_colour',
    label: 'Primary colour',
    section: 'Branding',
    help: 'Six-digit colour code, for example #17365D.',
  },
  {
    key: 'secondary_colour',
    path: 'branding.secondary_colour',
    label: 'Secondary colour',
    section: 'Branding',
  },
  {
    key: 'typography',
    path: 'branding.typography',
    label: 'Typography',
    section: 'Branding',
    kind: 'select',
  },
];

@Component({
  selector: 'app-tenant-form',
  imports: [ReactiveFormsModule, RouterLink, TenantField, BrandingPreview],
  templateUrl: './tenant-form.html',
  styleUrl: './tenant-form.scss',
})
export class TenantForm implements OnInit {
  readonly options = inject(FORM_OPTIONS);
  readonly session = inject(Session);
  get commercialEditable() {
    return this.session.actor()?.role === 'super_admin';
  }
  private readonly fb = inject(FormBuilder).nonNullable;
  private readonly gateway = inject(TenantGateway);
  private readonly upload = inject(ASSET_UPLOAD);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroy = inject(DestroyRef);
  private readonly injector = inject(Injector);
  readonly summary = viewChild<ElementRef<HTMLElement>>('summary');
  readonly primaryRadios = viewChildren<ElementRef<HTMLInputElement>>('primaryRadio');
  readonly addContactButton = viewChild<ElementRef<HTMLButtonElement>>('addContactButton');
  readonly status = signal<'loading' | 'ready' | 'saving' | 'success' | 'failed'>('ready');
  readonly errors = signal<string[]>([]);
  readonly saved = signal<Tenant | null>(null);
  readonly previewVersion = signal(0);
  readonly files = signal<Partial<Record<AssetKind, File>>>({});
  readonly urls = signal<Partial<Record<AssetKind, string>>>({});
  readonly sections = ['Company', 'Contacts', 'Branding', 'Subscription'];
  sectionDescription(section: string) {
    return (
      (
        {
          Company: 'The essentials that identify this company.',
          Branding: 'Create a workspace that feels like their own.',
          Subscription: 'Manage billing preferences and subscription discounts.',
        } as Record<string, string>
      )[section] || ''
    );
  }
  readonly serverErrors = signal<Record<string, string[]>>({});
  readonly assetKinds = ['logo', 'favicon'] as const;
  readonly fields = FIELDS.map((field) =>
    field.key === 'discount_duration' && this.options.discountDurationLabel
      ? {
          ...field,
          label: this.options.discountDurationLabel,
          help: 'Number of monthly billing cycles for this discount.',
        }
      : field,
  ).sort((a, b) => {
    const order = [
      'company_name',
      'description',
      'industry_id',
      'primary_colour',
      'secondary_colour',
      'typography',
      'currency',
      'fee',
      'payment_method',
      'payment_method_description',
      'discount_type',
      'discount_value',
      'discount_duration',
    ];
    return order.indexOf(a.key) - order.indexOf(b.key);
  });
  readonly form = this.fb.group({
    fields: this.fb.record(
      Object.fromEntries(
        FIELDS.map((f) => [
          f.key,
          new FormControl('', {
            nonNullable: true,
            validators: this.options.requiredFields.includes(f.path) ? [Validators.required] : [],
          }),
        ]),
      ),
    ),
    company_name_display: false,
    admins: this.fb.control<string[]>(
      [],
      this.options.requiredFields.includes('responsible_admin_ids') ? [Validators.required] : [],
    ),
    contacts: this.fb.array([this.contact()], {
      validators: (c) =>
        (c as FormArray).controls.filter((row) => row.get('primary')?.value === true).length === 1
          ? null
          : { primaryContact: true },
    }),
  });
  private original = emptyTenant();
  private id?: string;
  private request?: Subscription;
  get contacts() {
    return this.form.controls.contacts;
  }
  get edit() {
    return !!this.id;
  }
  get loaded() {
    return !this.edit || this.saved() !== null;
  }
  get integrationReady() {
    return (
      this.options.contractApproved &&
      this.options.assignment !== null &&
      !!this.options.discountDurationLabel
    );
  }

  constructor() {
    this.enableForm();
    this.destroy.onDestroy(() =>
      Object.values(this.urls()).forEach((url) => URL.revokeObjectURL(url)),
    );
    this.form.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => {
      this.previewVersion.update((v) => v + 1);
      this.serverErrors.set({});
      if (this.status() === 'success') this.status.set('ready');
    });
  }
  private enableForm() {
    this.form.enable({ emitEvent: false });
    for (const field of FIELDS) {
      if (field.kind === 'select' && !this.choices(field.key).length) {
        this.form.controls.fields.controls[field.key].disable({ emitEvent: false });
      }
    }
  }
  ngOnInit() {
    this.route.paramMap.pipe(takeUntilDestroyed(this.destroy)).subscribe((params) => {
      this.request?.unsubscribe();
      this.assetKinds.forEach((kind) => this.cancelFile(kind));
      this.id = params.get('id') || undefined;
      this.saved.set(null);
      if (this.id) this.load();
      else {
        const draft = emptyTenant();
        if (this.options.contractApproved) {
          Object.assign(draft.branding, {
            primary_colour: '#17365D',
            secondary_colour: '#2563EB',
            typography: 'system',
          });
          draft.subscription.fee = '0';
          draft.subscription.discount = { type: 'percentage', value: '0', duration: '' };
        }
        this.patch(draft);
        this.status.set('ready');
      }
    });
  }
  private contact(value: Contact = { name: '', email: '', primary: false }) {
    return this.fb.group({
      id: value.id || '',
      name: this.fb.control(
        value.name,
        this.options.requiredFields.includes('contacts.name') ? [Validators.required] : [],
      ),
      phone: value.phone || '',
      email: this.fb.control(value.email, [
        Validators.email,
        ...(this.options.requiredFields.includes('contacts.email') ? [Validators.required] : []),
      ]),
      primary: value.primary,
    });
  }
  addContact() {
    this.contacts.push(this.contact());
    this.form.markAsDirty();
  }
  removeContact(index: number) {
    this.contacts.removeAt(index);
    this.form.markAsDirty(); /* Never silently promote a replacement primary. */
    afterNextRender(
      () => {
        const radios = this.primaryRadios();
        (
          radios[Math.min(index, radios.length - 1)] || this.addContactButton()
        )?.nativeElement.focus();
      },
      { injector: this.injector },
    );
  }
  choosePrimary(index: number) {
    this.contacts.controls.forEach((c, i) => c.controls.primary.setValue(i === index));
    this.form.markAsDirty();
  }
  selectedAdmins(event: Event) {
    const select = event.target as HTMLSelectElement;
    this.form.controls.admins.setValue(
      Array.from(select.selectedOptions)
        .map((o) => o.value)
        .filter(Boolean),
    );
    this.form.markAsDirty();
  }
  choices(key: string): Choice[] {
    return (
      (
        {
          industry_id: this.options.industries,
          currency: this.options.currencies,
          payment_method: this.options.paymentMethods,
          typography: this.options.typography,
          discount_type: this.options.discountTypes,
        } as Record<string, Choice[]>
      )[key] || []
    );
  }
  unknownAdmins() {
    return this.form.controls.admins.value.filter(
      (id) => !this.options.admins.some((a) => a.id === id),
    );
  }
  load() {
    if (!this.id) return;
    this.request?.unsubscribe();
    this.errors.set([]);
    this.status.set('loading');
    this.form.disable({ emitEvent: false });
    this.request = this.gateway
      .load(this.id)
      .pipe(
        takeUntilDestroyed(this.destroy),
        finalize(() => this.enableForm()),
      )
      .subscribe({
        next: (t) => {
          this.saved.set(structuredClone(t));
          this.patch(t);
          this.status.set('ready');
        },
        error: (e) => this.fail(e),
      });
  }
  patch(t: Tenant) {
    this.original = structuredClone(t);
    this.form.controls.fields.patchValue({
      company_name: t.company_name,
      description: t.description,
      industry_id: t.industry_id,
      currency: t.subscription.currency,
      fee: t.subscription.fee,
      payment_method: t.subscription.payment_method,
      payment_method_description: t.subscription.payment_method_description || '',
      discount_type: t.subscription.discount.type,
      discount_value: t.subscription.discount.value,
      discount_duration: t.subscription.discount.duration,
      primary_colour: t.branding.primary_colour,
      secondary_colour: t.branding.secondary_colour,
      typography: t.branding.typography,
    });
    this.form.controls.company_name_display.setValue(t.company_name_display);
    this.form.controls.admins.setValue([...t.responsible_admin_ids]);
    this.contacts.clear();
    t.contacts.forEach((c) => this.contacts.push(this.contact(c)));
    this.form.markAsPristine();
  }
  draft(): Tenant {
    this.previewVersion();
    const f = this.form.controls.fields.getRawValue(),
      base = this.original;
    return {
      ...base,
      company_name: f['company_name'],
      company_name_display: this.form.controls.company_name_display.value,
      description: f['description'],
      industry_id: f['industry_id'],
      responsible_admin_ids: [...this.form.controls.admins.value],
      contacts: this.contacts.getRawValue().map((c) => ({
        ...base.contacts.find((old) => old.id && old.id === c.id),
        ...(c.id ? { id: c.id } : {}),
        name: c.name,
        email: c.email,
        phone: c.phone,
        primary: c.primary,
      })),
      branding: {
        ...base.branding,
        primary_colour: f['primary_colour'],
        secondary_colour: f['secondary_colour'],
        typography: f['typography'],
      },
      subscription: {
        ...base.subscription,
        currency: f['currency'],
        fee: f['fee'],
        payment_method: f['payment_method'],
        payment_method_description: f['payment_method_description'],
        discount: {
          ...base.subscription.discount,
          type: f['discount_type'],
          value: f['discount_value'],
          duration: f['discount_duration'],
        },
      },
    };
  }
  removeAsset(kind: AssetKind) {
    this.cancelFile(kind);
    this.original.branding[`${kind}_attachment_id`] = null;
    this.form.markAsDirty();
    this.previewVersion.update((v) => v + 1);
  }
  resetBranding() {
    this.form.controls.fields.patchValue({
      primary_colour: '#17365D',
      secondary_colour: '#2563EB',
      typography: 'system',
    });
    this.form.markAsDirty();
  }
  selectFile(kind: AssetKind, event: Event) {
    const input = event.target as HTMLInputElement,
      file = input.files?.[0];
    if (!file) return;
    this.cancelFile(kind);
    this.files.update((files) => ({ ...files, [kind]: file }));
    if (this.status() === 'success') this.status.set('ready');
    // Preview decoder capability only; not an invented upload acceptance policy.
    if (
      [
        'image/png',
        'image/jpeg',
        'image/gif',
        'image/webp',
        'image/x-icon',
        'image/vnd.microsoft.icon',
      ].includes(file.type)
    ) {
      this.urls.update((urls) => ({ ...urls, [kind]: URL.createObjectURL(file) }));
    }
    input.value = '';
    this.form.markAsDirty();
  }
  cancelFile(kind: AssetKind) {
    const previous = this.urls()[kind];
    if (previous) URL.revokeObjectURL(previous);
    this.files.update((files) => {
      const next = { ...files };
      delete next[kind];
      return next;
    });
    this.urls.update((urls) => {
      const next = { ...urls };
      delete next[kind];
      return next;
    });
  }
  submit() {
    if (this.status() === 'saving' || this.status() === 'loading') return;
    this.errors.set([]);
    this.serverErrors.set({});
    this.form.markAllAsTouched();
    if (!this.loaded) {
      this.fail(new Error('Load the saved tenant before editing.'));
      return;
    }
    const missingReference = FIELDS.some(
      (f) =>
        this.options.requiredFields.includes(f.path) &&
        !this.form.controls.fields.controls[f.key].getRawValue(),
    );
    if (this.form.invalid || missingReference) {
      this.fail(
        new Error(
          'Review required fields. Exactly one primary contact and valid entered email addresses are required.',
        ),
      );
      return;
    }
    if (!this.integrationReady) {
      this.fail(
        new Error(
          'Saving is temporarily unavailable. Your details are retained. Contact your platform administrator.',
        ),
      );
      return;
    }
    if (this.options.assignment === 'one' && this.form.controls.admins.value.length > 1) {
      this.fail(new Error('Choose exactly one responsible administrator for this company.'));
      return;
    }
    if (
      this.options.requiredFields.includes('subscription.fee') &&
      (!this.edit || this.commercialEditable)
    ) {
      const messages = commercialErrors(this.draft());
      if (messages.length) {
        this.fail(new Error(messages.join(' ')));
        return;
      }
    }
    if (Object.keys(this.files()).length && !this.upload) {
      this.fail(
        new Error('Image uploads are temporarily unavailable. Your selected files are retained.'),
      );
      return;
    }
    this.status.set('saving');
    this.form.disable({ emitEvent: false });
    const entries = Object.entries(this.files()) as [AssetKind, File][];
    from(entries)
      .pipe(
        concatMap(([kind, file]) =>
          this.upload!(kind, file, this.id).pipe(
            tap((asset) => {
              if (!asset.id)
                throw new Error('Upload returned no authorized attachment identifier.');
              this.original.branding[`${kind}_attachment_id`] = asset.id;
              this.cancelFile(kind);
            }),
          ),
        ),
        toArray(),
        switchMap(() => {
          const t = this.draft();
          // Explicit allowlist: never send platform states, schema identifiers, or unknown detail metadata.
          const payload: Tenant = {
            company_name: t.company_name,
            company_name_display: t.company_name_display,
            description: t.description,
            industry_id: t.industry_id,
            responsible_admin_ids: t.responsible_admin_ids,
            contacts: t.contacts.map((c) => ({
              ...(c.id ? { id: c.id } : {}),
              name: c.name,
              email: c.email,
              phone: c.phone,
              primary: c.primary,
            })),
            branding: {
              primary_colour: t.branding.primary_colour,
              secondary_colour: t.branding.secondary_colour,
              typography: t.branding.typography,
              logo_attachment_id: t.branding.logo_attachment_id,
              favicon_attachment_id: t.branding.favicon_attachment_id,
            },
            subscription: {
              currency: t.subscription.currency,
              fee: t.subscription.fee,
              payment_method: t.subscription.payment_method,
              payment_method_description: t.subscription.payment_method_description || '',
              discount: {
                type: t.subscription.discount.type,
                value: t.subscription.discount.value,
                duration: t.subscription.discount.duration,
              },
            },
          };
          if (this.edit && !this.commercialEditable) {
            delete (payload as Partial<Tenant>).subscription;
            delete (payload as Partial<Tenant>).responsible_admin_ids;
          }
          return this.gateway.save(payload, this.id);
        }),
        takeUntilDestroyed(this.destroy),
        finalize(() => this.enableForm()),
      )
      .subscribe({
        next: (t) => {
          const created = !this.id;
          this.id = t.id;
          this.saved.set(structuredClone(t));
          this.patch(t);
          this.status.set('success');
          if (created && t.id)
            void this.router.navigate(['/tenants', t.id, 'edit'], { replaceUrl: true });
        },
        error: (e) => this.fail(e),
      });
  }
  private fieldLabel(path: string) {
    const contact = /^contacts\.(\d+)\.(name|email|phone|primary)$/.exec(path);
    if (contact) return `Contact ${Number(contact[1]) + 1} ${contact[2]}`;
    return (
      FIELDS.find((field) => field.path === path)?.label ||
      (
        {
          contacts: 'Contacts',
          responsible_admin_ids: 'Responsible CPQ Admin',
          'branding.logo_attachment_id': 'Company logo',
          'branding.favicon_attachment_id': 'Favicon',
        } as Record<string, string>
      )[path] ||
      path.replaceAll('_', ' ').replaceAll('.', ' ')
    );
  }
  private fail(error: unknown) {
    let messages: string[];
    if (error instanceof HttpErrorResponse) {
      const fields = error.error?.error?.fields;
      this.serverErrors.set(
        fields && typeof fields === 'object'
          ? Object.fromEntries(
              Object.entries(fields).map(([key, value]) => [
                key,
                (Array.isArray(value) ? value : [value]).filter(
                  (v): v is string => typeof v === 'string',
                ),
              ]),
            )
          : {},
      );
      messages =
        fields && typeof fields === 'object'
          ? Object.entries(fields).flatMap(([key, value]) =>
              (Array.isArray(value) ? value : [value])
                .filter((v) => typeof v === 'string')
                .map((v) => `${this.fieldLabel(key)}: ${v}`),
            )
          : [];
      messages.unshift(
        (
          {
            401: 'Administrator login is required.',
            403: 'You do not have access to this tenant.',
            404: 'This tenant could not be found or is unavailable to your account.',
            409: 'This tenant changed or cannot be updated. Reload before retrying.',
            0: 'We couldn’t connect. Your entered details are retained.',
          } as Record<number, string>
        )[error.status] ||
          'We couldn’t save or load this tenant. Your entered details are retained.',
      );
    } else
      messages = [
        error instanceof Error ? error.message : 'The operation failed. Your draft is retained.',
      ];
    this.errors.set(messages);
    this.status.set('failed');
    afterNextRender(() => this.summary()?.nativeElement.focus(), { injector: this.injector });
  }
}
