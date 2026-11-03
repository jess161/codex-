import type {ElementId,FormId,MutationId,UltimateId,UpgradeOption} from './types';

export const FORMS:Record<FormId,{name:string;damage:number;range:number;interval:number;width:number;slashes:number;wave:boolean}>={
 greatsword:{name:'巨剑',damage:1.65,range:1.48,interval:1.28,width:1.55,slashes:1,wave:false},
 dual:{name:'双刃',damage:.64,range:.82,interval:.74,width:.85,slashes:2,wave:false},
 wave:{name:'剑气',damage:.80,range:1.08,interval:1,width:1,slashes:1,wave:true},
};
export const ELEMENT_NAMES:Record<ElementId,string>={fire:'火',ice:'冰',poison:'毒',lightning:'雷'};
export const LIGHTNING_TARGET_LEVELS=[6,11,16,21] as const;
export const ELEMENT_RULES={
 fire:{duration:3,tick:.5,ranks:[{damage:.08,burst:.45,radius:55},{damage:.14,burst:.8,radius:75}]},
 poison:{maxStacks:5,tick:.5,eliteMultiplier:1.25,ranks:[{damage:.035,duration:4},{damage:.06,duration:5}]},
 ice:{duration:2,freezeStacks:3,freezeCooldown:4,ranks:[{slow:.35,resistantSlow:.18,freeze:.8},{slow:.5,resistantSlow:.25,freeze:1.2}]},
 lightning:{maxTargets:8,ranks:[{attacks:5,damage:.55,hopRange:125},{attacks:4,damage:.85,hopRange:155}]},
} as const;
export const ULTIMATE_RULES={calamity:[{cooldown:1.8,damage:1.4,radius:96},{cooldown:1.4,damage:2,radius:120}],myriad:[{spreads:[-.2,0,.2],orbitCooldown:1.8,pierce:3},{spreads:[-.36,-.18,0,.18,.36],orbitCooldown:1.3,pierce:3}]} as const;
export const SWORD_WAVE={range:360,speed:420,damage:.75,radius:22,hitRadius:10} as const;
export const MUTATION_RULES={extraSlashes:1,piercingTargets:5} as const;
export const MUTATION_NAMES:Record<MutationId,string>={extraSlash:'连续斩击',piercing:'穿透剑气',orbit:'旋转剑气',explosive:'爆裂斩'};
export const ULTIMATE_NAMES:Record<UltimateId,string>={calamity:'三灾觉醒',myriad:'万剑觉醒',inferno:'炼狱觉醒',thunderShadow:'雷影觉醒',permafrost:'永冻结界',plague:'瘟疫觉醒'};
const element=(id:ElementId,description:string):UpgradeOption=>({id:'element:'+id,name:ELEMENT_NAMES[id]+'元素附魔',description,kind:'element',elements:[id],color:{fire:'#ed8051',ice:'#80c9e6',poison:'#91bb49',lightning:'#a29ce9'}[id]});
export const UPGRADE_OPTIONS:UpgradeOption[]=[
 {id:'form:greatsword',name:'巨剑形态',description:'剑身变大，伤害 +65%，长度 +48%；攻击间隔增加 28%。本局锁定。',kind:'form',form:'greatsword',color:'#e4a45f'},
 {id:'form:dual',name:'双刃形态',description:'两把短剑连续挥砍；单次伤害为 64%，攻击间隔缩短 26%，长度为 82%。本局锁定。',kind:'form',form:'dual',color:'#74bdb2'},
 {id:'form:wave',name:'剑气形态',description:'每次挥砍发出一道剑气，射程 360；近战伤害为 80%，剑气造成该次伤害的 75%。本局锁定。',kind:'form',form:'wave',color:'#85a6d7'},
 {id:'mutation:extraSlash',name:'连续斩击',description:'每轮普攻增加一次完整斩击；每次斩击可附魔，雷电仍按整轮普攻充能。',kind:'mutation',mutation:'extraSlash',color:'#e6ac68'},
 {id:'mutation:piercing',name:'穿透剑气',description:'剑气可击中 5 个不同敌人；同一道剑气不会重复命中同一敌人。',kind:'mutation',mutation:'piercing',requires:{wave:true},color:'#8cbadc'},
 {id:'mutation:orbit',name:'旋转剑气',description:'后续开放：环绕角色的剑气。',kind:'mutation',mutation:'orbit',enabled:false,color:'#8cbadc'},
 {id:'mutation:explosive',name:'爆裂斩',description:'后续开放：命中产生范围爆炸。',kind:'mutation',mutation:'explosive',enabled:false,color:'#e6ac68'},
 element('fire','命中燃烧 3 秒，每半秒造成 8% 攻击力伤害；燃烧敌人死亡爆燃，不连爆。已有火附魔则升至Ⅱ级。'),
 element('ice','命中寒冷 2 秒，三次叠加冻结普通怪 0.8 秒；精英和首领只减速。已有冰附魔则升至Ⅱ级。'),
 element('poison','命中叠毒，持续 4 秒，最多 5 层；每层每半秒造成 3.5% 攻击力伤害，精英和首领额外 +25%。已有毒附魔则升至Ⅱ级。'),
 element('lightning','每 5 轮普攻击发连锁闪电，55% 攻击力，初始 4 个不同目标，随等级最多 8 个。已有雷附魔则升至Ⅱ级。'),
 ...([['fire','ice'],['fire','poison'],['ice','poison']] as ElementId[][]).map(elements=>({id:'pair:'+elements.join('+'),name:elements.map(e=>ELEMENT_NAMES[e]).join('＋')+'双重附魔',description:'同时获得这两种元素，各占一个元素槽。已有元素提升至Ⅱ级。为三灾构筑准备，也可搭配任意形态。',kind:'element' as const,elements,color:'#83bca3'})),
 {id:'ultimate:calamity',name:'三灾觉醒',description:'需要火＋冰＋毒。三灾反应范围 96，伤害 140%，每 1.8 秒最多触发一次；不改变已选武器形态。',kind:'ultimate',ultimate:'calamity',requires:{elements:['fire','ice','poison']},color:'#c794db'},
 {id:'ultimate:myriad',name:'万剑觉醒',description:'需要剑气形态＋连续斩击或穿透剑气。每斩三道剑气，穿透 +3；每 1.8 秒释放四向环绕剑气。',kind:'ultimate',ultimate:'myriad',requires:{form:'wave',anyMutation:['extraSlash','piercing']},color:'#aaa1e8'},
 {id:'ultimate:inferno',name:'炼狱觉醒',description:'后续开放。',kind:'ultimate',ultimate:'inferno',requires:{form:'greatsword',elements:['fire'],anyMutation:['explosive']},enabled:false,color:'#e6ac68'},
 {id:'ultimate:thunderShadow',name:'雷影觉醒',description:'后续开放。',kind:'ultimate',ultimate:'thunderShadow',requires:{form:'dual',elements:['lightning'],anyMutation:['extraSlash']},enabled:false,color:'#aaa1e8'},
 {id:'ultimate:permafrost',name:'永冻结界',description:'后续开放。',kind:'ultimate',ultimate:'permafrost',requires:{elements:['ice']},enabled:false,color:'#8cbadc'},
 {id:'ultimate:plague',name:'瘟疫觉醒',description:'后续开放。',kind:'ultimate',ultimate:'plague',requires:{elements:['poison']},enabled:false,color:'#91bb49'},
 {id:'boost:power',name:'磨砺锋刃',description:'本局攻击伤害提高 18%，可以重复选择。',kind:'boost',boost:'power',color:'#e6ac68'},
 {id:'boost:haste',name:'轻盈剑舞',description:'本局攻击间隔缩短 10%，可以重复选择。',kind:'boost',boost:'haste',color:'#74bdb2'},
 {id:'boost:reach',name:'延展剑锋',description:'本局剑身长度提高 12%，可以重复选择。',kind:'boost',boost:'reach',color:'#85a6d7'},
 {id:'ultimate:boost',name:'觉醒精炼',description:'三灾：反应伤害增至 200%，范围 120，冷却 1.4 秒。万剑：每斩五道剑气，环绕冷却 1.3 秒。',kind:'ultimateBoost',color:'#c794db'},
];
export const OPTION_BY_ID=Object.fromEntries(UPGRADE_OPTIONS.map(o=>[o.id,o])) as Record<string,UpgradeOption|undefined>;
