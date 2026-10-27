import { Component, ElementRef, inject, input, output, signal } from '@angular/core';
import { FormControl } from '@angular/forms';
import { Choice } from './tenant.types';
@Component({
  selector: 'app-industry-picker',
  host: { '(document:click)': 'outside($event)' },
  template: `<div
    class="picker"
    (keydown.escape)="open.set(false); trigger.focus()"
    (focusout)="focusOut($event)"
  >
    <button
      #trigger
      type="button"
      class="trigger"
      [id]="id()"
      [attr.aria-expanded]="open()"
      [attr.aria-controls]="id() + '-industries'"
      [attr.aria-describedby]="description()"
      [attr.aria-invalid]="control().touched && control().invalid"
      [disabled]="control().disabled || busy()"
      (click)="open.set(!open())"
    >
      <span>{{ selectedLabel() }}</span
      ><span aria-hidden="true">⌄</span>
    </button>
    @if (open()) {
      <div class="options" role="group" aria-label="Industry options" [id]="id() + '-industries'">
        @for (choice of choices(); track choice.id) {
          <div class="option-row">
            <button
              type="button"
              class="choose"
              [class.selected]="choice.id === control().value"
              [disabled]="busy()"
              (click)="choose(choice); trigger.focus()"
            >
              {{ choice.label }}
            </button>
            @if (allowRemove() && choice.id !== '__create_industry__') {
              <button
                type="button"
                class="remove"
                [disabled]="busy()"
                [attr.aria-label]="'Remove ' + choice.label + ' from industries'"
                [title]="'Remove ' + choice.label"
                (click)="remove.emit(choice)"
              >
                −
              </button>
            }
          </div>
        } @empty {
          <p>No industries available.</p>
        }
      </div>
    }
  </div>`,
  styles: `
    :host {
      display: block;
      min-width: 0;
    }
    .picker {
      position: relative;
    }
    .trigger {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      width: 100%;
      min-height: 44px;
      text-align: left;
      background: white;
      border: 1px solid var(--control-border);
      border-radius: 8px;
      padding: 10px 14px;
      font: inherit;
      color: var(--ink);
    }
    .trigger span:first-child {
      overflow-wrap: anywhere;
      min-width: 0;
    }
    .options {
      position: absolute;
      inset: calc(100% + 4px) 0 auto;
      z-index: 25;
      max-height: 280px;
      overflow: auto;
      border: 1px solid var(--line);
      border-radius: 8px;
      background: white;
      box-shadow: 0 8px 20px #14263d20;
      padding: 4px;
    }
    .option-row {
      display: flex;
      align-items: stretch;
      gap: 4px;
    }
    .option-row button {
      border: 0;
      background: white;
      border-radius: 4px;
      min-height: 44px;
      color: var(--ink);
      font: inherit;
    }
    .option-row .choose {
      flex: 1;
      min-width: 0;
      text-align: left;
      padding: 10px;
      overflow-wrap: anywhere;
    }
    .option-row .remove {
      flex: 0 0 44px;
      margin-left: auto;
      font-size: 22px;
      color: var(--danger);
    }
    .option-row button:hover {
      background: var(--accent-soft);
    }
    .option-row .selected {
      background: var(--accent-soft);
      color: var(--accent);
    }
    p {
      padding: 10px;
      margin: 0;
    }
  `,
})
export class IndustryPicker {
  readonly id = input.required<string>();
  readonly control = input.required<FormControl<string>>();
  readonly choices = input<Choice[]>([]);
  readonly allowRemove = input(false);
  readonly busy = input(false);
  readonly description = input<string | null>(null);
  readonly remove = output<Choice>();
  readonly open = signal(false);
  private element = inject(ElementRef<HTMLElement>);
  selectedLabel() {
    return (
      this.choices().find((choice) => choice.id === this.control().value)?.label ||
      this.control().value ||
      'Select an industry'
    );
  }
  choose(choice: Choice) {
    this.control().setValue(choice.id);
    this.control().markAsDirty();
    this.control().markAsTouched();
    this.open.set(false);
  }
  outside(event: Event) {
    if (event.target instanceof Node && !this.element.nativeElement.contains(event.target))
      this.open.set(false);
  }
  focusOut(event: FocusEvent) {
    if (
      !(event.relatedTarget instanceof Node) ||
      !this.element.nativeElement.contains(event.relatedTarget)
    )
      this.open.set(false);
  }
}
