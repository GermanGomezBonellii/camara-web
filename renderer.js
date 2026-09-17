import {palettes} from './palettes.js';
export const categories={Básicos:['Saturación','Blanco y negro','Negativo','Blur','Pixelado'],Color:['Rojo profundo','Cianotipo','Terminal verde','CRT ámbar','Ultravioleta','Duotono','Acid'],Visión:['Infrarrojo','Mapa térmico','Visión nocturna','X-Ray'],Gráficos:['Solarizado','Poster rojo','Chrome','Pop rojo']};
export const effects=Object.values(categories).flat();
const paletteNames={'Rojo profundo':'LUT_ROJO_PROFUNDO','Infrarrojo':'LUT_INFRARROJO','Terminal verde':'LUT_TERMINAL_VERDE','Visión nocturna':'LUT_NIGHT_VISION','Cianotipo':'LUT_CIANOTIPO','CRT ámbar':'LUT_CRT_AMBAR','Ultravioleta':'LUT_ULTRAVIOLETA','Mapa térmico':'LUT_HEAT_MAP','X-Ray':'LUT_XRAY','Poster rojo':'LUT_POSTER_ROJO','Chrome':'LUT_CHROME','Acid':'LUT_ACID','Pop rojo':'LUT_POP_ROJO_ACID','Duotono':'LUT_DUOTONO'};
const vertex=`attribute vec2 position; varying vec2 uv; void main(){uv=vec2((position.x+1.)*.5,(1.-position.y)*.5);gl_Position=vec4(position,0.,1.);}`;
const fragment=`precision highp float;
varying vec2 uv;uniform sampler2D frame;uniform sampler2D palette;uniform float paletteY;uniform vec2 size;uniform int effect;uniform float intensity;uniform float time;uniform bool hasZone;uniform vec2 points[4];
float lum(vec3 c){return dot(c,vec3(.299,.587,.114));}
float contrast(float x,float a){return mix(x,x*x*(3.-2.*x),a);}
vec3 color(float g){return texture2D(palette,vec2((clamp(g,0.,1.)*255.+.5)/256.,paletteY)).rgb;}
vec3 sampleAt(vec2 p){return texture2D(frame,p).rgb;}
vec3 blur(float r){vec3 total=vec3(0.);float weight=0.;for(int x=-2;x<=2;x++){for(int y=-2;y<=2;y++){float k=exp(-float(x*x+y*y)*.45);total+=sampleAt(uv+vec2(float(x),float(y))*r/size)*k;weight+=k;}}return total/weight;}
float segment(vec2 a,vec2 b){vec2 p=uv*size;a*=size;b*=size;vec2 v=b-a;return length(p-a-v*clamp(dot(p-a,v)/max(dot(v,v),.001),0.,1.));}
bool inside(){bool odd=false;for(int i=0;i<4;i++){vec2 a=points[i];vec2 b=points[0];if(i<3)b=points[i+1];if((a.y>uv.y)!=(b.y>uv.y)){if(uv.x<(b.x-a.x)*(uv.y-a.y)/(b.y-a.y)+a.x)odd=!odd;}}return odd;}
float edge(){vec2 d=1./size;float c=lum(sampleAt(uv));return clamp(abs(lum(sampleAt(uv+vec2(d.x,d.y)))+lum(sampleAt(uv-vec2(d.x,d.y)))+lum(sampleAt(uv+vec2(d.x,-d.y)))+lum(sampleAt(uv+vec2(-d.x,d.y)))-4.*c)*2.,0.,1.);}
float noise(vec2 p){return fract(sin(dot(p,vec2(12.9898,78.233))+time*.31)*43758.5453);}
void main(){vec3 c=sampleAt(uv),outColor=c;float t=clamp(intensity/10.,0.,1.);bool inZone=hasZone&&inside();
if(inZone&&t>0.&&effect!=0){float g=lum(c);vec3 look=c;
if(effect==1){float v=max(c.r,max(c.g,c.b));float s=(v-min(c.r,min(c.g,c.b)))/max(v,.0001);look=clamp(mix(vec3(v),c,min(1.,s*(1.+7.*t))/max(s,.0001)),0.,1.);outColor=look;}
else if(effect==2)outColor=mix(c,vec3(g),t);
else if(effect==3)outColor=pow(mix(pow(c,vec3(2.2)),pow(1.-c,vec3(2.2)),t),vec3(1./2.2));
else if(effect==4)outColor=blur(t*7.);
else if(effect==5){vec2 dims=max(vec2(1.),floor(size*max(.04,1.-t*.96)));outColor=sampleAt((floor(uv*dims)+.5)/dims);}
else{
if(effect==6||effect==7||effect==9||effect==11||effect==14)look=color(g);
if(effect==8){look=color(g)*(mod(floor(uv.y*size.y),2.)<1.? .88:1.);look+=color(lum(blur(2.)))*.15*t;}
if(effect==9)look*=mod(floor(uv.y*size.y),2.)<1.?.88:1.;
if(effect==10||effect==13)look=color(contrast(g,.6));
if(effect==12)look=color(contrast(g,.65));
if(effect==15){look=color(contrast(g,.55));look+=(noise(floor(uv*size/3.))-.5)*.14;vec2 p=uv-.5;look*=1.-.25*dot(p,p)/.5;}
if(effect==16)look=color(contrast(1.-g,.5))+edge()*.5;
if(effect==17)look=g>(190.-t*90.)/255.?1.-c:c;
if(effect==18)look=color(floor(g*3.+.5)/3.);
if(effect==19)look=color(contrast(g,.45));
if(effect==20){float soft=contrast(lum(blur(1.5)),.45+.45*t);float detail=clamp(soft+(contrast(g,.45+.45*t)-soft)*1.4,0.,1.);float levels=floor(9.-5.*t+.5)-1.;look=color(floor(detail*levels+.5)/levels)-edge()*.55*t;vec2 cell=mod(uv*size,6.)/6.-.5;float ink=length(cell)<(1.-g)*.7?1.:0.;look-=ink*.1575*t;}
outColor=effect==20?look:mix(c,look,t);
}}
if(hasZone&&effect==20){if(!inZone)outColor=blur(.5+5.*t);float d=min(min(segment(points[0],points[1]),segment(points[1],points[2])),min(segment(points[2],points[3]),segment(points[3],points[0])));float r=4.+t*45.;outColor+=vec3(1.,0.,0.)*exp(-d*d/(r*r*.12))*(.08+.14*t);if(d<1.)outColor=vec3(1.,0.,0.);}
gl_FragColor=vec4(clamp(outColor,0.,1.),1.);}`;
export class Renderer{
 constructor(){this.canvas=document.createElement('canvas');const gl=this.gl=this.canvas.getContext('webgl',{alpha:false,preserveDrawingBuffer:true});if(!gl)throw Error('Este navegador no tiene WebGL disponible. Probá con Chrome o Edge actualizado.');
 const compile=(type,source)=>{const s=gl.createShader(type);gl.shaderSource(s,source);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s));return s};this.program=gl.createProgram();gl.attachShader(this.program,compile(gl.VERTEX_SHADER,vertex));gl.attachShader(this.program,compile(gl.FRAGMENT_SHADER,fragment));gl.linkProgram(this.program);if(!gl.getProgramParameter(this.program,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(this.program));gl.useProgram(this.program);
 const buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]),gl.STATIC_DRAW);const loc=gl.getAttribLocation(this.program,'position');gl.enableVertexAttribArray(loc);gl.vertexAttribPointer(loc,2,gl.FLOAT,false,0,0);
 this.uniforms={};for(const key of ['frame','palette','paletteY','size','effect','intensity','time','hasZone','points[0]'])this.uniforms[key]=gl.getUniformLocation(this.program,key);
 const texture=()=>{const tx=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,tx);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);return tx};
 gl.activeTexture(gl.TEXTURE0);this.input=texture();gl.uniform1i(this.uniforms.frame,0);gl.activeTexture(gl.TEXTURE1);this.palette=texture();this.keys=Object.keys(palettes);const data=new Uint8Array(256*this.keys.length*4);this.keys.forEach((key,row)=>{const stops=palettes[key];for(let x=0;x<256;x++){const p=x/255;let i=0;while(i<stops.length-2&&p>stops[i+1][0])i++;const [a,ca]=stops[i],[b,cb]=stops[i+1],t=(p-a)/(b-a);for(let ch=0;ch<3;ch++)data[(row*256+x)*4+ch]=Math.round(ca[ch]+(cb[ch]-ca[ch])*t);data[(row*256+x)*4+3]=255}});gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,256,this.keys.length,0,gl.RGBA,gl.UNSIGNED_BYTE,data);gl.uniform1i(this.uniforms.palette,1);
 }
 render(source,zone,effect,intensity,now){const gl=this.gl;if(this.canvas.width!==source.width||this.canvas.height!==source.height){this.canvas.width=source.width;this.canvas.height=source.height}gl.viewport(0,0,source.width,source.height);gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,this.input);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,source);const u=this.uniforms;gl.uniform2f(u.size,source.width,source.height);gl.uniform1i(u.effect,(effects.indexOf(effect)+1));gl.uniform1f(u.intensity,intensity);gl.uniform1f(u.time,now/1000);gl.uniform1i(u.hasZone,zone?1:0);gl.uniform2fv(u['points[0]'],new Float32Array((zone??Array(4).fill({x:0,y:0})).flatMap(p=>[p.x,p.y])));gl.uniform1f(u.paletteY,(Math.max(0,this.keys.indexOf(paletteNames[effect]))+.5)/this.keys.length);gl.drawArrays(gl.TRIANGLES,0,6);return this.canvas}
}
