import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { ReferenceOption, ReferenceResponse } from './reference-data';
import { Session } from '../navigation/session';
import { switchMap } from 'rxjs';
@Component({imports: [FormsModule], template: `
<h1>Platform reference options</h1>
<p>SELISE supplies industry values. Disable obsolete options to preserve historical references.</p>
@if (message()) { <p role="status">{{message()}}</p> }
@if (session.actor()?.role === 'super_admin') {
<form (ngSubmit)="add()">
<label for="kind">List</label><select id="kind" [(ngModel)]="kind" name="kind"><option value="industry">Industry</option><option value="currency">Currency</option><option value="payment_method">Payment method</option></select>
<label for="code">Stable code</label><input id="code" [(ngModel)]="code" name="code" required>
<label for="label">Label</label><input id="label" [(ngModel)]="label" name="label" required>
<button [disabled]="busy() || !code.trim() || !label.trim()">Add option</button>
</form>
<ul>@for(o of options(); track o.id) { <li>{{o.kind}}: {{o.label}} ({{o.code}}) — {{o.enabled ? 'Enabled' : 'Disabled'}} <button [disabled]="busy()" (click)="toggle(o)">{{o.enabled ? 'Disable' : 'Enable'}}</button></li> }</ul>
} @else { <p>Super Admin access is required to manage these lists.</p> }
`, styles: `form {display:grid;gap:10px;max-width:36rem} input,select,button {font:inherit;padding:10px} li {margin:12px 0}`})
export class ReferenceManager {
  private http = inject(HttpClient); readonly session = inject(Session);
  options = signal<ReferenceOption[]>([]); message = signal(''); busy = signal(false);
  kind = 'industry'; code = ''; label = '';
  constructor() { this.load(); }
  load() { this.http.get<ReferenceResponse>('/api/v1/reference_options?include_disabled=true').subscribe({next:r=>this.options.set(r.data),error:()=>this.message.set('Reference options could not be loaded. Sign in and retry.')}); }
  private mutate(method: 'post'|'patch', path: string, option: unknown) {
    if(this.busy()) return; this.busy.set(true);
    this.session.csrf().pipe(switchMap(()=>this.http.request(method,path,{body:{option}}))).subscribe({
      next:()=>{this.busy.set(false);this.message.set('Reference option saved.');this.load();},
      error:()=>{this.busy.set(false);this.message.set('Could not save. Check permissions and use a unique nonblank code.');}
    });
  }
  add() { this.mutate('post','/api/v1/reference_options',{kind:this.kind,code:this.code.trim(),label:this.label.trim()}); }
  toggle(o:ReferenceOption) { this.mutate('patch',`/api/v1/reference_options/${o.id}`,{enabled:!o.enabled}); }
}
