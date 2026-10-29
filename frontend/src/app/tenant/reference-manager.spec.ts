import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { ReferenceManager } from './reference-manager';
import { Session } from '../navigation/session';
it('searches the reference catalog by label, type and code without mutating saved options', () => {
  TestBed.configureTestingModule({
    providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
      { provide: Session, useValue: { actor: signal({ role: 'super_admin' }) } },
    ],
  });
  const fixture = TestBed.createComponent(ReferenceManager);
  const http = TestBed.inject(HttpTestingController);
  http.expectOne('/api/v1/reference_options?include_disabled=true').flush({
    data: [
      { id: 'one', kind: 'industry', code: 'manufacturing', label: 'Manufacturing', enabled: true },
      { id: 'two', kind: 'currency', code: 'BTN', label: 'Bhutan Ngultrum', enabled: true },
    ],
  });
  const manager = fixture.componentInstance;
  manager.catalogQuery = '  NGULTRUM ';
  expect(manager.filteredOptions().map((o) => o.id)).toEqual(['two']);
  manager.catalogQuery = 'INDUSTRY';
  expect(manager.filteredOptions().map((o) => o.id)).toEqual(['one']);
  manager.catalogQuery = 'BTN';
  expect(manager.filteredOptions().length).toBe(1);
  manager.catalogQuery = '';
  expect(manager.filteredOptions().length).toBe(2);
  expect(manager.options().length).toBe(2);
  http.verify();
});
