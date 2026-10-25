import { InvitationLink } from './invitation-link';
import { Component, DestroyRef, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DatePipe } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { Subscription } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Invitation, accessError } from './access-api';
@Component({
  imports: [FormsModule, DatePipe, RouterLink, InvitationLink],
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
          Give the right people access to this workspace. Contacts remain separate from user
          accounts.
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
    @if (issuedToken()) {
      <app-invitation-link
        [token]="issuedToken()"
        [email]="issuedEmail()"
        (dismissed)="issuedToken.set('')"
      />
    }
    <div class="access-layout">
      <section class="card">
        <p class="eyebrow">NEW WORKSPACE MEMBER</p>
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
          /><button class="primary" [disabled]="busy() || loading() || invite.invalid">
            {{ busy() ? 'Working…' : 'Generate invitation link' }}
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
            @if (!loading() && !error()) {
              <li class="access-empty">
                <span class="empty-access-icon" aria-hidden="true">＋</span
                ><strong>No tenant accounts have accepted an invitation.</strong>
                <p>Create a private link to give a Tenant Admin access to this workspace.</p>
              </li>
            }
          }
        </ul>
      </section>
    </div>
    <section class="directory-panel invitation-history">
      <div class="panel-heading">
        <div>
          <h2>Recent invitations</h2>
          <p>
            Latest 100 invitations. Replacing a link invalidates the previous one. Accepted
            invitations cannot be revoked; account access is separate.
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
                <button (click)="resend(inv.id)" [disabled]="busy()">Replace link</button>
                @if (inv.state !== 'revoked') {
                  <button (click)="revoke(inv.id)" [disabled]="busy()">Revoke invitation</button>
                }
              </div>
            }
          </li>
        } @empty {
          @if (!loading() && !error()) {
            <li class="access-empty">
              No invitations yet. Your invitation history will appear here.
            </li>
          }
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
  readonly issuedToken = signal('');
  readonly issuedEmail = signal('');
  readonly error = signal('');
  readonly message = signal('');
  constructor() {
    this.destroy.onDestroy(() => {
      this.request?.unsubscribe();
      this.issuedToken.set('');
    });
    this.route.paramMap.pipe(takeUntilDestroyed(inject(DestroyRef))).subscribe((p) => {
      this.issuedToken.set('');
      this.id = p.get('id') || '';
      this.invitations.set([]);
      this.members.set([]);
      this.load();
    });
  }
  load() {
    const id = this.id;
    this.request?.unsubscribe();

    this.loading.set(true);
    this.request = this.http
      .get<{
        data: Invitation[];
        members: { id: string; email: string; enabled: boolean }[];
        invitation_delivery: string;
      }>('/api/v1/tenants/' + encodeURIComponent(id) + '/invitations')
      .subscribe({
        next: (r) => {
          if (id !== this.id) return;
          this.invitations.set(r.data);
          this.members.set(r.members);

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
    this.issuedToken.set('');
    const id = this.id;
    this.http
      .post(url, body)
      .pipe(takeUntilDestroyed(this.destroy))
      .subscribe({
        next: (result: any) => {
          this.busy.set(false);
          if (id !== this.id) return;
          this.message.set(message);
          if (result?.invitation_token) {
            this.issuedToken.set(result.invitation_token);
            this.issuedEmail.set(result.data?.email || result.invitation?.email || this.email);
          }
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
    this.run(
      '/api/v1/tenants/' + this.id + '/invitations',
      { email: this.email },
      'Invitation link created. No account access is granted until the recipient accepts.',
    );
  }
  resend(id: string) {
    this.run(
      '/api/v1/invitations/' + id + '/resend',
      {},
      'Replacement invitation link created. Previous links are no longer valid.',
    );
  }
  revoke(id: string) {
    this.run('/api/v1/invitations/' + id + '/revoke', {}, 'Invitation revoked.');
  }
}
