export interface GearCombatState{lightning:number}
export const freshGearCombat=():GearCombatState=>({lightning:0});
export function validGearCombat(value:unknown):value is GearCombatState{
 if(!value||typeof value!=='object')return false;
 const b=value as GearCombatState;
 return Object.keys(b).length===1&&Number.isInteger(b.lightning)&&b.lightning>=0&&b.lightning<5;
}
