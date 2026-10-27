import { Component, input, inject } from '@angular/core';
import { ASSET_URL, FORM_OPTIONS, Tenant } from './tenant.types';
import { TenantDashboard } from './tenant-dashboard';
@Component({
  selector: 'app-branding-preview',
  imports: [TenantDashboard],
  template: `<section
    class="preview"
    aria-label="Tenant workspace branding preview"
    [style.font-family]="font()"
  >
    <app-tenant-dashboard
      [identity]="tenant()"
      [logo]="asset('logo')"
      [favicon]="asset('favicon')"
      [font]="font()"
      [demo]="true"
      controlId="preview-company-name"
    />
  </section>`,
  styles: `
    :host {
      display: block;
      min-width: 0;
    }
  `,
})
export class BrandingPreview {
  readonly tenant = input<Tenant | null>(null);
  readonly logo = input<string | null>(null);
  readonly favicon = input<string | null>(null);
  private readonly options = inject(FORM_OPTIONS);
  private readonly assetUrl = inject(ASSET_URL);
  asset(kind: 'logo' | 'favicon') {
    const local = kind === 'logo' ? this.logo() : this.favicon();
    const id = this.tenant()?.branding[`${kind}_attachment_id`];
    return local || (typeof id === 'string' ? this.assetUrl(id) : null);
  }
  font() {
    return (
      this.options.typography.find((x) => x.id === this.tenant()?.branding.typography)
        ?.fontFamily ||
      (this.tenant()?.branding.typography === 'open_sans'
        ? "'Open Sans', sans-serif"
        : this.tenant()?.branding.typography === 'serif'
          ? 'Georgia, serif'
          : 'system-ui, sans-serif')
    );
  }
}
