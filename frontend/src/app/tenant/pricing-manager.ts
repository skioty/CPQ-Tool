import { Component, inject, signal } from '@angular/core';

import { FormsModule } from '@angular/forms';

import { HttpClient } from '@angular/common/http';

import { PricingTier } from './tenant.types';

import { ReferenceResponse } from './reference-data';

@Component({
  selector: 'app-pricing-manager',
  imports: [FormsModule],

  template: `<section class="card" aria-labelledby="pricing-title">
    <h2 id="pricing-title">Automatic subscription pricing</h2>

    <p class="muted">
      Set monthly fees by currency and user limit. Saving tiers does not change existing tenant
      fees.
    </p>
    <details class="pricing-guidance">
      <summary>How pricing tiers work</summary>
      <p>
        Ranges include both endpoints and cannot overlap within a currency. BTN tiers are the
        conversion base when no currency-specific tier exists. No default prices are supplied.
        Tenant fees are recalculated when their user limit, currency or pricing mode changes.
      </p>
    </details>

    @if (message()) {
      <p role="status">{{ message() }}</p>
    }

    @if (error()) {
      <p class="error" role="alert">{{ error() }}</p>
    }

    <form #pricing="ngForm" (ngSubmit)="save()" [attr.aria-busy]="busy()">
      <fieldset [disabled]="busy() || !loaded()">
        @for (tier of tiers; track $index; let i = $index) {
          <div class="tier">
            <label
              >Currency<select [(ngModel)]="tier.currency" [name]="'currency' + i" required>
                <option value="">Select currency</option>

                @for (c of currencies(); track c.code) {
                  <option [value]="c.code">{{ c.label }}</option>
                }

                @if (tier.currency && !knownCurrency(tier.currency)) {
                  <option [value]="tier.currency">{{ tier.currency }} (unavailable)</option>
                }
              </select></label
            >

            <label
              >From users<input
                type="number"
                min="1"
                max="2147483647"
                step="1"
                required
                [(ngModel)]="tier.min_users"
                [name]="'min' + i"
            /></label>

            <label
              >To users<input
                type="number"
                min="1"
                max="2147483647"
                step="1"
                required
                [(ngModel)]="tier.max_users"
                [name]="'max' + i"
            /></label>

            <label
              >Monthly fee<input
                inputmode="decimal"
                required
                pattern="[0-9]+([.][0-9]{1,2})?"
                [(ngModel)]="tier.fee"
                [name]="'fee' + i"
            /></label>

            <button
              type="button"
              (click)="tiers.splice(i, 1)"
              [attr.aria-label]="'Remove tier ' + (i + 1)"
            >
              Remove
            </button>
          </div>
        } @empty {
          <p>No automatic pricing tiers configured. Custom pricing remains available.</p>
        }

        <div class="actions">
          <button type="button" (click)="add()">Add tier</button>

          <button type="submit" class="primary" [disabled]="pricing.invalid || busy()">
            {{ busy() ? 'Saving…' : 'Save pricing tiers' }}
          </button>

          <button type="button" (click)="load()">Reload saved tiers</button>
        </div>
      </fieldset>
    </form>

    @if (!loaded() && !busy()) {
      <button type="button" (click)="load()">Retry loading pricing</button>
    }
  </section>`,

  styles: `
    .pricing-guidance {
      margin: 12px 0 24px;
      color: var(--muted);
    }
    summary {
      cursor: pointer;
      min-height: 44px;
      align-content: center;
      color: var(--accent);
      font-weight: 600;
    }
    .pricing-guidance p {
      max-width: 72ch;
      margin: 8px 0;
    }

    :host {
      display: block;
      margin-bottom: 24px;
    }
    fieldset {
      border: 0;
      padding: 0;
      margin: 0;
      min-inline-size: 0;
    }
    .tier {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr)) auto;
      gap: 16px;
      align-items: end;
      margin: 20px 0;
    }
    label {
      display: grid;
      gap: 8px;
      min-width: 0;
      overflow-wrap: anywhere;
      font-size: 13px;
    }
    input,
    select {
      width: 100%;
      min-width: 0;
    }
    .actions {
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
    }
    .error {
      color: var(--danger);
    }
    @media (max-width: 900px) {
      .tier {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }
    }
    @media (max-width: 520px) {
      .tier {
        grid-template-columns: 1fr;
      }
    }
  `,
})
export class PricingManager {
  private http = inject(HttpClient);

  tiers: PricingTier[] = [];

  private version = 0;

  currencies = signal<ReferenceResponse['data']>([]);

  loaded = signal(false);
  busy = signal(false);
  message = signal('');
  error = signal('');

  constructor() {
    this.http.get<ReferenceResponse>('/api/v1/reference_options').subscribe({
      next: (r) => this.currencies.set(r.data.filter((o) => o.kind === 'currency' && o.enabled)),
      error: () =>
        this.error.set(
          'Currencies could not be loaded. Reload this page before configuring pricing.',
        ),
    });

    this.load();
  }

  knownCurrency(code: string) {
    return this.currencies().some((c) => c.code === code);
  }

  add() {
    this.tiers.push({ currency: '', min_users: 1, max_users: 25, fee: '' });
  }

  load() {
    this.busy.set(true);
    this.error.set('');
    this.message.set('');

    this.http
      .get<{ data: { tiers: PricingTier[]; lock_version: number } }>('/api/v1/subscription_pricing')
      .subscribe({
        next: (r) => {
          this.tiers = r.data.tiers;
          this.version = r.data.lock_version;
          this.loaded.set(true);
          this.busy.set(false);
        },
        error: () => {
          this.busy.set(false);
          this.loaded.set(false);
          this.error.set('Could not load pricing tiers. Retry before saving.');
        },
      });
  }

  save() {
    if (this.busy() || !this.loaded()) return;

    this.busy.set(true);
    this.error.set('');
    this.message.set('');

    this.http
      .patch<{ data: { tiers: PricingTier[]; lock_version: number } }>(
        '/api/v1/subscription_pricing',
        { pricing: { tiers: this.tiers, lock_version: this.version } },
      )
      .subscribe({
        next: (r) => {
          this.version = r.data.lock_version;
          this.tiers = r.data.tiers;
          this.busy.set(false);
          this.message.set('Pricing tiers saved. Existing tenant fees are unchanged.');
        },
        error: (e) => {
          this.busy.set(false);
          this.error.set(
            e.error?.error?.message || 'Pricing could not be saved. Your entries are retained.',
          );
        },
      });
  }
}
