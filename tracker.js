let detector;
self.onmessage=async({data})=>{
 if(data.type==='init'){
  try{
   const {FilesetResolver,HandLandmarker}=await import('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.32/vision_bundle.mjs');
   const files=await FilesetResolver.forVisionTasks('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.32/wasm');
   detector=await HandLandmarker.createFromOptions(files,{baseOptions:{modelAssetPath:'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',delegate:'CPU'},runningMode:'VIDEO',numHands:2,minHandDetectionConfidence:.6,minHandPresenceConfidence:.6,minTrackingConfidence:.6});
   self.postMessage({type:'ready'});
  }catch(error){self.postMessage({type:'error',message:String(error)})}
 }else if(data.type==='frame'){
  try{const result=detector.detectForVideo(data.bitmap,data.time);self.postMessage({type:'hands',landmarks:result.landmarks,handedness:result.handedness,time:data.time})}
  catch(error){self.postMessage({type:'error',message:String(error)})}
  finally{data.bitmap.close()}
 }
};
