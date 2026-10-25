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
  readonly router = inject(Router);
  get isLogin() {
    return this.router.url.startsWith('/login');
  }
  readonly message = signal('');
  readonly menuOpen = signal(false);
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
  logout() {
    this.session.logout().subscribe({
      next: () => globalThis.location.assign('/login'),
      error: () => this.message.set('Logout failed. Retry before leaving this shared browser.'),
    });
  }
}
