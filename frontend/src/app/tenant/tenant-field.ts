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
        [attr.aria-describedby]="field().help ? field().key + '-help' : null"
        rows="3"
      ></textarea>
    } @else if (field().kind === 'select') {
      <select
        [id]="field().key"
        [formControl]="control()"
        [attr.disabled]="!choices().length ? '' : null"
        [attr.aria-describedby]="field().help ? field().key + '-help' : null"
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
        [id]="field().key"
        [formControl]="control()"
        [attr.aria-describedby]="field().help ? field().key + '-help' : null"
      />
    }
    @if (field().help) {
      <small [id]="field().key + '-help'">{{ field().help }}</small>
    }
    @if (control().touched && control().invalid) {
      <p class="error" role="alert">{{ field().label }} is required.</p>
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
      font-size: 12px;
      color: #536175;
      font-weight: 550;
    }
    label span {
      color: #687487;
      font-size: 10px;
      font-weight: 400;
    }
    input,
    select,
    textarea {
      width: 100%;
      font-size: 12px;
      min-height: 44px;
    }
    textarea {
      resize: vertical;
      min-height: 106px;
    }
    small {
      color: #687487;
      font-size: 10px;
      line-height: 1.6;
    }
    .error {
      font-size: 11px;
      color: #bd4e40;
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
    return this.choices().some((option) => option.id === this.control().value);
  }
}
