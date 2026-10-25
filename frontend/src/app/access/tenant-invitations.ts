import { Component, DestroyRef, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DatePipe } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { Subscription } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Invitation, accessError } from './access-api';
@Component({
  imports: [FormsModule, DatePipe, RouterLink],
  host: { class: 'directory-page' },
  template: `
    <nav class="breadcrumb" aria-label="Breadcrumb">
      <a routerLink="/tenants">Tenants</a><span>/</span
      ><a [routerLink]="['/tenants', id]">Company overview</a><span>/</span
      ><span>Tenant access</span>
    </nav>
    <div class="heading">
      <div>
        <p class="eyebrow">EXPLICIT ACCOUNT ACCESS</p>
        <h1>Tenant invitations</h1>
        <p class="subheading">
          Invite Tenant Admins explicitly. A company contact is never automatically granted account
          access.
        </p>
      </div>
      <a class="button" [routerLink]="['/tenants', id, 'setup']">Review setup</a>
    </div>
    @if (error()) {
      <p class="error-summary" role="alert">{{ error() }}</p>
    }
    @if (message()) {
      <p class="success" role="status">{{ message() }}</p>
    }
    @if (loading()) {
      <p role="status">Loading tenant access…</p>
    }
    @if (!loading() && !error() && !mailReady()) {
      <p class="notice" role="status">
        SMTP delivery is not configured. Invitations cannot be sent until email delivery is
        configured.
      </p>
    }
    <div class="access-layout">
      <section class="card">
        <h2>Invite a Tenant Admin</h2>
        <p class="muted">
          Single-use links expire after 72 hours. Workspace access requires an Active tenant.
          Invited people choose their own password; existing users keep their existing password.
        </p>
        <form #invite="ngForm" (ngSubmit)="send()">
          <label for="invite-email">Email (required)</label
          ><input
            id="invite-email"
            name="email"
            type="email"
            email
            required
            [(ngModel)]="email"
            [disabled]="busy()"
            autocomplete="email"
          /><button
            class="primary"
            [disabled]="busy() || loading() || !mailReady() || invite.invalid"
          >
            {{ busy() ? 'Working…' : 'Send invitation email' }}
          </button>
        </form>
      </section>
      <section class="card">
        <h2>Tenant accounts</h2>
        <p class="muted">These explicit memberships remain subject to tenant status.</p>
        <ul class="staff-list">
          @for (member of members(); track member.id) {
            <li>
              <strong>{{ member.email }}</strong>
              <p>
                Tenant Admin · {{ member.enabled ? 'Enabled membership' : 'Disabled membership' }}
              </p>
            </li>
          } @empty {
            <li>No tenant accounts have accepted an invitation.</li>
          }
        </ul>
      </section>
    </div>
    <section class="directory-panel invitation-history">
      <div class="panel-heading">
        <div>
          <h2>Recent invitations</h2>
          <p>
            Latest 100 invitations. Resending replaces unused links. Revoking an accepted invitation
            does not remove account access.
          </p>
        </div>
        <button (click)="load()" [disabled]="busy()">Refresh</button>
      </div>
      <ul class="staff-list">
        @for (inv of invitations(); track inv.id) {
          <li>
            <div class="staff-title">
              <strong>{{ inv.email }}</strong
              ><span class="badge">{{ inv.state }}</span>
            </div>
            <p>Expires {{ inv.expires_at | date: 'medium' }}</p>
            @if (inv.state !== 'accepted') {
              <div class="row-actions">
                <button (click)="resend(inv.id)" [disabled]="busy() || !mailReady()">
                  Resend email
                </button>
                @if (inv.state !== 'revoked') {
                  <button (click)="revoke(inv.id)" [disabled]="busy()">Revoke invitation</button>
                }
              </div>
            }
          </li>
        } @empty {
          <li>No invitations have been sent.</li>
        }
      </ul>
    </section>
  `,
  styleUrl: './access-pages.scss',
})
export class TenantInvitations {
  private http = inject(HttpClient);
  private route = inject(ActivatedRoute);
  private request?: Subscription;
  private readonly destroy = inject(DestroyRef);
  id = '';
  email = '';
  readonly invitations = signal<Invitation[]>([]);
  readonly members = signal<{ id: string; email: string; enabled: boolean }[]>([]);
  readonly loading = signal(true);
  readonly busy = signal(false);
  readonly mailReady = signal(false);
  readonly error = signal('');
  readonly message = signal('');
  constructor() {
    this.destroy.onDestroy(() => this.request?.unsubscribe());
    this.route.paramMap.pipe(takeUntilDestroyed(inject(DestroyRef))).subscribe((p) => {
      this.id = p.get('id') || '';
      this.invitations.set([]);
      this.members.set([]);
      this.load();
    });
  }
  load() {
    const id = this.id;
    this.request?.unsubscribe();
    this.mailReady.set(false);
    this.loading.set(true);
    this.request = this.http
      .get<{
        data: Invitation[];
        members: { id: string; email: string; enabled: boolean }[];
        email_delivery_configured: boolean;
      }>('/api/v1/tenants/' + encodeURIComponent(id) + '/invitations')
      .subscribe({
        next: (r) => {
          if (id !== this.id) return;
          this.invitations.set(r.data);
          this.members.set(r.members);
          this.mailReady.set(r.email_delivery_configured);
          this.loading.set(false);
        },
        error: (e) => {
          if (id !== this.id) return;
          this.error.set(accessError(e));
          this.loading.set(false);
        },
      });
  }
  private run(url: string, body: any, message: string) {
    if (this.busy()) return;
    this.busy.set(true);
    this.error.set('');
    this.message.set('');
    const id = this.id;
    this.http.post(url, body).subscribe({
      next: () => {
        this.busy.set(false);
        if (id !== this.id) return;
        this.message.set(message);
        this.email = '';
        this.load();
      },
      error: (e) => {
        this.busy.set(false);
        if (id !== this.id) return;
        this.error.set(accessError(e));
        this.load();
      },
    });
  }
  send() {
    if (this.mailReady())
      this.run(
        '/api/v1/tenants/' + this.id + '/invitations',
        { email: this.email },
        'Invitation email sent. No account access is granted until the recipient accepts.',
      );
  }
  resend(id: string) {
    this.run(
      '/api/v1/invitations/' + id + '/resend',
      {},
      'Fresh invitation email sent. Previous links are no longer valid.',
    );
  }
  revoke(id: string) {
    this.run('/api/v1/invitations/' + id + '/revoke', {}, 'Invitation revoked.');
  }
}
