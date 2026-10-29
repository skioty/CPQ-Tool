import { InvitationContinuation } from './invitation-continuation';
import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { catchError, of, tap, throwError } from 'rxjs';
import { Session } from '../navigation/session';
export const accessError = (error: any) =>
  error?.error?.error?.message ||
  'The request could not be completed. Check your connection and retry.';
export interface Invitation {
  id: string;
  email: string;
  kind: string;
  state: string;
  expires_at: string;
  delivery_status: string;
  email_delivery_status?: string;
}
export interface StaffAccount {
  id: string;
  name: string | null;
  email: string;
  role: string;
  enabled: boolean;
  activated: boolean;
  assigned_tenants: number;
  invitation: Invitation | null;
}
@Injectable({ providedIn: 'root' })
export class TenantSession {
  private http = inject(HttpClient);
  private platform = inject(Session);
  private continuation = inject(InvitationContinuation);
  readonly actor = signal<{ id: string; email: string } | null>(null);
  private revision = 0;
  refresh() {
    const revision = this.revision;
    return this.http.get<{ data: { id: string; email: string } }>('/api/v1/tenant_session').pipe(
      tap((r) => {
        if (revision === this.revision) this.actor.set(r.data);
      }),
      catchError((e) => {
        if (e.status === 401) {
          if (revision === this.revision) this.actor.set(null);
          return of(null);
        }
        return throwError(() => e);
      }),
    );
  }
  login(email: string, password: string) {
    this.revision++;
    this.actor.set(null);
    this.platform.clear();
    return this.http
      .post<{ data?: { id: string; email: string }; challenge?: boolean; csrf_token: string }>(
        '/api/v1/tenant_session',
        {
          tenant_user: { email, password },
        },
      )
      .pipe(
        tap((r) => {
          this.actor.set(r.data || null);
          this.platform.token.set(r.csrf_token);
        }),
      );
  }
  logout() {
    return this.http.delete<void>('/api/v1/tenant_session').pipe(
      tap(() => {
        this.revision++;
        this.actor.set(null);
        this.platform.clear();
        this.continuation.token = '';
        this.continuation.tenantId = '';
      }),
    );
  }
}
