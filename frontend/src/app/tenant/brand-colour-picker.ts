import { Component, input, signal } from '@angular/core';
import { FormControl } from '@angular/forms';
import { brandingInk, colourContrast } from './branding-colour';
@Component({
  selector: 'app-brand-colour-picker',
  template: `<div class="colour-control">
    <div class="current-row">
      <span
        class="swatch"
        [style.background]="valid(control().value) ? control().value : defaultColour()"
        aria-hidden="true"
      ></span
      ><input
        [id]="id()"
        [value]="control().value"
        [disabled]="control().disabled"
        (input)="direct($event)"
        [attr.aria-label]="label() + ' HEX'"
        [attr.aria-describedby]="description()"
        [attr.aria-invalid]="control().touched && control().invalid"
        maxlength="7"
        placeholder="#17365D"
      /><button
        type="button"
        [attr.aria-label]="'Choose ' + label()"
        [disabled]="control().disabled"
        (click)="start()"
      >
        Choose colour
      </button>
    </div>
    @if (editing()) {
      <section
        class="editor"
        [attr.aria-label]="label() + ' colour editor'"
        (keydown.escape)="cancel()"
      >
        <label [for]="id() + '-spectrum'">{{ label() }} spectrum</label
        ><input
          type="color"
          [id]="id() + '-spectrum'"
          [value]="valid(candidate()) ? candidate() : defaultColour()"
          (input)="candidate.set($any($event.target).value)"
        /><label [for]="id() + '-hex'">HEX colour</label
        ><input
          [id]="id() + '-hex'"
          [value]="candidate()"
          maxlength="7"
          (input)="candidate.set($any($event.target).value)"
          [attr.aria-invalid]="!valid(candidate())"
        />
        <div class="samples">
          <div>
            <small>Current draft</small
            ><span
              [style.background]="valid(control().value) ? control().value : defaultColour()"
              [style.color]="ink(valid(control().value) ? control().value : defaultColour())"
              >{{ control().value || defaultColour() }}</span
            >
          </div>
          <div>
            <small>New selection</small
            ><span
              [style.background]="valid(candidate()) ? candidate() : defaultColour()"
              [style.color]="ink(valid(candidate()) ? candidate() : defaultColour())"
              >{{ candidate() }}</span
            >
          </div>
        </div>
        @if (!valid(candidate())) {
          <p class="error" role="alert">Enter a six-digit HEX colour, such as #17365D.</p>
        } @else {
          <p class="guidance" role="status">
            White-text contrast: {{ whiteContrast() }}:1.
            {{
              lowContrast()
                ? 'Below 4.5:1; the dashboard uses dark text on this colour to keep it readable.'
                : 'White text meets normal-text contrast guidance.'
            }}
          </p>
          @if (lowContrast()) {
            <button type="button" (click)="candidate.set('#17365D')">
              Preview accessible alternative
            </button>
          }
        }
        <div class="actions">
          <button type="button" (click)="apply()" [disabled]="!valid(candidate())">
            Apply to preview</button
          ><button type="button" (click)="cancel()">Cancel</button
          ><button type="button" (click)="candidate.set(defaultColour())">Reset to Default</button>
        </div>
        <small>Apply changes only the unsaved preview. Save tenant settings to publish them.</small>
      </section>
    }
  </div>`,
  styles: `
    :host {
      display: block;
      min-width: 0;
    }
    .current-row {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
    }
    .current-row input {
      width: 110px;
      flex: 1;
      min-width: 100px;
    }
    .swatch {
      width: 30px;
      height: 30px;
      border: 1px solid #8997a8;
      border-radius: 6px;
    }
    .editor {
      display: grid;
      gap: 10px;
      border: 1px solid var(--line);
      border-radius: 8px;
      padding: 16px;
      margin-top: 12px;
      background: #fff;
    }
    input {
      min-height: 44px;
      padding: 8px;
      border: 1px solid #8997a8;
      border-radius: 6px;
      width: 100%;
      font: inherit;
    }
    input[type='color'] {
      height: 64px;
      padding: 4px;
      cursor: pointer;
    }
    .samples {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
    }
    .samples span {
      display: block;
      padding: 16px 8px;
      margin-top: 6px;
      border: 1px solid #8997a8;
      border-radius: 6px;
      text-align: center;
      overflow-wrap: anywhere;
    }
    .samples small,
    small,
    .guidance {
      font-size: 12px;
      line-height: 1.6;
      color: #536175;
    }
    .guidance {
      margin: 0;
    }
    .error {
      color: #a4262c;
    }
    button {
      min-height: 44px;
      padding: 8px 12px;
      font: inherit;
      cursor: pointer;
    }
    button:focus-visible,
    input:focus-visible {
      outline: 3px solid #111827;
      outline-offset: 3px;
    }
    .actions {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
    }
    .actions button:first-child {
      background: #2457a6;
      color: #fff;
    }
    button:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }
    label {
      font-size: 13px;
      font-weight: 600;
    }
  `,
})
export class BrandColourPicker {
  readonly control = input.required<FormControl<string>>();
  readonly description = input<string | null>(null);
  readonly id = input.required<string>();
  readonly label = input.required<string>();
  readonly defaultColour = input('#17365D');
  readonly editing = signal(false);
  readonly candidate = signal('');
  readonly ink = brandingInk;
  valid(c: string) {
    return /^#[0-9a-f]{6}$/i.test(c);
  }
  direct(e: Event) {
    this.control().setValue((e.target as HTMLInputElement).value);
    this.control().markAsDirty();
    this.control().markAsTouched();
  }
  start() {
    this.candidate.set(this.control().value || this.defaultColour());
    this.editing.set(true);
  }
  cancel() {
    this.editing.set(false);
    this.candidate.set('');
    document.getElementById(this.id())?.focus();
  }
  apply() {
    if (!this.valid(this.candidate())) return;
    this.control().setValue(this.candidate().toUpperCase());
    this.control().markAsDirty();
    this.control().markAsTouched();
    this.cancel();
  }
  whiteContrast() {
    return colourContrast(this.candidate(), '#ffffff').toFixed(2);
  }
  lowContrast() {
    return colourContrast(this.candidate(), '#ffffff') < 4.5;
  }
}
