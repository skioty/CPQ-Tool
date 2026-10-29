import { TenantSession } from './access/access-api';
import { TestBed } from '@angular/core/testing';
import { App } from './app';
import { provideRouter } from '@angular/router';
import { Session } from './navigation/session';
import { signal } from '@angular/core';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [
        provideRouter([]),
        { provide: TenantSession, useValue: { actor: signal(null), logout: () => of(null) } },
        {
          provide: Session,
          useValue: { actor: signal({ id: 'test', role: 'super_admin' }), refresh: () => of(null) },
        },
      ],
    }).compileComponents();
  });

  it('toggles the labelled compact navigation and supports Escape and dismissal', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    const toggle = fixture.nativeElement.querySelector('.menu-toggle') as HTMLButtonElement;
    expect(toggle.getAttribute('aria-controls')).toBe('workspace-nav');
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    toggle.click();
    fixture.detectChanges();
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    fixture.nativeElement
      .querySelector('nav')
      .dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    fixture.detectChanges();
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(document.activeElement).toBe(toggle);
    toggle.click();
    fixture.detectChanges();
    fixture.nativeElement
      .querySelector('nav')
      .dispatchEvent(new MouseEvent('click', { bubbles: true }));
    fixture.detectChanges();
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
  });
  it('clears a stale connection notice after successful authentication', async () => {
    const actor = signal<{ id: string; role: string } | null>(null);
    TestBed.overrideProvider(Session, {
      useValue: { actor, refresh: () => throwError(() => new Error('offline')) },
    });
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    expect(fixture.componentInstance.message()).toContain('Session could not be checked');
    actor.set({ id: 'test', role: 'super_admin' });
    fixture.detectChanges();
    await fixture.whenStable();
    expect(fixture.componentInstance.message()).toBe('');
  });
  it('expands on pointer entry and collapses on exit without a manual arrow', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    expect(fixture.componentInstance.collapsed()).toBe(true);
    fixture.componentInstance.sidebarPointer({ pointerType: 'mouse' } as PointerEvent, true);
    fixture.detectChanges();
    expect(fixture.componentInstance.collapsed()).toBe(false);
    fixture.componentInstance.sidebarPointer({ pointerType: 'mouse' } as PointerEvent, false);
    fixture.detectChanges();
    expect(fixture.componentInstance.collapsed()).toBe(true);
    fixture.componentInstance.sidebarPointer({ pointerType: 'touch' } as PointerEvent, true);
    expect(fixture.componentInstance.collapsed()).toBe(true);
    expect(fixture.nativeElement.querySelector('.collapse-toggle')).toBeNull();
    expect(
      fixture.nativeElement
        .querySelector('a[title="Reference options"]')
        .getAttribute('aria-label'),
    ).toBe('Reference options');
  });
  it('keeps navigation expanded while keyboard focus remains inside', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    const sidebar = fixture.nativeElement.querySelector('.sidebar') as HTMLElement;
    const link = sidebar.querySelector('a')!;
    fixture.componentInstance.sidebarFocus(
      { currentTarget: sidebar } as unknown as FocusEvent,
      true,
    );
    fixture.componentInstance.sidebarPointer({ pointerType: 'mouse' } as PointerEvent, false);
    expect(fixture.componentInstance.collapsed()).toBe(false);
    fixture.componentInstance.sidebarFocus(
      { currentTarget: sidebar, relatedTarget: link } as unknown as FocusEvent,
      false,
    );
    expect(fixture.componentInstance.collapsed()).toBe(false);
    fixture.componentInstance.sidebarFocus(
      { currentTarget: sidebar, relatedTarget: document.body } as unknown as FocusEvent,
      false,
    );
    expect(fixture.componentInstance.collapsed()).toBe(true);
  });
  it('keeps invitation pages full width even with a saved collapsed navigation preference', () => {
    const fixture = TestBed.createComponent(App);
    vi.spyOn(fixture.componentInstance.router, 'url', 'get').mockReturnValue('/invitations/accept');
    fixture.componentInstance.collapsed.set(true);
    fixture.detectChanges();
    const workspace = fixture.nativeElement.querySelector('.workspace') as HTMLElement;
    expect(workspace.classList.contains('auth-layout')).toBe(true);
    expect(workspace.classList.contains('nav-collapsed')).toBe(false);
    expect(fixture.nativeElement.querySelector('.sidebar')).toBeNull();
    expect(getComputedStyle(workspace).gridTemplateColumns).toBe('minmax(0, 1fr)');
    vi.restoreAllMocks();
  });
  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it('provides a skip link and a labelled workspace navigation', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('a.skip')?.getAttribute('href')).toBe('#main');
    expect(compiled.querySelector('nav')?.getAttribute('aria-label')).toBe('Workspace navigation');
    expect(compiled.querySelector('a[href="/tenants"]')).toBeTruthy();
  });
});
