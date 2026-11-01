import type {GearId} from '../../src/blade/gear';
// Sample loadouts for combat regression only; the game does not offer build presets.
export const BUILDS = {
  critical:{name:'暴击爆发',hint:'暴击率 × 暴击倍率，瞬步接强化重击',core:['sugarCore','clearLens'],items:['sugarCore','clearLens','clockGrip','bloodFang','bubbleGuard','springBoots']},
  onhit:{name:'攻速特效',hint:'快速普攻叠热力，频繁触发破潮与电击',core:['clockGrip','tideFang','stormCoil'],items:['clockGrip','tideFang','stormCoil','bloodFang','bubbleGuard','pickupBoots']},
  sustain:{name:'吸血续航',hint:'吸血 × 治疗增幅，生命与护盾支撑持续输出',core:['bloodFang','honeyCharm'],items:['bloodFang','honeyCharm','clockGrip','jellyVest','bubbleGuard','pickupBoots']},
  burn:{name:'重装灼烧',hint:'最大生命提升灼烧伤害，也增强低血护盾',core:['emberPlate','jellyVest'],items:['emberPlate','jellyVest','honeyCharm','bubbleGuard','bloodFang','breezeBoots']},
  reflect:{name:'受击反伤',hint:'生命、减伤与恢复让反伤持续发挥',core:['thornArmor','jellyVest'],items:['thornArmor','jellyVest','honeyCharm','bubbleGuard','bloodFang','breezeBoots']},
} as const satisfies Record<string,{name:string;hint:string;core:readonly GearId[];items:readonly GearId[]}>;
