export const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
export function distance(a,b,w=1,h=1){return Math.hypot((a.x-b.x)*w,(a.y-b.y)*h)}
export function contact(hand,tip,w,h,on=.4,off=.6){const scale=distance(hand[0],hand[9],w,h);if(scale<1e-5)return null;const d=distance(hand[4],hand[tip],w,h)/scale;return d<on?true:d>off?false:null}
export class Click {
 constructor(){this.active=false;this.armed=false;this.candidate=null;this.since=0;this.last=-Infinity}
 update(value,now){if(value===null){this.candidate=null;return false}if(this.candidate!==value){this.candidate=value;this.since=now;return false}if(now-this.since<100)return false;if(!value){this.active=false;this.armed=true;return false}if(this.active)return false;this.active=true;const fire=this.armed&&now-this.last>=350;this.armed=false;if(fire)this.last=now;return fire}
}
export function dynamicIntensity(distanceRatio){let x=clamp((distanceRatio-.22)/(.75-.22),0,1);x=x*x*(3-2*x);return 10-5*x**1.35}
export function smoothIntensity(value,target,dt){let next=value+(target-value)*(1-Math.exp(-clamp(dt,0,150)/120));if(Math.abs(next-target)<.025)next=target;return clamp(next,5,10)}
export function zoneFromHands(hands){if(hands.length!==2)return null;const sorted=[...hands].sort((a,b)=>(a[4].x+a[8].x)-(b[4].x+b[8].x));return [sorted[0][8],sorted[1][8],sorted[1][4],sorted[0][4]].map(p=>({x:p.x,y:p.y}))}
export function validZone(points){if(!points||points.length!==4||!points.every(p=>Number.isFinite(p.x)&&Number.isFinite(p.y)))return false;let area=0;for(let i=0;i<4;i++){const a=points[i],b=points[(i+1)%4];area+=a.x*b.y-b.x*a.y}return Math.abs(area)>.0001}
