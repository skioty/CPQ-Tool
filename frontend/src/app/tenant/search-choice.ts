import { Component, input, signal } from '@angular/core';
import { FormControl } from '@angular/forms';
import { Choice } from './tenant.types';

@Component({
  selector: 'app-search-choice',
  template: `<div class="combo">
    <input
      [id]="id()"
      role="combobox"
      autocomplete="off"
      aria-autocomplete="list"
      [attr.aria-expanded]="open()"
      [attr.aria-controls]="id() + '-options'"
      [attr.aria-activedescendant]="
        open() && filtered().length ? id() + '-option-' + active() : null
      "
      [attr.aria-required]="required()"
      [attr.aria-invalid]="control().touched && control().invalid"
      [disabled]="control().disabled"
      [value]="typing() ? query() : selectedLabel()"
      (focus)="focus()"
      (input)="search($event)"
      (keydown)="key($event)"
      (blur)="blur()"
      placeholder="Search or choose an option…"
    />
    @if (open()) {
      <div class="results">
        <small class="result-count" role="status"
          >{{ filtered().length }} options. Scroll to browse all, or type to search.</small
        >
        <ul role="listbox" [id]="id() + '-options'">
          @for (choice of filtered(); track choice.id; let i = $index) {
            <li
              role="option"
              [id]="id() + '-option-' + i"
              [attr.aria-selected]="i === active()"
              (mousedown)="$event.preventDefault()"
              (click)="choose(choice)"
            >
              {{ choice.label }}
            </li>
          } @empty {
            <li role="option" aria-disabled="true">No matching options</li>
          }
        </ul>
      </div>
    }
  </div>`,
  styles: `
    :host {
      display: block;
      min-width: 0;
    }
    .combo {
      position: relative;
    }
    input {
      width: 100%;
      min-height: 44px;
    }
    .results {
      position: absolute;
      z-index: 20;
      inset: calc(100% + 4px) 0 auto;
      background: white;
      border: 1px solid var(--line);
      border-radius: 8px;
      box-shadow: 0 8px 20px #14263d20;
    }
    ul {
      margin: 0;
      padding: 4px;
      max-height: 260px;
      overflow: auto;
      list-style: none;
      border: 0;
      border-radius: 8px;
      background: white;
    }
    .result-count {
      display: block;
      padding: 6px 10px;
      background: white;
      border-bottom: 1px solid var(--line);
      font-size: 12px;
      color: var(--muted);
    }
    li {
      padding: 10px;
      cursor: pointer;
    }
    li[aria-selected='true'] {
      background: var(--accent-soft);
      color: var(--accent);
    }
    li[aria-disabled='true'] {
      color: var(--muted);
      cursor: default;
    }
  `,
})
export class SearchChoice {
  readonly id = input.required<string>();
  readonly control = input.required<FormControl<string>>();
  readonly choices = input<Choice[]>([]);
  readonly required = input(false);
  readonly open = signal(false);
  readonly typing = signal(false);
  readonly query = signal('');
  readonly active = signal(0);
  selectedLabel() {
    return this.choices().find((c) => c.id === this.control().value)?.label || this.control().value;
  }
  filtered() {
    const q = this.query().toLocaleLowerCase();
    return this.choices().filter((c) => (c.id + ' ' + c.label).toLocaleLowerCase().includes(q));
  }
  focus() {
    this.open.set(true);
    this.query.set('');
    this.active.set(0);
  }
  search(event: Event) {
    this.typing.set(true);
    this.query.set((event.target as HTMLInputElement).value);
    this.control().setValue('');
    this.control().markAsDirty();
    this.open.set(true);
    this.active.set(0);
  }
  choose(choice: Choice) {
    this.control().setValue(choice.id);
    this.control().markAsDirty();
    this.control().markAsTouched();
    this.typing.set(false);
    this.open.set(false);
  }
  blur() {
    if (this.typing()) {
      const q = this.query().trim().toLocaleLowerCase();
      const exact = this.choices().find(
        (c) => c.id.toLocaleLowerCase() === q || c.label.toLocaleLowerCase() === q,
      );
      if (exact) this.choose(exact);
      else if (q) this.control().setErrors({ choice: true });
    }
    this.control().markAsTouched();
    this.open.set(false);
  }
  key(event: KeyboardEvent) {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      this.open.set(true);
      this.active.set(
        Math.max(
          0,
          Math.min(
            this.filtered().length - 1,
            this.active() + (event.key === 'ArrowDown' ? 1 : -1),
          ),
        ),
      );
      document
        .getElementById(this.id() + '-option-' + this.active())
        ?.scrollIntoView?.({ block: 'nearest' });
    } else if ((event.key === 'Home' || event.key === 'End') && this.open()) {
      event.preventDefault();
      this.active.set(event.key === 'Home' ? 0 : Math.max(0, this.filtered().length - 1));
      document
        .getElementById(this.id() + '-option-' + this.active())
        ?.scrollIntoView?.({ block: 'nearest' });
    } else if (event.key === 'Enter' && this.open()) {
      event.preventDefault();
      const choice = this.filtered()[this.active()];
      if (choice) this.choose(choice);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      this.open.set(false);
    }
  }
}
