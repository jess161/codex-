// Version 9 had nine unrestricted, purely numerical items. Keep its validator
// independent of the current catalogue so a redesign cannot misread old ranks/prices.
const prices = {jellyVest:30,bubbleGuard:35,honeyCharm:28,sugarCore:32,clockGrip:36,clearLens:30,breezeBoots:28,springBoots:32,pickupBoots:26};
export function validLegacyEconomy(value: unknown): boolean {
  if (!value || typeof value !== 'object') return false;
  const e = value as {wallet:number;earned:number;spent:number;gear:Record<string,number>;order:string[];regen:number};
  const ids = Object.keys(prices);
  return [e.wallet,e.earned,e.spent].every(n => Number.isSafeInteger(n) && n >= 0 && n <= 1e9)
    && e.wallet + e.spent === e.earned && !!e.gear && Object.keys(e.gear).length === ids.length
    && ids.every(id => Number.isInteger(e.gear[id]) && e.gear[id] >= 0 && e.gear[id] <= 5)
    && e.spent === ids.reduce((sum,id) => sum + e.gear[id] * prices[id as keyof typeof prices] + 12 * e.gear[id] * (e.gear[id]-1),0)
    && Array.isArray(e.order) && new Set(e.order).size === e.order.length && e.order.length === ids.filter(id => e.gear[id]>0).length
    && e.order.every(id => ids.includes(id) && e.gear[id]>0) && Number.isFinite(e.regen) && e.regen>=0 && e.regen<5.000001;
}
