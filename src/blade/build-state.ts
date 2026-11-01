export interface GearCombatState {
  heat:number; heatTime:number; strikes:number; empowered:number;
  shield:number; shieldTime:number; shieldCooldown:number; reflectCooldown:number;
  auraTick:number; healClock:number; healUsed:number;
}
export const freshGearCombat = ():GearCombatState => ({heat:0,heatTime:0,strikes:0,empowered:0,shield:0,shieldTime:0,shieldCooldown:0,reflectCooldown:0,auraTick:.5,healClock:0,healUsed:0});
export function validGearCombat(value:unknown):value is GearCombatState {
  if (!value || typeof value!=='object') return false;
  const b=value as GearCombatState;
  const bounded=(n:unknown,max:number)=>typeof n==='number'&&Number.isFinite(n)&&n>=0&&n<=max;
  return Number.isInteger(b.heat)&&bounded(b.heat,4)&&bounded(b.heatTime,2.001)
    && Number.isInteger(b.strikes)&&bounded(b.strikes,3)&&bounded(b.empowered,3.001)
    && bounded(b.shield,640)&&bounded(b.shieldTime,3.001)&&bounded(b.shieldCooldown,16.001)&&bounded(b.reflectCooldown,.751)
    && bounded(b.auraTick,.501)&&bounded(b.healClock,1.000001)&&bounded(b.healUsed,1000);
}
