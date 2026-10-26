import { Injectable } from '@angular/core';
@Injectable({ providedIn: 'root' })
export class CreationNotice {
  private pending = false;
  created() {
    this.pending = true;
    try {
      sessionStorage.setItem('cpq-tenant-created', '1');
    } catch {}
  }
  consume() {
    let saved = false;
    try {
      saved = sessionStorage.getItem('cpq-tenant-created') === '1';
      sessionStorage.removeItem('cpq-tenant-created');
    } catch {}
    const result = this.pending || saved;
    this.pending = false;
    return result;
  }
}
