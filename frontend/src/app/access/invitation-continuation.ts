import { Injectable } from '@angular/core';
// Bearer credentials remain in memory only. Refresh requires reopening the email.
@Injectable({ providedIn: 'root' })
export class InvitationContinuation {
  token = '';
  tenantId = '';
}
