import { Component, input, inject } from '@angular/core';
import { ASSET_URL, FORM_OPTIONS, Tenant } from './tenant.types';

@Component({
  selector: 'app-branding-preview',
  template: ` <section
    class="preview"
    aria-label="Tenant workspace branding preview"
    [style.font-family]="font()"
  >
    <header
      [style.background-color]="colour(tenant()?.branding?.primary_colour)"
      [style.color]="ink(tenant()?.branding?.primary_colour)"
    >
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
      <small>YOUR WORKSPACE</small>
      <h3>A workspace of your own</h3>
      <p>{{ tenant()?.description || 'Your company, connected.' }}</p>
      <span
        class="sample"
        [style.background-color]="colour(tenant()?.branding?.secondary_colour)"
        [style.color]="ink(tenant()?.branding?.secondary_colour)"
        >Explore workspace</span
      >
    </div>
  </section>`,
  styles: `
    :host {
      display: block;
    }
    .preview {
      border: 1px solid #e4e8ef;
      border-radius: 10px;
      overflow: hidden;
      background: #fff;
      color: #17263a;
    }
    header {
      overflow-wrap: anywhere;
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 22px;
      min-height: 48px;
      background: #f0f3f8;
      flex-wrap: wrap;
    }
    .logo {
      max-width: 100px;
      max-height: 64px;
      object-fit: contain;
    }
    .workspace {
      padding: 22px;
      overflow-wrap: anywhere;
    }
    small {
      letter-spacing: 0.1em;
    }
    .sample {
      display: inline-block;
      padding: 10px 16px;
      border-radius: 8px;
      background: #f0f3f8;
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
  ink(value: unknown) {
    if (typeof value !== 'string' || !/^#[0-9a-f]{6}$/i.test(value)) return '#17263a';
    const channels = [1, 3, 5]
      .map((i) => parseInt(value.slice(i, i + 2), 16) / 255)
      .map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
    const light = channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
    return light > 0.179 ? '#000000' : '#ffffff';
  }
  font() {
    return (
      this.options.typography.find((x) => x.id === this.tenant()?.branding.typography)
        ?.fontFamily || 'inherit'
    );
  }
}
