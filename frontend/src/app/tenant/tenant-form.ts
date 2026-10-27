import { TenantReview } from '../features/tenants/tenant-review';
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
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import {
  Observable,
  Subscription,
  concatMap,
  finalize,
  from,
  switchMap,
  tap,
  toArray,
  of,
} from 'rxjs';
import { TenantDirectory } from '../navigation/tenant-directory';
import { CreationNotice } from '../navigation/creation-notice';
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
    key: 'display_name',
    path: 'display_name',
    label: 'Company display name (optional)',
    section: 'Company',
  },
  {
    key: 'country',
    path: 'country',
    label: 'Country (optional)',
    section: 'Company',
    kind: 'search',
  },
  {
    key: 'user_limit',
    path: 'user_limit',
    label: 'User limit',
    section: 'Company',
    help: 'Active users plus pending invitations, including a reserved primary-contact seat. Each email counts once.',
  },
  {
    key: 'primary_contact_role',
    path: 'primary_contact_role',
    label: 'Primary contact role',
    section: 'Contacts',
    kind: 'select',
    help: 'Tenant Admin is the only approved tenant role. Access requires a separate invitation and acceptance.',
  },
  {
    key: 'time_zone',
    path: 'time_zone',
    label: 'Time zone (optional)',
    section: 'Company',
    kind: 'search',
    help: 'Search an IANA time zone. Shown UTC offsets are current and may change with daylight saving time.',
  },
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
    help: 'If your industry is not listed, Super Admins can choose “Create your own industry” and enter its name.',
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
    kind: 'colour',
    section: 'Branding',
    help: 'Six-digit colour code, for example #17365D.',
  },
  {
    key: 'secondary_colour',
    path: 'branding.secondary_colour',
    label: 'Secondary colour',
    kind: 'colour',
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
  imports: [ReactiveFormsModule, RouterLink, TenantField, BrandingPreview, TenantReview],
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
  private readonly http = inject(HttpClient, { optional: true });
  private readonly directory = this.http ? inject(TenantDirectory) : null;
  private readonly notice = inject(CreationNotice);
  readonly customIndustryName = new FormControl('', { nonNullable: true });
  get creatingIndustry() {
    return this.form.controls.fields.controls['industry_id'].value === '__create_industry__';
  }
  readonly industryBusy = signal(false);
  readonly industryMessage = signal('');

  selectedIndustry() {
    return (
      this.options.industries.find(
        (option) => option.id === this.form.controls.fields.controls['industry_id'].value,
      ) || null
    );
  }
  createIndustry() {
    if (!this.options.canManageIndustries || this.industryBusy()) return;
    if (!this.creatingIndustry) {
      this.form.controls.fields.controls['industry_id'].setValue('__create_industry__');
      return;
    }
    this.customIndustryName.markAsTouched();
    if (this.customIndustryName.invalid) return;
    this.industryBusy.set(true);
    this.industryMessage.set('');
    this.resolveIndustry()
      .pipe(
        takeUntilDestroyed(this.destroy),
        finalize(() => this.industryBusy.set(false)),
      )
      .subscribe({
        next: () => {
          this.form.markAsDirty();
          this.industryMessage.set('Industry created and selected.');
        },
        error: (error) =>
          this.industryMessage.set(
            error?.error?.error?.message || 'Could not create industry. Please retry.',
          ),
      });
  }
  reviewOptions() {
    return this.creatingIndustry
      ? {
          ...this.options,
          industries: [
            ...this.options.industries,
            { id: '__create_industry__', label: this.customIndustryName.value.trim() },
          ],
        }
      : this.options;
  }
  private resolveIndustry(): Observable<unknown> {
    if (!this.creatingIndustry) return of(null);
    if (!this.http) throw new Error('Reference options are unavailable');
    return this.http
      .post<{ data: { code: string; label: string } }>('/api/v1/reference_options', {
        option: {
          kind: 'industry',
          code: 'custom_' + crypto.randomUUID(),
          label: this.customIndustryName.value.trim(),
        },
      })
      .pipe(
        tap((r) => {
          this.options.industries.push({ id: r.data.code, label: r.data.label });
          this.form.controls.fields.controls['industry_id'].setValue(r.data.code);
        }),
      );
  }
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
  readonly previewSaved = signal(false);
  readonly files = signal<Partial<Record<AssetKind, File>>>({});
  readonly urls = signal<Partial<Record<AssetKind, string>>>({});
  readonly sections = ['Company', 'Contacts', 'Branding', 'Subscription'];
  readonly primaryRoleField = FIELDS.find((f) => f.key === 'primary_contact_role')!;
  readonly registrationSteps = ['Organization details', 'Tenant registration', 'Review & create'];
  readonly step = signal(0);
  readonly activeSection = signal('Company');
  visibleSection(section: string) {
    return this.edit
      ? section === this.activeSection()
      : this.step() === (['Company', 'Contacts'].includes(section) ? 0 : 1);
  }
  onFormSubmit() {
    if (this.industryBusy()) return;
    if (this.edit || this.step() === 2) this.submit();
    else this.advance();
  }
  goStep(next: number) {
    if (next <= this.step()) {
      this.step.set(next);
      this.errors.set([]);
      return;
    }
    while (this.step() < next) {
      if (!this.advance()) break;
    }
  }
  advance() {
    this.errors.set([]);
    this.customIndustryName.markAsTouched();
    if (this.step() === 0) {
      const controls = [
        this.form.controls.fields.controls['company_name'],
        this.form.controls.fields.controls['industry_id'],
        this.form.controls.admins,
        this.contacts,
        this.form.controls.fields.controls['user_limit'],
        this.form.controls.fields.controls['primary_contact_role'],
        this.form.controls.fields.controls['country'],
        this.form.controls.fields.controls['time_zone'],
      ];
      controls.forEach((c) => c.markAllAsTouched());
      if (
        controls.some((c) => c.invalid) ||
        (this.creatingIndustry && this.customIndustryName.invalid)
      ) {
        this.fail(
          new Error(
            'Complete the organization details, choose a responsible administrator and select exactly one primary contact.',
          ),
        );
        return false;
      }
    } else {
      this.form.markAllAsTouched();
      const errors =
        this.commercialEditable && this.options.contractApproved
          ? commercialErrors(this.draft())
          : [];
      if (this.form.invalid || errors.length) {
        this.fail(
          new Error(errors.join(' ') || 'Review the highlighted fields before continuing.'),
        );
        return false;
      }
    }
    this.step.update((step) => Math.min(2, step + 1));
    return true;
  }
  reviewEdit(section: string) {
    this.step.set(['Company', 'Contacts'].includes(section) ? 0 : 1);
    this.activeSection.set(section);
    afterNextRender(() => document.getElementById('section-' + section.toLowerCase())?.focus(), {
      injector: this.injector,
    });
  }
  sectionLabel(section: string) {
    return (
      (
        {
          Company: 'Basic details',
          Contacts: 'Contacts',
          Branding: 'Branding',
          Subscription: 'Billing',
        } as Record<string, string>
      )[section] || section
    );
  }

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
      'display_name',
      'description',
      'country',
      'time_zone',
      'industry_id',
      'user_limit',
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
            validators:
              f.key === 'user_limit'
                ? [
                    Validators.required,
                    Validators.pattern(/^[1-9]\d*$/),
                    Validators.max(2147483647),
                  ]
                : f.key === 'primary_contact_role'
                  ? [Validators.required, Validators.pattern(/^tenant_admin$/)]
                  : f.kind === 'colour'
                    ? [Validators.pattern(/^#[0-9a-f]{6}$/i)]
                    : this.options.requiredFields.includes(f.path)
                      ? [Validators.required]
                      : [],
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
    this.form.controls.fields.controls['industry_id'].valueChanges
      .pipe(takeUntilDestroyed(this.destroy))
      .subscribe((value) => {
        if (value === '__create_industry__')
          afterNextRender(
            () => {
              const field = document.getElementById('custom-industry-name');
              field?.focus();
              field?.scrollIntoView?.({ block: 'center' });
            },
            {
              injector: this.injector,
            },
          );
        this.customIndustryName.setValidators(
          value === '__create_industry__'
            ? [
                Validators.required,
                Validators.pattern(/\S/),
                Validators.maxLength(120),
                (control) =>
                  this.options.industries.some(
                    (c) => c.label.toLocaleLowerCase() === control.value.trim().toLocaleLowerCase(),
                  )
                    ? { duplicate: true }
                    : null,
              ]
            : [],
        );
        this.customIndustryName.updateValueAndValidity();
      });
    this.enableForm();
    this.destroy.onDestroy(() =>
      Object.values(this.urls()).forEach((url) => URL.revokeObjectURL(url)),
    );
    this.form.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => {
      this.previewSaved.set(false);
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
    this.route.fragment?.pipe(takeUntilDestroyed(this.destroy)).subscribe((fragment) => {
      const section = this.sections.find((s) => fragment === 'section-' + s.toLowerCase());
      if (section) {
        this.activeSection.set(section);
        this.step.set(['Company', 'Contacts'].includes(section) ? 0 : 1);
      }
    });
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
          industry_id: [
            ...this.options.industries,
            ...(this.options.canManageIndustries
              ? [{ id: '__create_industry__', label: 'Create your own industry' }]
              : []),
          ],
          country: this.options.countries || [],
          time_zone: this.options.timeZones || [],
          primary_contact_role: [{ id: 'tenant_admin', label: 'Tenant Admin' }],
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
      display_name: t.display_name || '',
      country: t.country || '',
      time_zone: t.time_zone || '',
      user_limit: t.user_limit?.toString() || '',
      primary_contact_role: t.primary_contact_role || 'tenant_admin',
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
      display_name: f['display_name'],
      country: f['country'],
      time_zone: f['time_zone'],
      user_limit: Number(f['user_limit']),
      primary_contact_role: f['primary_contact_role'],
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
    this.previewSaved.set(false);
    this.form.controls.fields.patchValue({
      primary_colour: '#17365D',
      secondary_colour: '#2563EB',
      typography: 'system',
    });
    this.form.markAsDirty();
  }
  cancelBrandingChanges() {
    const branding = this.saved()?.branding;
    this.form.controls.fields.patchValue({
      primary_colour: branding?.primary_colour || '#17365D',
      secondary_colour: branding?.secondary_colour || '#2563EB',
      typography: branding?.typography || 'system',
    });
    this.original.branding = { ...(branding || emptyTenant().branding) };
    this.assetKinds.forEach((kind) => this.cancelFile(kind));
    this.previewSaved.set(false);
    this.previewVersion.update((v) => v + 1);
  }
  selectFile(kind: AssetKind, event: Event) {
    this.previewSaved.set(false);
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
    if (this.industryBusy() || this.status() === 'saving' || this.status() === 'loading') return;
    this.errors.set([]);
    this.serverErrors.set({});
    this.form.markAllAsTouched();
    this.customIndustryName.markAsTouched();
    if (!this.loaded) {
      this.fail(new Error('Load the saved tenant before editing.'));
      return;
    }
    const missingReference = FIELDS.some(
      (f) =>
        this.options.requiredFields.includes(f.path) &&
        !this.form.controls.fields.controls[f.key].getRawValue(),
    );
    if (
      this.form.invalid ||
      missingReference ||
      (this.creatingIndustry && this.customIndustryName.invalid)
    ) {
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
    this.resolveIndustry()
      .pipe(
        switchMap(() => from(entries)),
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
            display_name: t['display_name'],
            country: t['country'],
            time_zone: t['time_zone'],
            user_limit: t.user_limit,
            primary_contact_role: t.primary_contact_role,
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
          if (created && t.id) {
            this.directory?.view.set({ query: '', status: '', industry: '', page: 1, perPage: 20 });
            this.notice.created();
            void this.router.navigate(['/tenants'], { replaceUrl: true });
          }
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
