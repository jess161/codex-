export const FOODS = {
  berry: {name:'甜莓果',heal:8,weight:60},
  bread: {name:'暖面包',heal:16,weight:30},
  drumstick: {name:'烤鸡腿',heal:28,weight:10},
} as const;
export type FoodId = keyof typeof FOODS;
export const isFoodId = (id: unknown): id is FoodId => typeof id==='string' && Object.hasOwn(FOODS,id);
export function foodForRoll(roll: number): FoodId { return roll<.6?'berry':roll<.9?'bread':'drumstick'; }
