import { Routes } from '@angular/router';
import { TenantForm } from './tenant/tenant-form';
import { SavedBranding } from './tenant/saved-branding';
import { Component } from '@angular/core';

@Component({
  template: '<h1>Page unavailable</h1><p>This route is not part of the tenant form workspace.</p>',
})
class UnavailablePage {}

const preserveDraft = (component: TenantForm) =>
  !component.form.dirty || globalThis.confirm('Leave this page and discard unsaved changes?');

// Additive Member 1 reservations; list/detail/lifecycle remain Member 4 ownership.
export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'tenants/new' },
  { path: 'tenants/new', component: TenantForm, canDeactivate: [preserveDraft] },
  { path: 'tenants/:id/edit', component: TenantForm, canDeactivate: [preserveDraft] },
  { path: 'tenants/:id/branding', component: SavedBranding },
  { path: '**', component: UnavailablePage },
];
