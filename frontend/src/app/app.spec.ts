import { TestBed } from '@angular/core/testing';
import { App } from './app';
import { provideRouter } from '@angular/router';
import { Session } from './navigation/session';
import { signal } from '@angular/core';
import { of } from 'rxjs';

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [
        provideRouter([]),
        {
          provide: Session,
          useValue: { actor: signal({ id: 'test', role: 'super_admin' }), refresh: () => of(null) },
        },
      ],
    }).compileComponents();
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
    expect(compiled.querySelector('a[href="/tenants/new"]')).toBeTruthy();
  });
});
