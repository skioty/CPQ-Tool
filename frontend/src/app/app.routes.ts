import { loadReferences } from './tenant/reference-data';
import { ReferenceManager } from './tenant/reference-manager';
import { Routes } from '@angular/router';
import { TenantForm } from './tenant/tenant-form';
import { SavedBranding } from './tenant/saved-branding';
import { Component } from '@angular/core';
import { TenantList } from './navigation/tenant-list';
import { TenantDetail } from './navigation/tenant-detail';
import { Login } from './navigation/login';

@Component({
  template: '<h1>Page unavailable</h1><p>This route is not part of the tenant form workspace.</p>',
})
class UnavailablePage {}

const preserveDraft = (component: TenantForm) =>
  !component.form.dirty || globalThis.confirm('Leave this page and discard unsaved changes?');

// Additive Member 1 reservations; list/detail/lifecycle remain Member 4 ownership.
export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'tenants' },
  { path: 'reference-options', component: ReferenceManager },
  { path: 'login', component: Login },
  { path: 'tenants', component: TenantList },
  { path: 'tenants/new', component: TenantForm, resolve: {references: loadReferences}, canDeactivate: [preserveDraft] },
  { path: 'tenants/:id/edit', component: TenantForm, resolve: {references: loadReferences}, canDeactivate: [preserveDraft] },
  { path: 'tenants/:id/branding', component: SavedBranding, resolve: {references: loadReferences} },
  { path: 'tenants/:id', component: TenantDetail },
  { path: '**', component: UnavailablePage },
];
