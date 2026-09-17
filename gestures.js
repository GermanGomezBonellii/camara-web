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

// Gentle axis alignment in pixel space; raw gesture landmarks stay untouched.
export function alignNodePair(hand,w=1,h=1){
 const pair=[hand[8],hand[4]].map(({x,y})=>({x,y}));
 const dx=Math.abs(pair[0].x-pair[1].x)*w,dy=Math.abs(pair[0].y-pair[1].y)*h;
 const vertical=dy>=dx,span=vertical?dy:dx;
 const palm=distance(hand[0],hand[9],w,h);
 if(span<Math.max((vertical?h:w)*.025,palm*.3))return {pair,strength:0,axis:null};
 const ratio=(vertical?dx:dy)/span;
 // Fully aligned within ~6 degrees; smoothly free again by ~13 degrees.
 const t=clamp((.23-ratio)/(.23-.10),0,1),strength=t*t*(3-2*t);
 const coordinate=vertical?'x':'y',center=(pair[0][coordinate]+pair[1][coordinate])/2;
 for(const p of pair)p[coordinate]+=(center-p[coordinate])*strength;
 return {pair,strength,axis:strength?(vertical?'vertical':'horizontal'):null};
}
// Locks belong to physical hands, never to detector array order.
export class NodeZone {
 constructor(){this.reset()}
 reset(){this.live={};this.fixed={};this.alignment={};this.sourceHands={}}
 update(readings,w=1,h=1){this.live={};this.alignment={};this.sourceHands=readings;for(const side of ['Left','Right']){const hand=readings[side];if(hand){const aligned=alignNodePair(hand,w,h);this.live[side]=aligned.pair;this.alignment[side]=aligned.strength}}}
 point(hand,tip){const side=['Left','Right'].find(side=>this.sourceHands[side]===hand);return side&&(tip===8||tip===4)?this.live[side][tip===8?0:1]:hand[tip]}
 toggle(side){if(this.fixed[side]){delete this.fixed[side];return true}if(!this.live[side])return false;this.fixed[side]=this.live[side].map(p=>({...p}));return true}
 get count(){return Object.keys(this.fixed).length}
 get polygon(){const pairs=['Left','Right'].map(side=>this.fixed[side]??this.live[side]);if(pairs.some(p=>!p))return null;pairs.sort((a,b)=>(a[0].x+a[1].x)-(b[0].x+b[1].x));const p=[pairs[0][0],pairs[1][0],pairs[1][1],pairs[0][1]];return validZone(p)?p:null}
}

// Keep the existing, user-verified filter direction. Other mappings are unchanged.
export const gestureBindings=[
 {key:'Left',side:'Left',tip:20,event:'LOCK_LEFT'},
 {key:'Right',side:'Right',tip:20,event:'LOCK_RIGHT'},
 {key:'photoLeft',side:'Left',tip:12,event:'PHOTO_TIMER'},
 {key:'photoRight',side:'Right',tip:12,event:'PHOTO_NOW'},
 {key:'ringLeft',side:'Left',tip:16,event:'BORDERS'},
 {key:'ringRight',side:'Right',tip:16,event:'POINTS'},
 {key:'effectLeft',side:'Left',tip:8,event:'FILTER_NEXT'},
 {key:'effectRight',side:'Right',tip:8,event:'FILTER_PREVIOUS'}
];
export const createGestureClicks=()=>Object.fromEntries(gestureBindings.map(b=>[b.key,new Click()]));
export function detectGestureEvents(readings,clicks,w,h,now){
 const events=[];
 for(const side of ['Left','Right']){
  const hand=readings[side];
  const values=Object.fromEntries([8,12,16,20].map(tip=>[tip,hand?contact(hand,tip,w,h,.35,.55):null]));
  const palm=hand?distance(hand[0],hand[9],w,h):0;
  const touching=hand&&palm>0?[8,12,16,20].filter(tip=>values[tip]===true).map(tip=>({tip,d:distance(hand[4],hand[tip],w,h)/palm})).sort((a,b)=>a.d-b.d):[];
  const winner=touching.length===1||touching.length>1&&touching[1].d-touching[0].d>=.08?touching[0].tip:null;
  for(const b of gestureBindings.filter(b=>b.side===side)){
   // A released finger must rearm even if another finger touches the thumb.
   const value=values[b.tip]===false?false:values[b.tip]===true&&b.tip===winner?true:null;
   if(clicks[b.key].update(value,now))events.push(b.event);
  }
 }
 return events;
}
