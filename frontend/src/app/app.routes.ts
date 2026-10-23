import { loadReferences } from './tenant/reference-data';
import { ReferenceManager } from './tenant/reference-manager';
import { Routes } from '@angular/router';
import { TenantForm } from './tenant/tenant-form';
import { SavedBranding } from './tenant/saved-branding';
import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TenantList } from './navigation/tenant-list';
import { TenantDetail } from './navigation/tenant-detail';
import { Login } from './navigation/login';

@Component({
  imports: [RouterLink],
  template:
    '<p class="eyebrow">PAGE NOT FOUND</p><h1>Let’s get you back on track.</h1><p class="subheading">This page may have moved or is no longer available.</p><a class="button primary" routerLink="/tenants">Back to tenants</a>',
})
class UnavailablePage {}

const preserveDraft = (component: TenantForm) =>
  !component.form.dirty || globalThis.confirm('Leave this page and discard unsaved changes?');

// Additive Member 1 reservations; list/detail/lifecycle remain Member 4 ownership.
export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'tenants' },
  { path: 'reference-options', title: 'Reference options | SELISE CPQ', component: ReferenceManager },
  { path: 'login', title: 'Sign in | SELISE CPQ', component: Login },
  { path: 'tenants', title: 'Tenants | SELISE CPQ', component: TenantList },
  {
    path: 'tenants/new',
    title: 'Create tenant | SELISE CPQ',
    component: TenantForm,
    resolve: { references: loadReferences },
    canDeactivate: [preserveDraft],
  },
  {
    path: 'tenants/:id/edit',
    title: 'Edit tenant | SELISE CPQ',
    component: TenantForm,
    resolve: { references: loadReferences },
    canDeactivate: [preserveDraft],
  },
  {
    path: 'tenants/:id/branding', title: 'Branding preview | SELISE CPQ',
    component: SavedBranding,
    resolve: { references: loadReferences },
  },
  { path: 'tenants/:id', title: 'Company overview | SELISE CPQ', component: TenantDetail, resolve: { references: loadReferences } },
  { path: '**', component: UnavailablePage },
];
