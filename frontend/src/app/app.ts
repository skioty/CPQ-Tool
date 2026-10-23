import { Component, inject, signal } from '@angular/core';
import { Router, RouterLink, RouterOutlet } from '@angular/router';
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
  constructor() {
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
