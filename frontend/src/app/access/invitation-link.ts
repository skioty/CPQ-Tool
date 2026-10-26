import { Component, ElementRef, computed, input, output, signal, viewChild } from '@angular/core';

@Component({
  selector: 'app-invitation-link',
  template: `
    <section class="issued-link" aria-labelledby="issued-link-title">
      <div class="link-heading">
        <span class="link-icon" aria-hidden="true">↗</span>
        <div>
          <p class="eyebrow">READY TO SHARE</p>
          <h2 id="issued-link-title">Your invitation link is ready</h2>
        </div>
        <button
          type="button"
          class="dismiss-link"
          (click)="dismissed.emit()"
          aria-label="Dismiss invitation link"
        >
          Dismiss
        </button>
      </div>
      <p>
        Share this link privately with <strong>{{ email() || 'the invited recipient' }}</strong
        >. It expires in 72 hours and can be used once.
      </p>
      <label for="issued-invitation-link">Invitation link</label>
      <div class="link-controls">
        <input
          #linkField
          id="issued-invitation-link"
          [value]="link()"
          readonly
          autocomplete="off"
          spellcheck="false"
          (focus)="linkField.select()"
        />
        <button type="button" class="primary" [disabled]="copying()" (click)="copy()">
          {{ copied() ? '✓ Copied' : 'Copy link' }}
        </button>
      </div>
      <p class="link-note" role="status">
        {{
          note() ||
            'This link is shown only now. If you lose it, generate a replacement; the previous link will stop working. No email is sent.'
        }}
      </p>
      @if (localOnly) {
        <p class="link-note">
          This local link opens on this computer. A shared deployment is needed for access from
          another laptop.
        </p>
      }
    </section>
  `,
  styles: `
    :host {
      display: block;
      margin-bottom: 24px;
    }
    .issued-link {
      padding: 24px;
      border: 1px solid #a9ccbb;
      border-radius: var(--radius);
      background: #f1f9f5;
      box-shadow: var(--shadow);
    }
    .link-heading {
      display: flex;
      align-items: center;
      gap: 14px;
      margin-bottom: 16px;
    }
    .link-heading h2 {
      margin: 0;
    }
    .link-heading .eyebrow {
      font-size: 10px;
      color: var(--success);
      margin-bottom: 4px;
    }
    .link-icon {
      display: grid;
      place-items: center;
      width: 40px;
      height: 40px;
      border-radius: 12px;
      background: #dcefe5;
      color: var(--success);
      font-size: 24px;
      flex-shrink: 0;
    }
    .dismiss-link {
      margin-left: auto;
      background: transparent;
    }
    label {
      display: block;
      font-size: 12px;
      font-weight: 650;
      margin-bottom: 8px;
    }
    .link-controls {
      display: flex;
      gap: 10px;
    }
    input {
      flex: 1;
      width: 100%;
      font-family: ui-monospace, monospace;
      font-size: 12px;
    }
    .link-note {
      color: var(--muted);
      font-size: 12px;
      margin: 12px 0 0;
    }
    @media (max-width: 560px) {
      .issued-link {
        padding: 18px;
      }
      .link-controls {
        flex-direction: column;
      }
      .link-heading {
        flex-wrap: wrap;
      }
      .link-heading > div {
        flex: 1;
        min-width: 150px;
      }
      .dismiss-link {
        margin-left: 0;
      }
    }
  `,
})
export class InvitationLink {
  readonly localOnly = ['localhost', '127.0.0.1'].includes(location.hostname);
  readonly token = input.required<string>();
  readonly email = input('');
  readonly dismissed = output<void>();
  readonly link = computed(
    () => `${location.origin}/invitations/accept#token=${encodeURIComponent(this.token())}`,
  );
  readonly copied = signal(false);
  readonly copying = signal(false);
  readonly note = signal('');
  private readonly field = viewChild<ElementRef<HTMLInputElement>>('linkField');
  async copy() {
    if (this.copying()) return;
    this.copying.set(true);
    this.copied.set(false);
    try {
      await navigator.clipboard.writeText(this.link());
      this.copied.set(true);
      this.note.set('Copied. Share it only with the invited recipient.');
    } catch {
      this.field()?.nativeElement.focus();
      this.field()?.nativeElement.select();
      this.note.set(
        'Automatic copy is unavailable. The link is selected; use Ctrl+C or your device’s Copy command.',
      );
    } finally {
      this.copying.set(false);
    }
  }
}
