import { TestBed } from '@angular/core/testing';
import { FormControl, Validators } from '@angular/forms';
import { TenantField } from './tenant-field';
import { brandingInk } from './branding-colour';

describe('accessible tenant fields', () => {
  it('connects required errors and helper text to the input without showing untouched errors', () => {
    const fixture = TestBed.createComponent(TenantField);
    const control = new FormControl('', { nonNullable: true, validators: [Validators.required] });
    fixture.componentRef.setInput('field', {
      key: 'company_name',
      path: 'company_name',
      label: 'Company name',
      section: 'Company',
      help: 'Use the company name.',
    });
    fixture.componentRef.setInput('control', control);
    fixture.componentRef.setInput('required', true);
    fixture.detectChanges();
    const input = fixture.nativeElement.querySelector('input');
    expect(input.getAttribute('aria-required')).toBe('true');
    expect(input.getAttribute('aria-invalid')).toBeNull();
    expect(input.getAttribute('aria-describedby')).toBe('company_name-help');
    control.markAsTouched();
    fixture.detectChanges();
    expect(input.getAttribute('aria-invalid')).toBe('true');
    expect(input.getAttribute('aria-describedby')).toBe('company_name-help company_name-error');
    expect(fixture.nativeElement.querySelector('#company_name-error')?.textContent).toContain(
      'Company name is required',
    );
    control.setValue('Example');
    fixture.detectChanges();
    expect(input.getAttribute('aria-invalid')).toBeNull();
    expect(fixture.nativeElement.querySelector('#company_name-error')).toBeNull();
  });
  it('offers a decimal keyboard while preserving money as an exact string', () => {
    const fixture = TestBed.createComponent(TenantField);
    const control = new FormControl('12.30', { nonNullable: true });
    fixture.componentRef.setInput('field', {
      key: 'fee',
      path: 'subscription.fee',
      label: 'Subscription fee',
      section: 'Subscription',
    });
    fixture.componentRef.setInput('control', control);
    fixture.detectChanges();
    const input = fixture.nativeElement.querySelector('input');
    expect(input.getAttribute('inputmode')).toBe('decimal');
    expect(input.type).toBe('text');
    expect(control.value).toBe('12.30');
  });
});

describe('tenant branding contrast', () => {
  it('keeps normal preview text at 4.5:1 or above for light, dark and mid-tone custom colours', () => {
    const luminance = (hex: string) => {
      const c = [1, 3, 5]
        .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
        .map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
      return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
    };
    for (const background of [
      '#FFFFFF',
      '#000000',
      '#155E75',
      '#777777',
      '#FFEE00',
      '#C54432',
      '#00FFFF',
    ]) {
      const a = luminance(background),
        b = luminance(brandingInk(background));
      expect((Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)).toBeGreaterThanOrEqual(4.5);
    }
  });
});
