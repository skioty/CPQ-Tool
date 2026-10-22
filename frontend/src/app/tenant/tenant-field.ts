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
        [attr.aria-describedby]="field().key + '-help'"
        rows="3"
      ></textarea>
    } @else if (field().kind === 'select') {
      <select
        [id]="field().key"
        [formControl]="control()"
        [attr.disabled]="!choices().length ? '' : null"
        [attr.aria-describedby]="field().key + '-help'"
      >
        <option value="">
          {{ choices().length ? 'Select an option' : 'Awaiting approved reference data' }}
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
        [id]="field().key"
        [formControl]="control()"
        [attr.aria-describedby]="field().key + '-help'"
      />
    }
    <small [id]="field().key + '-help'">{{
      field().help || 'Requiredness follows the approved contract.'
    }}</small>
    @if (control().touched && control().invalid) {
      <p class="error" role="alert">{{ field().label }} is required.</p>
    }
  `,
  styles: `
    :host {
      display: grid;
      align-content: start;
      gap: 7px;
      min-width: 0;
    }
    label {
      font-weight: 600;
    }
    small {
      color: #53627a;
      line-height: 1.4;
    }
    input,
    textarea,
    select {
      box-sizing: border-box;
      width: 100%;
      border: 1px solid #aebdd0;
      border-radius: 8px;
      padding: 11px;
      font: inherit;
      background: #fff;
      color: #14243b;
    }
    :is(input, textarea, select):focus-visible {
      outline: 3px solid #7464cf;
      outline-offset: 2px;
    }
    .error {
      color: #9e2037;
      margin: 0;
    }
  `,
})
export class TenantField {
  readonly field = input.required<Field>();
  readonly control = input.required<FormControl<string>>();
  readonly choices = input<Choice[]>([]);
  readonly required = input(false);
  known() {
    return this.choices().some((x) => x.id === this.control().value);
  }
}
