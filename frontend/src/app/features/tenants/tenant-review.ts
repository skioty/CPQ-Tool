import { Component, input, output } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { Tenant, FormOptions } from '../../tenant/tenant.types';

@Component({
  selector: 'app-tenant-review',
  imports: [DecimalPipe],
  template: `
    <div class="review-heading">
      <div>
        <p class="eyebrow">FINAL REVIEW</p>
        <h2>{{ tenant().company_name }}</h2>
        <p>Confirm the details before creating this workspace.</p>
      </div>
      <span class="badge" data-status="inactive">Creates as Inactive</span>
    </div>
    <div class="review-columns">
      <div class="review-sections">
        <section class="review-card">
          <header>
            <h2>Organization</h2>
            <button
              type="button"
              (click)="editSection.emit('Company')"
              aria-label="Edit organization"
            >
              ✎ Edit
            </button>
          </header>
          <dl>
            <dt>Company name</dt>
            <dd>{{ tenant().company_name }}</dd>
            <dt>Display name</dt>
            <dd>{{ tenant().display_name || 'Not provided' }}</dd>
            <dt>Country</dt>
            <dd>{{ referenceLabel('country', tenant().country) }}</dd>
            <dt>Time zone</dt>
            <dd>{{ referenceLabel('time_zone', tenant().time_zone) }}</dd>
            <dt>User limit</dt>
            <dd>{{ tenant().user_limit }} seats (primary contact included)</dd>
            <dt>Description</dt>
            <dd>{{ tenant().description || 'Not provided' }}</dd>
            <dt>Industry</dt>
            <dd>{{ label('industries', tenant().industry_id) }}</dd>
            <dt>Responsible SELISE CPQ Admin</dt>
            <dd>{{ label('admins', tenant().responsible_admin_ids[0]) }}</dd>
          </dl>
        </section>
        <section class="review-card">
          <header>
            <h2>
              Contacts <span class="muted">({{ tenant().contacts.length }})</span>
            </h2>
            <button type="button" (click)="editSection.emit('Contacts')" aria-label="Edit contacts">
              ✎ Edit
            </button>
          </header>
          @for (contact of tenant().contacts; track $index) {
            <div class="review-contact">
              <strong>{{ contact.name }}</strong>
              @if (contact.primary) {
                <span class="badge" data-status="active">Primary contact</span>
              }
              <p>{{ contact.email }}</p>
              @if (contact.phone) {
                <p>{{ contact.phone }}</p>
              }
            </div>
          }
          <p class="review-note">
            Primary contact role: Tenant Admin.
            <img src="/design/shield.svg" alt="" />Contacts remain contacts. Invite users separately
            after creation.
          </p>
        </section>
        <section class="review-card">
          <header>
            <h2>Branding</h2>
            <button type="button" (click)="editSection.emit('Branding')" aria-label="Edit branding">
              ✎ Edit
            </button>
          </header>
          <div class="review-brand">
            <span
              class="review-colour"
              [style.background-color]="tenant().branding.primary_colour"
            ></span
            ><span
              class="review-colour"
              [style.background-color]="tenant().branding.secondary_colour"
            ></span>
            <div>
              <strong>{{ label('typography', tenant().branding.typography) }}</strong>
              <p>
                {{ tenant().branding.primary_colour }} · {{ tenant().branding.secondary_colour }}
              </p>
            </div>
          </div>
          <p>
            Company logo:
            {{
              tenant().branding.logo_attachment_id ? 'Saved asset' : 'Default or selected upload'
            }}
            · Favicon:
            {{
              tenant().branding.favicon_attachment_id ? 'Saved asset' : 'Default or selected upload'
            }}
          </p>
        </section>
      </div>
      <aside class="review-card pricing-summary">
        <header>
          <h2>Pricing summary</h2>
          <button
            type="button"
            (click)="editSection.emit('Subscription')"
            aria-label="Edit subscription"
          >
            ✎ Edit
          </button>
        </header>
        <p class="eyebrow">MONTHLY SUBSCRIPTION</p>
        <div class="price">
          {{ fee() | number: '1.2-2' }} <small>{{ tenant().subscription.currency }}</small>
        </div>
        <p class="muted">per month</p>
        <dl>
          <dt>Payment method</dt>
          <dd>{{ label('paymentMethods', tenant().subscription.payment_method) }}</dd>
          <dt>Subscription discount</dt>
          <dd>{{ tenant().subscription.discount.value || '0' }}%</dd>
          <dt>Discount duration</dt>
          <dd>
            {{ tenant().subscription.discount.duration || 'Not applied'
            }}{{ tenant().subscription.discount.duration ? ' monthly cycles' : '' }}
          </dd>
        </dl>
        <div class="price-estimate">
          <span>Estimated during discount</span
          ><strong
            >{{ effective() | number: '1.2-2' }} {{ tenant().subscription.currency }} /
            month</strong
          >
        </div>
        <p class="muted">
          A subscription estimate, not an invoice or a payment. The base monthly fee resumes after
          the discount duration.
        </p>
      </aside>
    </div>
    <p class="review-note activation-note">
      <img src="/design/alert-circle.svg" alt="" />The tenant is created as Inactive. Review setup
      and activate explicitly. User invitations are separate.
    </p>
  `,
  styles: `
    :host {
      display: block;
    }
    .review-heading {
      display: flex;
      justify-content: space-between;
      gap: 20px;
      align-items: start;
      margin: 0 0 24px;
    }
    .review-heading p {
      color: var(--muted);
    }
    .review-columns {
      display: grid;
      grid-template-columns: minmax(0, 1.8fr) minmax(260px, 1fr);
      gap: 24px;
      align-items: start;
    }
    .review-sections {
      display: grid;
      gap: 20px;
    }
    .review-card {
      padding: 24px;
      background: white;
      border: 1px solid var(--line);
      border-radius: 8px;
      min-width: 0;
    }
    .review-card header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      margin-bottom: 20px;
    }
    .review-card header h2 {
      font-size: 18px;
      margin: 0;
    }
    .review-card header button {
      font-size: 13px;
      min-height: 38px;
      padding: 6px 12px;
    }
    .review-card dl {
      display: grid;
      grid-template-columns: minmax(100px, 0.8fr) minmax(0, 1.4fr);
      gap: 12px;
      font-size: 14px;
      margin: 0;
    }
    .review-card dt {
      color: var(--muted);
    }
    .review-card dd {
      margin: 0;
      overflow-wrap: anywhere;
    }
    .review-contact {
      padding: 12px 0;
      border-bottom: 1px solid var(--line);
    }
    .review-contact .badge {
      margin-left: 10px;
    }
    .review-contact p,
    .review-brand p {
      color: var(--muted);
      font-size: 12px;
      margin: 4px 0;
    }
    .review-note {
      display: flex;
      gap: 8px;
      align-items: start;
      color: var(--muted);
      font-size: 12px;
      margin-top: 20px;
    }
    .review-note img {
      flex-shrink: 0;
      margin-top: 2px;
    }
    .review-brand {
      display: flex;
      gap: 12px;
      align-items: center;
      margin-bottom: 16px;
    }
    .review-colour {
      height: 32px;
      width: 32px;
      border-radius: 6px;
      border: 1px solid var(--line);
    }
    .price {
      font-size: 30px;
      font-weight: 600;
    }
    .price small {
      font-size: 14px;
      font-weight: 400;
    }
    .pricing-summary {
      position: sticky;
      top: 24px;
    }
    .pricing-summary dl {
      grid-template-columns: 1fr;
      margin: 24px 0;
      gap: 5px;
    }
    .pricing-summary dd {
      margin-bottom: 12px;
    }
    .price-estimate {
      background: var(--accent-soft);
      padding: 16px;
      border-radius: 6px;
      margin: 20px 0;
    }
    .price-estimate span,
    .price-estimate strong {
      display: block;
    }
    .price-estimate span {
      font-size: 12px;
      color: var(--muted);
    }
    .pricing-summary > p:last-child {
      font-size: 12px;
    }
    .activation-note {
      padding: 18px;
      background: var(--accent-soft);
      border-radius: 8px;
    }
    @media (max-width: 800px) {
      .review-columns {
        grid-template-columns: 1fr;
      }
      .pricing-summary {
        position: static;
      }
      .review-heading {
        flex-wrap: wrap;
      }
      .review-card dl {
        grid-template-columns: 1fr;
        gap: 4px;
      }
      .review-card dd {
        margin-bottom: 10px;
      }
    }
  `,
})
export class TenantReview {
  readonly tenant = input.required<Tenant>();
  readonly options = input.required<FormOptions>();
  readonly editSection = output<string>();
  referenceLabel(kind: string, value: string | undefined) {
    const choices = kind === 'country' ? this.options().countries : this.options().timeZones;
    return choices?.find((c) => c.id === value)?.label || value || 'Not provided';
  }
  label(key: 'industries' | 'admins' | 'typography' | 'paymentMethods', value: string | undefined) {
    return this.options()[key].find((c) => c.id === value)?.label || value || 'Not specified';
  }
  fee() {
    return Number(this.tenant().subscription.fee) || 0;
  }
  effective() {
    return this.fee() * (1 - (Number(this.tenant().subscription.discount.value) || 0) / 100);
  }
}
