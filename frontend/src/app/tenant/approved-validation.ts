import { Tenant } from './tenant.types';
export function commercialErrors(t: Tenant): string[] {
  const s = t.subscription, errors: string[] = [];
  const decimal = (v: string) => /^\d+(?:\.\d{1,2})?$/.test(v);
  if (!decimal(s.fee) || Number(s.fee) > 999999999.99) errors.push('Monthly fee must be 0–999,999,999.99 with at most two decimal places.');
  if (Number(s.fee) > 0 && !s.payment_method) errors.push('Select a payment method for a paid subscription.');
  if (s.payment_method === 'other' && !s.payment_method_description?.trim()) errors.push('Describe the Other payment method.');
  const d = s.discount;
  if (d.type !== 'percentage' || !decimal(d.value) || Number(d.value) > 100) errors.push('Discount must be a percentage from 0 to 100 with at most two decimal places.');
  if ((Number(d.value) > 0 || !!d.duration) && !/^[1-9]\d*$/.test(d.duration)) errors.push('Discount duration must be positive whole monthly billing cycles.');
  return errors;
}
