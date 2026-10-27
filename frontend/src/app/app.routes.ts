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
  {path:'security/verify',title:'Verify sign-in | CPQ console',loadComponent:()=>import('./access/account-security').then(m=>m.FactorVerification)},
  {path:'security/microsoft',title:'Microsoft sign-in | CPQ console',loadComponent:()=>import('./access/account-security').then(m=>m.MicrosoftSignIn)},
  {path:'security/account',title:'Account security | CPQ console',loadComponent:()=>import('./access/account-security').then(m=>m.MicrosoftSignIn)},
  {path:'security/identity-error',title:'Sign-in unavailable | CPQ console',loadComponent:()=>import('./access/account-security').then(m=>m.IdentityError)},
  {
    path: 'administrators',
    title: 'Administrators | SELISE CPQ',
    loadComponent: () =>
      import('./access/administrator-manager').then((m) => m.AdministratorManager),
  },
  {
    path: 'tenant-login',
    title: 'Tenant sign in | SELISE CPQ',
    loadComponent: () => import('./access/tenant-login').then((m) => m.TenantLogin),
  },
  {
    path: 'invitations/accept',
    title: 'Your invitation | SELISE CPQ',
    loadComponent: () => import('./access/invitation-accept').then((m) => m.InvitationAccept),
  },
  {
    path: 'workspaces',
    title: 'Your workspaces | SELISE CPQ',
    loadComponent: () => import('./access/tenant-workspaces').then((m) => m.TenantWorkspaces),
  },
  {
    path: 'workspaces/:id',
    title: 'Company workspace | SELISE CPQ',
    loadComponent: () => import('./access/tenant-workspaces').then((m) => m.TenantWorkspaces),
  },
  {
    path: 'tenants/:id/setup',
    title: 'Tenant setup | SELISE CPQ',
    loadComponent: () => import('./access/setup-guide').then((m) => m.SetupGuide),
  },
  {
    path: 'tenants/:id/access',
    title: 'Tenant access | SELISE CPQ',
    loadComponent: () => import('./access/tenant-invitations').then((m) => m.TenantInvitations),
  },
  { path: '', pathMatch: 'full', redirectTo: 'tenants' },
  {
    path: 'reference-options',
    title: 'Reference options | SELISE CPQ',
    component: ReferenceManager,
  },
  { path: 'login', title: 'Sign in | SELISE CPQ', component: Login },
  { path: 'tenants', title: 'Tenants | SELISE CPQ', component: TenantList, resolve: {references: loadReferences} },
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
    path: 'tenants/:id/branding',
    title: 'Branding preview | SELISE CPQ',
    component: SavedBranding,
    resolve: { references: loadReferences },
  },
  {
    path: 'tenants/:id',
    title: 'Company overview | SELISE CPQ',
    component: TenantDetail,
    resolve: { references: loadReferences },
  },
  { path: '**', component: UnavailablePage },
];
