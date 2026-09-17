import {TutorialController} from './tutorial.js?v=22';
import {Renderer,categories,effects} from './renderer.js?v=7';
import {createGestureClicks,detectGestureEvents,gestureBindings,distance,dynamicIntensity,smoothIntensity,NodeZone,validZone,clamp} from './gestures.js?v=19';
const $=id=>document.getElementById(id),video=$('video'),canvas=$('camera'),ctx=canvas.getContext('2d');
const source=document.createElement('canvas'),src=source.getContext('2d'),finished=document.createElement('canvas'),out=finished.getContext('2d');
let renderer,stream,worker,ready=false,busy=false,running=false,starting=false,epoch=0,raf=0,workerTimer;
let effect=effects[0],dynamic=false,intensity=7,dynamicValue=7.5,target=7.5,transition=null;
let hands=[],trackingZone=null,lastDetection=0,lastSent=0,lastVideo=-1,lastRendered=-1,lastTick=0;
let photoPending=false,saving=false,preview=null,previewUntil=0,downloadURL=null,counter=0,audio;
const nodeZone=new NodeZone();
const freshClicks=createGestureClicks;let clicks=freshClicks();
let tutorial=null,gestureResumeAt=0,cameraError='',photoSession=0;
const profiles={eco:{width:640,tracking:384,interval:100},balanced:{width:800,tracking:480,interval:75},quality:{width:960,tracking:640,interval:50}};
let profileName='balanced';try{const saved=localStorage.getItem('camera-fx-performance');if(profiles[saved])profileName=saved}catch{}
let profile=profiles[profileName],videoCallback=0;
const detectorFrame=document.createElement('canvas'),detectorContext=detectorFrame.getContext('2d',{alpha:false});
function resizeFrames(){if(!video.videoWidth)return;const scale=Math.min(1,profile.width/video.videoWidth,720/video.videoHeight);const w=Math.round(video.videoWidth*scale),h=Math.round(video.videoHeight*scale);for(const c of [source,finished,canvas]){c.width=w;c.height=h}const ratio=Math.min(1,profile.tracking/w);detectorFrame.width=Math.round(w*ratio);detectorFrame.height=Math.round(h*ratio);lastRendered=-1}
$('performance').value=profileName;
$('performance').onchange=e=>{profileName=e.target.value;profile=profiles[profileName];try{localStorage.setItem('camera-fx-performance',profileName)}catch{}if(running)resizeFrames();$('performance-hint').textContent=profileName==='eco'?'Menor detalle en imagen y fotos; menor consumo.':profileName==='quality'?'Más detalle en imagen y fotos; mayor consumo.':'Equilibrio entre detalle y fluidez.'};
function scheduleFrame(){if(!running)return;if(video.requestVideoFrameCallback)videoCallback=video.requestVideoFrameCallback(now=>{videoCallback=0;tick(now)});else raf=requestAnimationFrame(tick)}
let toastTimer,photoTimer=null,photoDeadline=0;
function toast(message,duration=2400){if(!running)cameraError=message;$('toast').textContent=message;$('toast').classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').classList.remove('visible'),duration)}
function showCategory(name){document.querySelectorAll('#categories button').forEach(b=>b.setAttribute('aria-pressed',String(b.textContent===name)));$('effects').replaceChildren(...categories[name].map(name=>{const b=document.createElement('button');b.textContent=name;b.setAttribute('aria-pressed',String(name===effect));b.onclick=()=>selectEffect(name);return b}))}
function selectEffect(name){if(!effects.includes(name))throw Error('Efecto no válido');effect=name;$('effect-label').textContent=name;showCategory(Object.keys(categories).find(k=>categories[k].includes(name)))}
for(const name of Object.keys(categories)){const b=document.createElement('button');b.textContent=name;b.onclick=()=>showCategory(name);$('categories').append(b)}showCategory('Colores');
function setMode(value){dynamic=value;$('intensity').disabled=value;$('mode').setAttribute('aria-pressed',String(value));$('mode').textContent=value?'Usar fija':'Usar dinámica';$('mode-label').textContent=value?'DINÁMICA':'FIJA';$('dynamic-hint').hidden=!value;transition=value?{from:intensity,at:performance.now()}:null}
$('mode').onclick=()=>setMode(!dynamic);$('intensity').oninput=e=>{intensity=Number(e.target.value);$('value').value=intensity.toFixed(1)};
function updateZoneUI(){const count=nodeZone.count;$('locked').hidden=!count;$('locked').textContent=count===2?'4 NODOS FIJOS':`2 NODOS FIJOS · ${nodeZone.fixed.Left?'IZQUIERDA':'DERECHA'}`;$('freeze').textContent=count?'Liberar nodos':'Fijar todos';$('freeze').disabled=!running||(!count&&!nodeZone.polygon)}
function toggleHandNodes(side){if(!nodeZone.toggle(side))return false;toast(`Nodos de la mano ${side==='Left'?'izquierda':'derecha'} ${nodeZone.fixed[side]?'fijos':'libres'}`,900);updateZoneUI();return true}
function toggleZone(){if(nodeZone.count)nodeZone.fixed={};else if(nodeZone.polygon){for(const side of ['Left','Right'])nodeZone.toggle(side)}else{toast('Mostrá las dos manos para fijar todos los nodos.');return false}updateZoneUI();return true}
$('freeze').onclick=toggleZone;
function initAudio(){try{audio??=new (window.AudioContext||window.webkitAudioContext)();if(audio.state==='suspended')audio.resume().catch(()=>{})}catch{}}
function shutter(){try{if(!audio||audio.state!=='running')return;const buffer=audio.createBuffer(1,Math.ceil(audio.sampleRate*.16),audio.sampleRate),data=buffer.getChannelData(0);for(let i=0;i<data.length;i++){const t=i/audio.sampleRate;data[i]=(Math.random()*2-1)*(.6*Math.exp(-t*100)+(t>=.065?.4*Math.exp(-(t-.065)*100):0))}const sound=audio.createBufferSource();sound.buffer=buffer;sound.connect(audio.destination);sound.start()}catch{}}
function cancelPhotoTimer(){clearTimeout(photoTimer);photoTimer=null;photoDeadline=0;$('countdown').hidden=true}
function requestDelayedPhoto(){if(tutorial?.active)return false;initAudio();if(!running||saving||photoPending||photoTimer!==null||performance.now()<previewUntil)return false;photoDeadline=performance.now()+2000;const token=epoch;function update(){if(!running||epoch!==token){cancelPhotoTimer();return}const remaining=photoDeadline-performance.now();if(remaining<=0){cancelPhotoTimer();requestPhoto();return}$('countdown').hidden=false;$('countdown').textContent=String(Math.ceil(remaining/1000));photoTimer=setTimeout(update,Math.min(remaining,100))}update();return true}
function requestPhoto(){if(tutorial?.active)return false;initAudio();if(!running){toast('Activá la cámara primero.');return false}if(saving||photoPending||performance.now()<previewUntil)return false;cancelPhotoTimer();photoPending=true;return true}
$('capture').onclick=requestPhoto;
function savePhoto(){if(saving)return;saving=true;const snap=document.createElement('canvas');snap.width=finished.width;snap.height=finished.height;snap.getContext('2d').drawImage(finished,0,0);const currentEpoch=epoch,currentPhotoSession=photoSession;
 snap.toBlob(blob=>{saving=false;if(!blob){toast('No se pudo guardar la foto. Intentá de nuevo.');return}if(epoch!==currentEpoch||photoSession!==currentPhotoSession||tutorial?.active)return;preview=snap;previewUntil=performance.now()+1000;shutter();$('flash').classList.remove('flash');void $('flash').offsetWidth;$('flash').classList.add('flash');const previous=downloadURL;downloadURL=URL.createObjectURL(blob);if(previous)setTimeout(()=>URL.revokeObjectURL(previous),60000);const name=`camera_fx_${new Date().toISOString().replace(/[:.]/g,'-')}_${++counter}.png`;const link=$('download');link.href=downloadURL;link.download=name;link.hidden=false;link.click();toast('Foto lista. Si no se descargó, usá el enlace de abajo.',2400)},'image/png')}
function processHands(data){busy=false;if(!running||performance.now()-data.time>400)return;lastDetection=performance.now();hands=data.landmarks;const readings={};for(let i=0;i<hands.length;i++){const label=data.handedness[i]?.[0];if(!label||label.score<.8)continue;const side=label.categoryName;if(side!=='Left'&&side!=='Right')continue;readings[side]=side in readings?null:hands[i]}
 nodeZone.update(readings,source.width,source.height);trackingZone=nodeZone.polygon;
 const now=performance.now(),events=detectGestureEvents(readings,clicks,source.width,source.height,now);
 if(tutorial?.active){tutorial.update(readings,now,source.width,source.height);for(const event of events)tutorial.event(event)}
 else if(now>=gestureResumeAt)executeGestureEvents(events);

 if(hands.length===2)target=dynamicIntensity(distance(hands[0][0],hands[1][0],source.width,source.height)/source.width);$('tracking').textContent=hands.length?`${hands.length} mano${hands.length===1?'':'s'} detectada${hands.length===1?'':'s'}`:'Esperando manos';updateZoneUI()}
function executeGestureEvents(events){
 for(const side of ['Left','Right'])if(events.includes(side==='Left'?'LOCK_LEFT':'LOCK_RIGHT'))toggleHandNodes(side);
 for(const [event,id,label] of [['BORDERS','border','Bordes'],['POINTS','points','Puntos']])if(events.includes(event)){const control=$(id);control.checked=!control.checked;toast(`${label} ${control.checked?'activados':'desactivados'}`,900)}
 if(events.includes('PHOTO_NOW'))requestPhoto();else if(events.includes('PHOTO_TIMER'))requestDelayedPhoto();
 const cycle=Number(events.includes('FILTER_NEXT'))-Number(events.includes('FILTER_PREVIOUS'));
 if(cycle){selectEffect(effects[(effects.indexOf(effect)+cycle+effects.length)%effects.length]);toast(effect,450)}
}
function startWorker(currentEpoch){worker=new Worker(new URL('./tracker.js',import.meta.url));worker.onmessage=({data})=>{if(epoch!==currentEpoch)return;if(data.type==='ready'){clearTimeout(workerTimer);ready=true;$('tracking').textContent='Esperando manos'}else if(data.type==='hands')processHands(data);else {console.error('Seguimiento:',data.message);failTracking()}};worker.onerror=event=>{console.error('Worker:',event.message);if(epoch===currentEpoch)failTracking()};workerTimer=setTimeout(()=>{if(epoch===currentEpoch&&!ready)failTracking()},45000);worker.postMessage({type:'init'})}
function failTracking(){stopCamera();toast('No se pudo iniciar el seguimiento de manos. Revisá la conexión y volvé a activar la cámara.',6000)}
async function startCamera(){if(starting||running)return;starting=true;cameraError='';const token=++epoch;initAudio();$('start').disabled=true;$('start').textContent='Abriendo cámara…';
 try{if(!window.isSecureContext||!navigator.mediaDevices?.getUserMedia)throw Error('Abrí esta página con HTTPS o desde localhost para usar la cámara.');renderer??=new Renderer();const obtained=await navigator.mediaDevices.getUserMedia({video:{facingMode:'user',width:{ideal:1280},height:{ideal:720},frameRate:{ideal:30,max:30}},audio:false});if(epoch!==token){obtained.getTracks().forEach(t=>t.stop());return}stream=obtained;video.srcObject=stream;await video.play();if(epoch!==token)return;
 resizeFrames();running=true;ready=false;busy=false;lastSent=0;lastVideo=-1;lastRendered=-1;lastTick=performance.now();clicks=freshClicks();hands=[];trackingZone=null;nodeZone.reset();preview=null;previewUntil=0;
 $('welcome').hidden=true;$('stop').hidden=false;$('capture').disabled=false;$('tracking').textContent='Preparando seguimiento…';startWorker(token);scheduleFrame();stream.getVideoTracks()[0].addEventListener('ended',()=>{if(running&&epoch===token){stopCamera();toast('La cámara se desconectó. Podés volver a activarla.')}});
 }catch(error){if(epoch===token){stopCamera();const messages={NotAllowedError:'No se habilitó la cámara. Permití el acceso desde el navegador y volvé a intentar.',NotFoundError:'No encontramos una cámara conectada.',NotReadableError:'La cámara está ocupada. Cerrá la aplicación de Python u otra app que la esté usando.'};toast(messages[error.name]||error.message||'No se pudo abrir la cámara.',7000)}}finally{if(epoch===token||!running){starting=false;$('start').disabled=false;$('start').textContent='Activar cámara'}}}
function stopCamera(){cancelPhotoTimer();epoch++;running=false;starting=false;ready=false;busy=false;cancelAnimationFrame(raf);if(videoCallback){video.cancelVideoFrameCallback(videoCallback);videoCallback=0;}clearTimeout(workerTimer);worker?.terminate();worker=null;stream?.getTracks().forEach(t=>t.stop());stream=null;video.srcObject=null;hands=[];trackingZone=null;nodeZone.reset();photoPending=false;preview=null;previewUntil=0;ctx.clearRect(0,0,canvas.width,canvas.height);$('welcome').hidden=false;$('stop').hidden=true;$('capture').disabled=true;$('tracking').textContent='Cámara apagada';$('start').disabled=false;$('start').textContent='Activar cámara';updateZoneUI()}
$('start').onclick=startCamera;$('stop').onclick=stopCamera;
function tick(now){if(!running)return;const frame=video.getVideoPlaybackQuality?.().totalVideoFrames||Math.floor(video.currentTime*30);if(frame===lastRendered&&!photoPending){scheduleFrame();return}lastRendered=frame;const dt=now-lastTick;lastTick=now;try{
 if(video.readyState>=2){src.setTransform(-1,0,0,1,source.width,0);src.drawImage(video,0,0,source.width,source.height);src.setTransform(1,0,0,1,0,0);
 // Detector y render reciben la misma imagen espejada: Left/Right físicos.
 if(ready&&!busy&&now-lastSent>=profile.interval&&video.currentTime!==lastVideo){busy=true;lastSent=now;lastVideo=video.currentTime;const token=epoch;detectorContext.drawImage(source,0,0,detectorFrame.width,detectorFrame.height);createImageBitmap(detectorFrame).then(bitmap=>{if(!running||epoch!==token){bitmap.close();return}worker.postMessage({type:'frame',bitmap,time:now},[bitmap])}).catch(()=>{if(epoch===token)busy=false})}
 if(now-lastDetection>400){hands=[];trackingZone=null;nodeZone.update({});for(const click of Object.values(clicks))click.update(null,now);if(ready)$('tracking').textContent='Esperando manos';updateZoneUI()}
 dynamicValue=smoothIntensity(dynamicValue,target,dt);if(dynamic){const blend=transition?clamp((now-transition.at)/400,0,1):1;intensity=transition?transition.from+(dynamicValue-transition.from)*blend:dynamicValue;if(blend===1)transition=null;$('intensity').value=intensity;$('value').value=intensity.toFixed(1)}
 const zone=nodeZone.polygon;out.drawImage(zone&&(intensity>0||effect==='Pop rojo')?renderer.render(source,zone,effect,intensity,now):source,0,0);
 if(zone&&$('border').checked&&effect!=='Pop rojo'){out.strokeStyle='white';out.lineWidth=1;out.beginPath();zone.forEach((p,i)=>i?out.lineTo(p.x*source.width,p.y*source.height):out.moveTo(p.x*source.width,p.y*source.height));out.closePath();out.stroke()}
 if($('points').checked){out.fillStyle='white';for(const hand of hands)for(const i of [4,8,12,16,20]){out.beginPath();const p=nodeZone.point(hand,i);out.arc(p.x*source.width,p.y*source.height,4,0,Math.PI*2);out.fill()}}
 if($('points').checked){out.strokeStyle='white';out.lineWidth=1.5;for(const pair of Object.values(nodeZone.fixed))for(const p of pair)out.strokeRect(p.x*source.width-5,p.y*source.height-5,10,10)}
 if(photoPending){photoPending=false;savePhoto()}ctx.drawImage(preview&&now<previewUntil?preview:finished,0,0);if(now>=previewUntil)preview=null;

 }
 scheduleFrame();
 }catch(error){stopCamera();toast('Se interrumpió el procesamiento. Volvé a activar la cámara.',5000);console.error(error)}}
$('fullscreen').onclick=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else if(document.documentElement.requestFullscreen)await document.documentElement.requestFullscreen();else toast('Podés ampliar la vista girando el teléfono.')}catch{toast('No se pudo activar la pantalla completa.')}};
document.addEventListener('keydown',e=>{if(tutorial?.active||!running||e.repeat||e.target.matches('input,textarea,select,a')||e.target.isContentEditable)return;if(e.code==='Space'||e.key==='Enter'){e.preventDefault();e.stopImmediatePropagation();requestPhoto()}},true);
window.addEventListener('pagehide',()=>{stopCamera();if(downloadURL)URL.revokeObjectURL(downloadURL);audio?.close()});
document.addEventListener('visibilitychange',()=>{if(document.hidden&&running)stopCamera()});
const lifecycle=new AbortController();window.addEventListener('pagehide',()=>lifecycle.abort());
if(document.modelContext?.registerTool){for(const tool of [
 {name:'read_camera_settings',description:'Leer el efecto, intensidad y estado de la zona.',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:true},execute:()=>({effect,intensity,dynamic,zoneFixed:nodeZone.count===2,fixedHands:Object.keys(nodeZone.fixed),cameraOn:running})},
 {name:'configure_camera_effect',description:'Elegir efecto e intensidad. No activa la cámara ni toma fotos.',inputSchema:{type:'object',properties:{effect:{type:'string',enum:effects},intensity:{type:'number',minimum:0,maximum:10},dynamic:{type:'boolean'}},required:['effect','intensity','dynamic'],additionalProperties:false},annotations:{readOnlyHint:false},execute:input=>{if(tutorial?.active)throw Error('Cerrá el tutorial antes de cambiar los ajustes.');if(!input||!effects.includes(input.effect)||typeof input.intensity!=='number'||!Number.isFinite(input.intensity)||input.intensity<0||input.intensity>10||typeof input.dynamic!=='boolean')throw Error('Configuración no válida');selectEffect(input.effect);intensity=input.intensity;setMode(input.dynamic);$('intensity').value=intensity;$('value').value=intensity.toFixed(1);return{effect,intensity,dynamic}}}
 ])try{Promise.resolve(document.modelContext.registerTool(tool,{signal:lifecycle.signal})).catch(()=>{})}catch{}}

// Panel replegable para dedicar toda la superficie a la cámara.
function showControls(show){
 $('controls').hidden=!show;
 document.body.classList.toggle('panel-closed',!show);
 $('panel-toggle').setAttribute('aria-expanded',String(show));
 $('panel-toggle').textContent=show?'Ocultar controles':'Mostrar controles';
}
$('panel-toggle').onclick=()=>showControls($('controls').hidden);
$('performance').dispatchEvent(new Event('change'));
showControls(!matchMedia('(max-width: 800px)').matches);

// The tutorial owns practice state only; camera/tracker and Click remain shared.
function resetGestureInput(){clicks=freshClicks();gestureResumeAt=performance.now()+250}
tutorial=new TutorialController({
 startCamera,
 camera:()=>({running,starting,ready,error:cameraError}),
 gestureState:event=>clicks[gestureBindings.find(b=>b.event===event)?.key],
 rearm:resetGestureInput,
 enter:()=>{$('controls').inert=true;cancelPhotoTimer();photoPending=false;photoSession++;preview=null;previewUntil=0;resetGestureInput()},
 exit:()=>{$('controls').inert=false;resetGestureInput()}
});
$('tutorial-open').onclick=()=>tutorial.open();
if(tutorial.firstVisit())tutorial.open();
