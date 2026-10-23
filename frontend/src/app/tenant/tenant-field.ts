import { Component, input } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { Choice } from './tenant.types';

export interface Field {
  key: string;
  path: string;
  label: string;
  section: string;
  kind?: 'select' | 'textarea';
  help?: string;
}
@Component({
  selector: 'app-tenant-field',
  imports: [ReactiveFormsModule],
  template: `
    <label [for]="field().key"
      >{{ field().label }}
      @if (required()) {
        <span> (required)</span>
      }
    </label>
    @if (field().kind === 'textarea') {
      <textarea
        [id]="field().key"
        [formControl]="control()"
        [attr.aria-describedby]="describedBy()"
        [attr.aria-invalid]="invalid() ? 'true' : null"
        [attr.aria-required]="required()"
        rows="3"
      ></textarea>
    } @else if (field().kind === 'select') {
      <select
        [id]="field().key"
        [formControl]="control()"
        [attr.disabled]="!choices().length ? '' : null"
        [attr.aria-describedby]="describedBy()"
        [attr.aria-invalid]="invalid() ? 'true' : null"
        [attr.aria-required]="required()"
      >
        <option value="">
          {{ choices().length ? 'Select an option' : 'No options available' }}
        </option>
        @if (control().value && !known()) {
          <option [value]="control().value">Current saved value: {{ control().value }}</option>
        }
        @for (option of choices(); track option.id) {
          <option [value]="option.id">{{ option.label }}</option>
        }
      </select>
    } @else {
      <input
        [attr.inputmode]="numeric() ? 'decimal' : null"
        [id]="field().key"
        [formControl]="control()"
        [attr.aria-describedby]="describedBy()"
        [attr.aria-invalid]="invalid() ? 'true' : null"
        [attr.aria-required]="required()"
      />
    }
    @if (field().help) {
      <small [id]="field().key + '-help'">{{ field().help }}</small>
    }
    @if (invalid()) {
      <p class="error" role="alert" [id]="field().key + '-error'">
        {{ serverErrors().length ? serverErrors().join(' ') : field().label + ' is required.' }}
      </p>
    }
  `,
  styles: `
    :host {
      display: grid;
      align-content: start;
      gap: 8px;
      min-width: 0;
    }
    label {
      font-size: 14px;
      color: #536175;
      font-weight: 550;
    }
    label span {
      color: #687487;
      font-size: 12px;
      font-weight: 400;
    }
    input,
    select,
    textarea {
      width: 100%;
      font-size: 14px;
      min-height: 44px;
    }
    textarea {
      resize: vertical;
      min-height: 106px;
    }
    small {
      color: #687487;
      font-size: 12px;
      line-height: 1.6;
    }
    .error {
      font-size: 13px;
      color: var(--danger);
      margin: 0;
    }
  `,
})
export class TenantField {
  readonly field = input.required<Field>();
  readonly control = input.required<FormControl<string>>();
  readonly choices = input<Choice[]>([]);
  readonly required = input(false);
  readonly serverErrors = input<string[]>([]);
  invalid() {
    return (this.control().touched && this.control().invalid) || this.serverErrors().length > 0;
  }
  numeric() {
    return ['fee', 'discount_value', 'discount_duration'].includes(this.field().key);
  }
  describedBy() {
    return (
      [
        this.field().help ? this.field().key + '-help' : '',
        this.invalid() ? this.field().key + '-error' : '',
      ]
        .filter(Boolean)
        .join(' ') || null
    );
  }
  known() {
    return this.choices().some((option) => option.id === this.control().value);
  }
}
