import {NodeZone,contact,gestureBindings} from './gestures.js?v=19';
const KEY='camera-fx-tutorial-v1';
const steps=[
 {group:1,title:'Formá el encuadre',text:'Mostrá ambas manos y separá los índices de los pulgares. Las puntas de esos cuatro dedos forman los cuatro vértices del encuadre.',kind:'polygon',success:'¡Perfecto! Este es tu encuadre.'},
 {group:2,title:'Cambiá al filtro siguiente',text:'Juntá pulgar + índice de tu mano derecha.',event:'FILTER_NEXT',side:'Right',tip:8,success:'¡Perfecto! Filtro siguiente.'},
 {group:2,title:'Ahora volvé al filtro anterior',text:'Juntá pulgar + índice de tu mano izquierda.',event:'FILTER_PREVIOUS',side:'Left',tip:8,success:'¡Perfecto! Filtro anterior.',note:'Derecha avanza. Izquierda retrocede. Izquierda y derecha se refieren a tus manos reales, aunque la cámara se muestre como un espejo.'},
 {group:3,title:'Fijá una mitad del encuadre',text:'Juntá pulgar + meñique izquierdo.',event:'LOCK_LEFT',side:'Left',tip:20,kind:'lock',success:'¡Perfecto! Dos vértices fijos.',note:'Práctica simulada: podés mover la otra mano mientras estos dos puntos permanecen en su lugar.'},
 {group:3,title:'Liberá esos dos vértices',text:'Separá los dedos y repetí pulgar + meñique izquierdo.',event:'LOCK_LEFT',side:'Left',tip:20,kind:'unlock',success:'¡Perfecto! Vértices libres.',note:'Podés fijar ninguno, una mitad o las dos mitades. Cada meñique controla los vértices de su mano.'},
 {group:4,title:'Sacá una foto',text:'Juntá pulgar + dedo medio de tu mano derecha.',event:'PHOTO_NOW',side:'Right',tip:12,kind:'photo',success:'¡Perfecto! Foto inmediata.',note:'Solo estamos practicando: no se guardará ninguna foto.'},
 {group:4,title:'Probá el temporizador',text:'Juntá pulgar + dedo medio de tu mano izquierda.',event:'PHOTO_TIMER',side:'Left',tip:12,kind:'timer',success:'¡Perfecto! Foto con temporizador.',note:'En uso normal, la foto se toma después de dos segundos. El contador no aparece en la foto.'},
 {group:5,title:'Ocultá los bordes',text:'Juntá pulgar + anular izquierdo.',event:'BORDERS',side:'Left',tip:16,success:'¡Perfecto! Mostrar u ocultar bordes.',note:'El anular es el dedo entre el medio y el meñique.'},
 {group:5,title:'Ocultá los puntos',text:'Juntá pulgar + anular derecho.',event:'POINTS',side:'Right',tip:16,success:'¡Perfecto! Mostrar u ocultar puntos.',note:'El seguimiento sigue funcionando aunque las marcas estén ocultas.'}
];
function handSvg(tip=8,side='Right'){
 const fingers=[{tip:8,x:77,y:42},{tip:12,x:107,y:25},{tip:16,x:137,y:38},{tip:20,x:164,y:67}];
 const line=(points,end,active)=>`<polyline points="${points}" class="${active?'finger-active':'finger-muted'}">${active?`<animate attributeName="points" values="${points};${end};${end};${points};${points}" keyTimes="0;.35;.5;.8;1" dur="2.8s" repeatCount="indefinite"/>`:''}</polyline>`;
 const thumb=line('82,165 48,140 27,112','82,165 61,135 74,112',true);
 const paths=fingers.map(f=>line(`${f.x},153 ${f.x},95 ${f.x},${f.y}`,`${f.x},153 ${f.x},123 74,112`,f.tip===tip)).join('');
 return `<svg viewBox="0 0 210 215" role="img" aria-label="Mano ${side==='Left'?'izquierda':'derecha'} : pulgar y ${({8:'índice',12:'medio',16:'anular',20:'meñique'})[tip]} se juntan y se separan"><g ${side==='Left'?'transform="translate(210 0) scale(-1 1)"':''} fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"><path class="finger-muted" d="M77 151 L72 178 Q110 201 153 174 L164 148"/>${thumb}${paths}<circle cx="74" cy="112" r="11" class="contact-ring"><animate attributeName="opacity" values="0;0;1;0;0" keyTimes="0;.25;.45;.75;1" dur="2.8s" repeatCount="indefinite"/></circle></g></svg>`;
}
function polygonSvg(){return `<svg viewBox="0 0 380 150" role="img" aria-label="Índices y pulgares de ambas manos forman un encuadre"><g fill="none" stroke="currentColor" stroke-width="2"><path d="M75 45 L305 45 L280 120 L100 120 Z"/><circle cx="75" cy="45" r="5"/><circle cx="305" cy="45" r="5"/><circle cx="100" cy="120" r="5"/><circle cx="280" cy="120" r="5"/><path d="M40 80 L75 45 M40 80 L100 120 M340 80 L305 45 M340 80 L280 120"><animate attributeName="opacity" values=".4;1;.4" dur="2s" repeatCount="indefinite"/></path></g><g fill="currentColor" font-size="12" text-anchor="middle"><text x="75" y="25">Índice</text><text x="305" y="25">Índice</text><text x="100" y="145">Pulgar</text><text x="280" y="145">Pulgar</text></g></svg>`}
export class TutorialController {
 constructor(api){
  this.api=api;this.active=false;this.index=-1;this.pending=false;this.timers=[];this.serial=0;this.readings={};this.lastPacket=-Infinity;this.practice=new NodeZone();
  this.dialog=document.createElement('dialog');this.dialog.id='tutorial-dialog';this.dialog.setAttribute('aria-labelledby','tutorial-title');
  this.dialog.innerHTML=`<div class="tutorial-shell"><header class="tutorial-top"><span id="tutorial-progress">BIENVENIDA</span><button id="tutorial-skip" class="quiet">SALTAR TUTORIAL</button></header><div class="tutorial-content"><div id="tutorial-animation"></div><h2 id="tutorial-title" tabindex="-1"></h2><p id="tutorial-text"></p><p id="tutorial-note"></p><div id="tutorial-summary" hidden></div><div id="tutorial-status" role="status" aria-live="polite"></div><p id="tutorial-hand-hint"></p></div><footer class="tutorial-bottom"><p id="tutorial-click-hint">Juntá un solo dedo con el pulgar a la vez y separalos claramente entre acciones. En modo Liviano, sostené el contacto un poquito más.</p><button id="tutorial-primary" class="primary">EMPEZAR</button></footer></div>`;
  document.body.append(this.dialog);this.el=id=>this.dialog.querySelector('#tutorial-'+id);
  this.el('skip').onclick=()=>this.close(false);this.dialog.addEventListener('cancel',e=>{e.preventDefault();this.close(false)});
  this.el('primary').onclick=()=>this.primary();
 }
 firstVisit(){try{return !localStorage.getItem(KEY)}catch{return true}}
 after(fn,ms){const serial=this.serial;this.timers.push(setTimeout(()=>{if(this.active&&serial===this.serial)fn()},ms))}
 clear(){this.serial++;this.timers.forEach(clearTimeout);this.timers=[];clearInterval(this.watchdog)}
 open(){if(this.active)return;this.active=true;this.index=-1;this.pending=false;this.practice.reset();this.readings={};this.lastPacket=-Infinity;this.api.enter();this.dialog.showModal();document.body.classList.add('tutorial-active');this.render();this.watchdog=setInterval(()=>this.status(),200)}
 close(completed){if(!this.active)return;this.clear();this.active=false;this.pending=false;this.practice.reset();this.el('animation').replaceChildren();this.dialog.close();document.body.classList.remove('tutorial-active');try{localStorage.setItem(KEY,JSON.stringify({status:completed?'completed':'skipped'}))}catch{}this.api.exit();document.querySelector('#tutorial-open')?.focus()}
 async primary(){
  if(this.index===steps.length){this.close(true);return}
  const serial=this.serial;this.el('primary').disabled=true;
  await this.api.startCamera();
  if(!this.active||serial!==this.serial)return;
  this.el('primary').disabled=false;
  if(this.api.camera().running){if(this.index===-1)this.advance();else this.status()}
  else{this.el('status').textContent=this.api.camera().error||'No pudimos activar la cámara. Revisá el permiso y volvé a intentar.';this.el('primary').textContent='REINTENTAR CÁMARA'}
 }
 advance(){this.index++;this.pending=false;this.polygonSince=null;this.api.rearm();this.render()}
 render(){
  const step=steps[this.index],intro=this.index<0,done=this.index===steps.length;
  this.el('progress').textContent=intro?'BIENVENIDA':`${done?6:step.group} / 6`;
  this.el('title').textContent=intro?'Usá tus manos para controlar Camera FX':done?'Listo para usar Camera FX':step.title;
  this.el('text').textContent=intro?'Para usar los gestos, activá la cámara y mantené las manos dentro de la imagen, con los dedos visibles y buena iluminación.':done?'Tu cámara, tus gestos. Ya podés empezar.':step.text;
  this.el('note').textContent=intro?'Cada gesto funciona como un click: juntá el pulgar con el dedo correspondiente, mantenelos juntos un instante y después separalos. Mantenerlos juntos no repite la acción. Para hacer otro click, separalos y volvé a juntarlos.':done?'Izquierda y derecha se refieren a tus manos reales, aunque la cámara se muestre como un espejo.':step.note||'Probalo para continuar. No cambiaremos tus ajustes durante la práctica.';
  this.el('animation').classList.remove('tutorial-flash');this.el('animation').innerHTML=done?'':step?.kind==='polygon'?polygonSvg():handSvg(step?.tip,step?.side);
  this.el('summary').hidden=!done;
  if(done)this.el('summary').innerHTML=`<section><h3>MANO IZQUIERDA</h3><p>Índice · filtro anterior<br>Medio · foto con temporizador<br>Anular · mostrar/ocultar bordes<br>Meñique · fijar/liberar sus vértices</p></section><section><h3>MANO DERECHA</h3><p>Índice · filtro siguiente<br>Medio · foto inmediata<br>Anular · mostrar/ocultar puntos<br>Meñique · fijar/liberar sus vértices</p></section><p>Siempre en contacto con el pulgar.</p>`;
  this.el('primary').hidden=!(intro||done);this.el('primary').disabled=false;this.el('primary').textContent='EMPEZAR';
  this.el('status').textContent='';this.el('hand-hint').textContent='';this.el('title').focus();this.status();
 }
 status(){
  if(!this.active||this.index<0||this.index>=steps.length||this.pending)return;
  const state=this.api.camera();this.el('primary').hidden=state.running||state.starting;
  if(!state.running){this.polygonSince=null;this.el('primary').textContent='ACTIVAR CÁMARA';this.el('status').textContent=state.starting?'Abriendo cámara…':state.error||'Activá la cámara para practicar.';return}
  if(!state.ready){this.polygonSince=null;this.el('status').textContent='Preparando el seguimiento de manos…';return}
  const step=steps[this.index];const readings=performance.now()-this.lastPacket>400?{}:this.readings;
  const required=step.kind==='polygon'?['Left','Right']:[gestureBindings.find(b=>b.event===step.event).side];
  const missing=required.some(side=>!readings[side]);
  this.el('status').textContent=missing?'Tienen que verse tus manos por la cámara':'Esperando tu gesto…';
  this.el('hand-hint').textContent=missing&&step.side?`Mostrá tu mano ${step.side==='Left'?'izquierda':'derecha'} a la cámara.`:'';
  if(missing)this.polygonSince=null;
 }
 update(readings,now,w,h){
  if(!this.active)return;if(now-this.lastPacket>400)this.polygonSince=null;this.readings=readings;this.lastPacket=now;this.practice.update(readings,w,h);this.status();
  const step=steps[this.index];if(!step||this.pending||step.kind!=='polygon')return;
  const visible=side=>readings[side]&&[4,8].every(i=>{const p=readings[side][i];return p&&Number.isFinite(p.x)&&Number.isFinite(p.y)&&p.x>=0&&p.x<=1&&p.y>=0&&p.y<=1});
  const valid=visible('Left')&&visible('Right')&&this.practice.polygon&&['Left','Right'].every(side=>contact(readings[side],8,w,h,.3,.5)===false);
  if(!valid){this.polygonSince=null;return}if(this.polygonSince===null)this.polygonSince=now;if(now-this.polygonSince>=500)this.confirm();
 }
 event(event){
  if(!this.active||this.pending)return;const step=steps[this.index];if(!step||step.event!==event)return;
  if(step.kind==='lock'){if(!this.practice.toggle('Left')||!this.practice.fixed.Left)return}
  if(step.kind==='unlock'){if(!this.practice.fixed.Left||!this.practice.toggle('Left')||this.practice.fixed.Left)return}
  if(step.kind==='timer'){this.pending=true;this.el('status').textContent='2';this.after(()=>this.el('status').textContent='1',1000);this.after(()=>this.confirm(),2000);return}
  if(step.kind==='photo'){this.el('animation').classList.add('tutorial-flash');this.after(()=>this.el('animation').classList.remove('tutorial-flash'),200)}
  this.confirm();
 }
 confirm(){this.pending=true;this.el('status').textContent='✓ '+steps[this.index].success;this.el('hand-hint').textContent='';this.after(()=>this.advance(),550)}
}
