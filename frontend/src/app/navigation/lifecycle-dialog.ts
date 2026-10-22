import {
  Component,
  ElementRef,
  afterNextRender,
  inject,
  input,
  output,
  viewChild,
} from '@angular/core';
import { LifecycleAction } from './tenant-directory';
@Component({
  selector: 'app-lifecycle-dialog',
  template: `<dialog #dialog aria-labelledby="action-title" (cancel)="cancelled.emit()">
    <h2 id="action-title">{{ action().label }}</h2>
    <p>{{ action().confirmation }}</p>
    <p>Tenant: {{ company() }}</p>
    <div>
      <button autofocus (click)="cancelled.emit()">Cancel</button
      ><button (click)="confirmed.emit()">Confirm {{ action().label }}</button>
    </div>
  </dialog>`,
  styles: `
    dialog {
      max-width: min(480px, 90vw);
      border: 1px solid #c8cfdf;
      border-radius: 16px;
      padding: 24px;
      color: #17263a;
    }
    dialog::backdrop {
      background: #17263a88;
    }
    button {
      font: inherit;
      padding: 10px;
      margin: 4px;
    }
  `,
})
export class LifecycleDialog {
  readonly action = input.required<LifecycleAction>();
  readonly company = input.required<string>();
  readonly confirmed = output<void>();
  readonly cancelled = output<void>();
  readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');
  private previous = inject(ElementRef).nativeElement.ownerDocument
    .activeElement as HTMLElement | null;
  constructor() {
    afterNextRender(() => this.dialog().nativeElement.showModal());
  }
  ngOnDestroy() {
    this.dialog().nativeElement.close();
    this.previous?.focus();
  }
}
