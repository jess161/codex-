import {RENDITION_APPEARANCES} from './assets/carrot-sword/rendition-layout';
import type {CarrotElements} from './carrot-elements';
import type {FormId} from './evolution/types';

export function carrotAppearance(form:FormId|null|undefined,elements:CarrotElements){
 const family=form??'base';
 const bits=(elements.fire?1:0)|(elements.frost?2:0)|(elements.poison?4:0)|(elements.electric?8:0);
 const bank=RENDITION_APPEARANCES[family] as Readonly<Record<number,string>>;
 return 'carrot-rendition-'+(bank[bits]??bank[0]);
}
export const CARROT_APPEARANCE_FAMILIES=[
 ['base','基础胡萝卜剑'],['fire','火元素'],['ice','冰元素'],['poison','毒元素'],['lightning','雷元素'],
 ['calamity','火＋冰＋毒'],['greatsword','巨剑'],['dual','双刃'],['wave','剑气'],
] as const;
