import { TenantSession } from './access/access-api';
import {
  Component,
  ElementRef,
  Injector,
  afterNextRender,
  inject,
  effect,
  signal,
  viewChild,
} from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterOutlet } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Session } from './navigation/session';

@Component({
  selector: 'app-root',
  imports: [RouterLink, RouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  readonly session = inject(Session);
  readonly tenantSession = inject(TenantSession);
  readonly router = inject(Router);
  get isLogin() {
    return (
      this.router.url.startsWith('/login') ||
      this.router.url.startsWith('/security') ||
      this.isTenantArea
    );
  }
  get isTenantArea() {
    return ['/tenant-login', '/workspaces', '/invitations/accept'].some((path) =>
      this.router.url.startsWith(path),
    );
  }
  get pageLabel() {
    const path = this.router.url;
    if (path.startsWith('/administrators')) return 'Administrator management';
    if (path.startsWith('/reference-options')) return 'Reference configuration';
    if (path.includes('/setup')) return 'Tenant setup';
    if (path.includes('/access')) return 'Tenant access';
    if (path.includes('/branding')) return 'Branding preview';
    if (path.includes('/edit')) return 'Edit tenant';
    if (path.startsWith('/tenants/new')) return 'Create tenant';
    return path === '/tenants' ? 'Tenant directory' : 'Company workspace';
  }
  readonly message = signal('');
  readonly menuOpen = signal(false);
  readonly collapsed = signal(this.savedSidebar());
  private savedSidebar() {
    try {
      return localStorage.getItem('cpq-sidebar-collapsed') === 'true';
    } catch {
      return false;
    }
  }
  toggleSidebar() {
    this.collapsed.update((value) => !value);
    try {
      localStorage.setItem('cpq-sidebar-collapsed', String(this.collapsed()));
    } catch {
      /* optional preference */
    }
  }
  private readonly main = viewChild<ElementRef<HTMLElement>>('mainContent');
  private readonly injector = inject(Injector);
  constructor() {
    effect(() => {
      if (this.session.actor()) this.message.set('');
    });
    this.router.events.pipe(takeUntilDestroyed()).subscribe((event) => {
      if (event instanceof NavigationEnd && !event.urlAfterRedirects.includes('#')) {
        afterNextRender(() => this.main()?.nativeElement.focus({ preventScroll: true }), {
          injector: this.injector,
        });
      }
    });
    this.session.refresh().subscribe({
      error: () =>
        this.message.set('Session could not be checked. Use administrator login to retry.'),
    });
  }
  tenantLogout() {
    this.tenantSession.logout().subscribe({
      next: () => globalThis.location.assign('/tenant-login'),
      error: () => this.message.set('Logout failed. Please retry.'),
    });
  }
  logout() {
    this.session.logout().subscribe({
      next: () => globalThis.location.assign('/login'),
      error: () => this.message.set('Logout failed. Retry before leaving this shared browser.'),
    });
  }
}
