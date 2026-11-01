export interface GearCombatState{bloodShield:number;bloodShieldTime:number;healClock:number;healUsed:number}
export const freshGearCombat=():GearCombatState=>({bloodShield:0,bloodShieldTime:0,healClock:0,healUsed:0});
export function validGearCombat(value:unknown):value is GearCombatState{
 if(!value||typeof value!=='object')return false;
 const b=value as GearCombatState,bounded=(n:unknown,max:number)=>typeof n==='number'&&Number.isFinite(n)&&n>=0&&n<=max;
 return Object.keys(b).length===4&&bounded(b.bloodShield,368)&&bounded(b.bloodShieldTime,6.001)&&bounded(b.healClock,1.000001)&&bounded(b.healUsed,1000);
}
