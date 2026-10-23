import { TestBed } from '@angular/core/testing';
import { provideHttpClient, withInterceptors, HttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { commercialErrors } from './approved-validation';
import { approvedFormOptions, ReferenceData } from './reference-data';
import { FORM_OPTIONS, emptyTenant } from './tenant.types';
import { DIRECTORY_POLICY } from '../navigation/tenant-directory';
import { sessionHeaders } from '../navigation/session';
import { TenantForm } from './tenant-form';
import { TenantGateway } from './tenant.gateway';
import { Session } from '../navigation/session';
import { provideRouter, ActivatedRoute, convertToParamMap } from '@angular/router';
import { of } from 'rxjs';
import { vi } from 'vitest';
function valid() { const t=emptyTenant();t.subscription={currency:'BTN',fee:'0',payment_method:'',discount:{type:'percentage',value:'0',duration:''}};return t; }
describe('approved subscription validation',()=>{
 it('permits free tenants without payment method or zero-discount duration',()=>expect(commercialErrors(valid())).toEqual([]));
 it('rejects negatives, excess precision, missing Other description and invalid cycles',()=>{
   for(const fee of ['-1','1.001','1000000000']) {const t=valid();t.subscription.fee=fee;expect(commercialErrors(t).length).toBeGreaterThan(0);}
   const t=valid();t.subscription.fee='10';t.subscription.payment_method='other';expect(commercialErrors(t).join()).toContain('Describe');
   t.subscription.payment_method_description='Agreed arrangement';t.subscription.discount={type:'percentage',value:'100',duration:'2'};expect(commercialErrors(t)).toEqual([]);
   t.subscription.discount.duration='1.5';expect(commercialErrors(t).join()).toContain('whole monthly');
 });
});
describe('approved integration policy',()=>{
 afterEach(()=>TestBed.resetTestingModule());
 it('maps API reference codes without inventing industries and keeps exactly-one assignment',()=>{
   TestBed.configureTestingModule({providers:[provideHttpClient(),provideHttpClientTesting(),{provide:FORM_OPTIONS,useFactory:approvedFormOptions}]});
   const options=TestBed.inject(FORM_OPTIONS);expect(options.industries).toEqual([]);expect(options.assignment).toBe('one');
   TestBed.inject(ReferenceData).load().subscribe();const http=TestBed.inject(HttpTestingController);
   http.expectOne('/api/v1/reference_options').flush({data:[{id:'record',kind:'industry',code:'approved',label:'Approved industry',enabled:true}],admins:[],typography:[]});
   expect(options.industries).toEqual([{id:'approved',label:'Approved industry'}]);http.verify();
 });
 it('displays only backend-provided lifecycle capabilities',()=>{
   const policy=TestBed.inject(DIRECTORY_POLICY);
   expect(policy.statuses.map(s=>s.value)).toEqual(['inactive','active','suspended','archived']);
   expect(policy.actions({permitted_actions:[]} as any)).toEqual([]);
   expect(policy.actions({permitted_actions:['restore']} as any)[0].confirmation).toContain('Activation is a separate step');
 });
 it('obtains CSRF before the first mutation after a page reload',()=>{
   TestBed.configureTestingModule({providers:[provideHttpClient(withInterceptors([sessionHeaders])),provideHttpClientTesting()]});
   const http=TestBed.inject(HttpTestingController);TestBed.inject(HttpClient).post('/api/v1/tenants/x/lifecycle',{action:'activate'}).subscribe();
   http.expectOne('/api/v1/session/csrf').flush({csrf_token:'synthetic'});
   const mutation=http.expectOne('/api/v1/tenants/x/lifecycle');expect(mutation.request.headers.get('X-CSRF-Token')).toBe('synthetic');mutation.flush({});http.verify();
 });
 it('removes saved assets explicitly and resets branding defaults without deleting contacts',async()=>{
   const t=valid();t.id='saved';t.branding.logo_attachment_id='old';
   await TestBed.configureTestingModule({imports:[TenantForm],providers:[provideRouter([]),{provide:FORM_OPTIONS,useFactory:approvedFormOptions},
     {provide:Session,useValue:{actor:()=>({role:'super_admin'})}}, {provide:TenantGateway,useValue:{load:()=>of(t),save:vi.fn()}},
     {provide:ActivatedRoute,useValue:{paramMap:of(convertToParamMap({id:'saved'}))}}]}).compileComponents();
   const f=TestBed.createComponent(TenantForm);f.detectChanges();const form=f.componentInstance;
   form.removeAsset('logo');expect(form.draft().branding.logo_attachment_id).toBeNull();
   form.resetBranding();expect(form.draft().branding.primary_colour).toBe('#17365D');expect(form.contacts.length).toBe(1);
 });
});
