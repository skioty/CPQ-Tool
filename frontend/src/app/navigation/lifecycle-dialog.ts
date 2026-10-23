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
  template: `<dialog
    #dialog
    aria-labelledby="action-title"
    aria-describedby="action-description action-company"
    (cancel)="cancelled.emit()"
  >
    <div class="dialog-mark" aria-hidden="true">↗</div>
    <p class="eyebrow">TENANT STATUS</p>
    <h2 id="action-title">{{ action().label }}</h2>
    <p id="action-description">{{ action().confirmation }}</p>
    <p class="dialog-company" id="action-company">{{ company() }}</p>
    <div>
      <button autofocus (click)="cancelled.emit()">Cancel</button
      ><button
        [class.danger]="action().code === 'archive' || action().code === 'suspend'"
        [class.primary]="action().code !== 'archive' && action().code !== 'suspend'"
        (click)="confirmed.emit()"
      >
        Confirm {{ action().label }}
      </button>
    </div>
  </dialog>`,
  styles: `
    dialog {
      width: min(460px, calc(100vw - 40px));
      max-width: none;
      max-height: calc(100dvh - 40px);
      overflow-y: auto;
      border: 1px solid #e1e6ed;
      border-radius: 16px;
      padding: 30px;
      color: var(--ink);
      box-shadow: 0 20px 100px #17233a26;
    }
    dialog::backdrop {
      background: #10203680;
    }
    h2 {
      font-size: 20px;
      letter-spacing: -0.7px;
      margin: 10px 0 14px;
    }
    p {
      font-size: 12px;
      color: var(--muted);
      line-height: 1.8;
    }
    .dialog-mark {
      height: 42px;
      width: 42px;
      display: grid;
      place-content: center;
      border: 1px solid #f2ddd6;
      background: #fff2ed;
      color: #ce765e;
      border-radius: 11px;
      margin-bottom: 22px;
      font-size: 24px;
    }
    .eyebrow {
      font-size: 12px;
    }
    .dialog-company {
      border: 1px solid #e8ecf2;
      background: #f8f9fb;
      border-radius: 8px;
      padding: 12px;
      color: #536175;
      font-weight: 550;
      margin: 20px 0 26px;
    }
    dialog > div:last-child {
      display: flex;
      flex-wrap: wrap;
      justify-content: flex-end;
      gap: 10px;
      padding-top: 18px;
      border-top: 1px solid #eceff4;
    }
    button {
      font-size: 12px;
    }
    @media (max-width: 400px) {
      dialog {
        padding: 24px;
      }
      button {
        padding: 10px 12px;
      }
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
