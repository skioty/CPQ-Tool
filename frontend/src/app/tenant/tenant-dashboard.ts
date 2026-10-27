import { Component, input, signal, effect } from '@angular/core';
import { brandingInk } from './branding-colour';

export interface DashboardIdentity {
  company_name: string | null;
  display_name?: string | null;
  company_name_display: boolean | null;
  description: string | null;
  role?: string;
  branding: {
    primary_colour?: string | null;
    secondary_colour?: string | null;
    typography?: string | null;
  };
}
@Component({
  selector: 'app-tenant-dashboard',
  template: `<section
    class="dashboard"
    [style.font-family]="font()"
    [style.--brand-primary]="primary()"
    [style.--brand-ink]="ink(primary())"
    [style.--brand-secondary]="secondary()"
    [style.--brand-secondary-ink]="ink(secondary())"
  >
    @if (demo()) {
      <div class="demo-note">
        Tenant Admin dashboard preview · Demonstration only. Your platform role and permissions have
        not changed.
      </div>
    }
    <div class="browser-tab" aria-label="Browser tab preview">
      @if (favicon() && !faviconFailed()) {
        <img
          [src]="favicon()"
          (error)="faviconFailed.set(true)"
          alt="Favicon preview"
          width="16"
          height="16"
        />
      } @else {
        <span class="favicon-fallback" aria-label="Default favicon">{{ initials() }}</span>
      }
      <span>{{ name() }} · Workspace</span><small>Browser tab preview</small>
    </div>
    <div class="workspace-grid">
      <aside class="brand-sidebar">
        <div class="identity">
          @if (logo() && !logoFailed()) {
            <img
              class="company-logo"
              [src]="logo()"
              (error)="logoFailed.set(true)"
              alt="Company logo"
            />
          } @else {
            <span class="initials" aria-label="Default company logo">{{ initials() }}</span>
          }
          <strong>{{ name() }}</strong>
        </div>
        <p class="caption">COMPANY WORKSPACE</p>
        <nav aria-label="Tenant dashboard navigation">
          @for (item of tabs; track item) {
            <button
              type="button"
              [class.selected]="tab() === item"
              [attr.aria-current]="tab() === item ? 'page' : null"
              (click)="tab.set(item); menuOpen.set(false)"
            >
              {{ item }}
            </button>
          }
        </nav>
        <small>Tenant Admin access</small>
      </aside>
      <div class="workspace-content">
        <header class="brand-header">
          <div>
            <small>YOUR WORKSPACE</small><strong>{{ name() }}</strong>
          </div>
          <button
            class="mobile-menu"
            type="button"
            [attr.aria-expanded]="menuOpen()"
            (click)="menuOpen.set(!menuOpen())"
          >
            {{ menuOpen() ? 'Close menu' : 'Menu' }}</button
          ><span class="role-badge">Tenant Admin</span>
        </header>
        @if (menuOpen()) {
          <nav class="mobile-nav" aria-label="Mobile tenant navigation">
            @for (item of tabs; track item) {
              <button
                type="button"
                [attr.aria-current]="tab() === item ? 'page' : null"
                (click)="tab.set(item); menuOpen.set(false)"
              >
                {{ item }}
              </button>
            }
          </nav>
        }
        <div class="dashboard-main">
          <div class="page-title">
            <p class="caption">
              {{ tab() === 'Overview' ? 'WORKSPACE HOME' : 'COMPANY WORKSPACE' }}
            </p>
            <h2>{{ tab() === 'Overview' ? 'Welcome to ' + name() : tab() }}</h2>
            <p>
              {{
                identity()?.description ||
                  'Your company identity and workspace access, in one place.'
              }}
            </p>
          </div>
          <div class="tabs" role="group" aria-label="Dashboard sections">
            @for (item of tabs; track item) {
              <button
                type="button"
                [class.active]="tab() === item"
                [attr.aria-pressed]="tab() === item"
                (click)="tab.set(item)"
              >
                {{ item }}
              </button>
            }
          </div>
          @if (tab() === 'Overview') {
            <div class="card-grid">
              <section class="brand-card">
                <span class="section-accent"></span>
                <h3>Company identity</h3>
                <p>Your workspace uses {{ name() }}’s configured logo, colours and typography.</p>
                <button type="button" class="brand-action" (click)="tab.set('Company details')">
                  View company details
                </button>
              </section>
              <section class="brand-card">
                <h3>Workspace access</h3>
                <p>
                  Your Tenant Admin membership applies to this company. Platform settings remain
                  managed by SELISE.
                </p>
                <button
                  type="button"
                  class="support-action"
                  (click)="tab.set('Access information')"
                >
                  Access information
                </button>
              </section>
            </div>
            <section class="brand-card scope-note">
              <h3>Your workspace</h3>
              <p>
                This dashboard provides company identity and access information. Product, pricing
                and quotation modules are not available yet.
              </p>
            </section>
          } @else if (tab() === 'Company details') {
            <section class="brand-card">
              <h3>Company details</h3>
              <label [for]="controlId()">Company name</label
              ><input [id]="controlId()" [value]="name()" readonly />
              <p class="hint">
                Read-only company identity. Contact your platform administrator to request changes.
              </p>
              <div class="table-scroll">
                <table>
                  <caption>
                    Configured workspace appearance
                  </caption>
                  <thead>
                    <tr>
                      <th>Setting</th>
                      <th>Value</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <th scope="row">Primary colour</th>
                      <td>{{ primary() }}</td>
                    </tr>
                    <tr>
                      <th scope="row">Secondary colour</th>
                      <td>{{ secondary() }}</td>
                    </tr>
                    <tr>
                      <th scope="row">Typography</th>
                      <td>{{ identity()?.branding?.typography || 'System sans serif' }}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </section>
          } @else {
            <section class="brand-card">
              <h3>Tenant Admin access</h3>
              <p>
                Access is granted through an explicit accepted invitation and an enabled membership.
                The tenant must remain Active to open this workspace.
              </p>
              <p>
                Company contacts are separate from accounts. This interface does not grant platform
                administrator permissions.
              </p>
              <div class="access-summary"><strong>Role</strong><span>Tenant Admin</span></div>
            </section>
          }
        </div>
        <footer>{{ name() }} · Company workspace</footer>
      </div>
    </div>
  </section>`,
  styleUrl: './tenant-dashboard.scss',
})
export class TenantDashboard {
  constructor() {
    effect(() => {
      this.logo();
      this.logoFailed.set(false);
    });
    effect(() => {
      this.favicon();
      this.faviconFailed.set(false);
    });
  }
  readonly identity = input<DashboardIdentity | null>(null);
  readonly logo = input<string | null>(null);
  readonly favicon = input<string | null>(null);
  readonly font = input('system-ui, sans-serif');
  readonly demo = input(false);
  readonly controlId = input('workspace-company-name');
  readonly tab = signal('Overview');
  readonly menuOpen = signal(false);
  readonly logoFailed = signal(false);
  readonly faviconFailed = signal(false);
  readonly tabs = ['Overview', 'Company details', 'Access information'];
  readonly ink = brandingInk;
  name() {
    const i = this.identity();
    return i?.company_name_display
      ? i.display_name || i.company_name || 'Company workspace'
      : 'Company workspace';
  }
  initials() {
    return this.name()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((s) => s[0])
      .join('')
      .toUpperCase();
  }
  primary() {
    const c = this.identity()?.branding?.primary_colour;
    return c && /^#[0-9a-f]{6}$/i.test(c) ? c : '#17365D';
  }
  secondary() {
    const c = this.identity()?.branding?.secondary_colour;
    return c && /^#[0-9a-f]{6}$/i.test(c) ? c : '#2563EB';
  }
}
