import { Component, input, inject } from '@angular/core';
import { ASSET_URL, FORM_OPTIONS, Tenant } from './tenant.types';

@Component({
  selector: 'app-branding-preview',
  template: ` <section
    class="preview"
    aria-label="Tenant workspace branding preview"
    [style.font-family]="font()"
  >
    <header [style.background-color]="colour(tenant()?.branding?.primary_colour)">
      @if (asset('logo')) {
        <img [src]="asset('logo')" alt="Company logo preview" class="logo" />
      }
      @if (tenant()?.company_name_display) {
        <strong>{{ tenant()?.company_name || 'Company name' }}</strong>
      }
      @if (asset('favicon')) {
        <img [src]="asset('favicon')" alt="Favicon preview" width="24" height="24" />
      }
    </header>
    <div class="workspace">
      <small>WORKSPACE PREVIEW</small>
      <h3>Welcome to your workspace</h3>
      <p>{{ tenant()?.description || 'Your company description will appear here.' }}</p>
      <span class="sample" [style.background-color]="colour(tenant()?.branding?.secondary_colour)"
        >Sample action</span
      >
    </div>
  </section>`,
  styles: `
    :host {
      display: block;
    }
    .preview {
      border: 1px solid #ccd5e0;
      border-radius: 16px;
      overflow: hidden;
      background: #fff;
      color: #17263a;
    }
    header {
      overflow-wrap: anywhere;
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 24px;
      min-height: 48px;
      background: #e9edf4;
      flex-wrap: wrap;
    }
    .logo {
      max-width: 100px;
      max-height: 64px;
      object-fit: contain;
    }
    .workspace {
      padding: 24px;
      overflow-wrap: anywhere;
    }
    small {
      letter-spacing: 0.1em;
    }
    .sample {
      display: inline-block;
      padding: 10px 16px;
      border-radius: 8px;
      background: #e9edf4;
      color: #17263a;
    }
    p {
      line-height: 1.6;
    }
    h3 {
      font-size: 1.4rem;
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
  colour(value: unknown) {
    return typeof value === 'string' && globalThis.CSS?.supports('color', value) ? value : null;
  }
  font() {
    return (
      this.options.typography.find((x) => x.id === this.tenant()?.branding.typography)
        ?.fontFamily || 'inherit'
    );
  }
}
