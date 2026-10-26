import { Injectable, inject, signal } from '@angular/core';
import { HttpClient, HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { catchError, of, switchMap, tap, throwError } from 'rxjs';

export interface Actor {
  id: string;
  role: 'super_admin' | 'admin';
}
@Injectable({ providedIn: 'root' })
export class Session {
  private http = inject(HttpClient);
  readonly actor = signal<Actor | null>(null);
  readonly token = signal<string | null>(null);
  revision = 0;
  csrf() {
    return this.http
      .get<{ csrf_token: string }>('/api/v1/session/csrf')
      .pipe(tap((r) => this.token.set(r.csrf_token)));
  }
  refresh() {
    const revision = this.revision;
    return this.http.get<{ data: Actor }>('/api/v1/session').pipe(
      tap((r) => {
        if (revision === this.revision) this.actor.set(r.data);
      }),
      catchError((e) => {
        if (e.status === 401) {
          if (revision === this.revision) this.clear();
          return of(null);
        }
        return throwError(() => e);
      }),
    );
  }
  login(email: string, password: string) {
    this.clear();
    return this.csrf().pipe(
      switchMap(() =>
        this.http.post<{ data?: Actor; challenge?: boolean; csrf_token: string }>('/api/v1/session', {
          administrator: { email, password },
        }),
      ),
      tap((r) => {
        this.actor.set(r.data || null);
        this.token.set(r.csrf_token);
      }),
    );
  }
  logout() {
    return this.csrf().pipe(
      switchMap(() => this.http.delete<void>('/api/v1/session')),
      tap(() => this.clear()),
    );
  }
  clear() {
    this.revision++;
    this.actor.set(null);
    this.token.set(null);
  }
}
export const sessionHeaders: HttpInterceptorFn = (request, next) => {
  const session = inject(Session);
  const local = request.url.startsWith('/api/');
  const unsafe = !['GET', 'HEAD', 'OPTIONS'].includes(request.method);
  const token = session.token();
  const revision = session.revision;
  const send = (value: string | null) => next(local && unsafe && value ? request.clone({setHeaders: {'X-CSRF-Token': value}}) : request);
  return (local && unsafe && !token ? session.csrf().pipe(switchMap(r=>send(r.csrf_token))) : send(token)).pipe(
    catchError((error) => {
      if (
        local &&
        error instanceof HttpErrorResponse &&
        error.status === 401 &&
        revision === session.revision
      )
        session.clear();
      if (
        local &&
        error instanceof HttpErrorResponse &&
        error.error?.error?.code === 'invalid_csrf' && revision === session.revision
      )
        session.token.set(null);
      return throwError(() => error); // Never automatically retry a mutation.
    }),
  );
};
