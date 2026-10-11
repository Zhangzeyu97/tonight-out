/* Cue v2: pure scene state and cached guest art. Classic script, no build step. */
(function(root){
'use strict';
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x)),mix=(a,b,q)=>a+(b-a)*q,ease=q=>q*q*(3-2*q);
const MAESTROS=root.Maestros||(typeof require==='function'?require('./maestros.js'):[]);
const words={
 'door-knock':['咚咚咚—咚！','KNOCK'], 'door-open':['外卖！','DELIVERY!'], 'turkey-gobble':['咯咯咯！','GOBBLE!'],
 'bat-flap':['吱','eek'], 'owl-hoot':['咕—咕','HOO'], 'puppy-bark':['汪！','WOOF!'], 'swan-honk':['嘎——','HONK'],
 'pageturner-sneeze':['阿嚏！','ACHOO!'], 'string-snap':['嘣！','TWANG!'],honk:['嘎！','HONK!'],crack:['嘎！','CRACK!']
};
const colours={cat:'#ff86a8',bird:'#80cfff',door:'#deb487',turkey:'#ee9970',bat:'#b49aff',owl:'#c7c5f0',puppy:'#edbc7d',swan:'#d5f4ff',pageturner:'#91dec5',unknown:'#c9a7ae'};
function home(id,h){return {x:id==='pageturner'?650:id==='door'?690:id==='owl'?630:610,y:h*(id==='bat'?.26:id==='owl'?.61:id==='pageturner'?.65:.77)};}
function pose(id,t,beats,h,reduced){
 const last=beats.filter(e=>e.t<=t).at(-1);if(!last)return {id,visible:false};
 const mode=last.kind.slice(id.length+1),age=t-last.t,q=ease(clamp(age/Math.max(.12,last.d??.6),0,1));
 const first=beats.find(e=>e.t<=t),enter=first.t,fade=ease(clamp((t-enter)/.6,0,1)),base=home(id,h);
 let x=base.x,y=base.y,angle=0;
 // Work backwards from event-defined paths, so transitions are continuous when actions change.
 function destination(e,at){
  const a=at-e.t,b=home(id,h);if(e.x!==undefined)b.x=mix(110,690,e.x);
  if(id==='turkey'&&e.kind.endsWith('strut')){b.x=e.x===undefined?400+170*Math.sin(a*1.8):b.x;b.y-=reduced?0:4*Math.sin(a*9);}
  if(id==='bat'&&e.kind.endsWith('flap')){b.x=535+105*Math.sin(a*2.6);b.y=h*.28+35*Math.sin(a*5.2);}
  if(id==='bat'&&e.kind.endsWith('hang')){b.x=485;b.y=h*.19;}
  if(id==='puppy'&&e.kind.endsWith('spin')){b.x=570+55*Math.cos(a*3.8);b.y=h*.74+18*Math.sin(a*3.8);}
  if(id==='puppy'&&e.kind.endsWith('jump')){b.x=445;b.y=h*(h<750?.34:.42);}
  if(id==='swan'){b.x=e.x===undefined?570+60*Math.sin((at-enter)*.45):b.x;}
  return b;
 }
 const i=beats.indexOf(last),prev=i>0?beats[i-1]:null,from=prev?destination(prev,last.t):{x:690,y:base.y};
 const to=destination(last,t);x=mix(from.x,to.x,q);y=mix(from.y,to.y,q);
 if(mode==='jump')y-=reduced?0:60*Math.sin(Math.PI*clamp(age/.7,0,1));
 if(mode==='leave'){x=mix(from.x,690,q);y=from.y;}
 if(mode==='hang')angle=Math.PI*q;
 const note=last.note;return {id,visible:mode!=='leave'||q<1,x,y,angle,mode,age,q,alpha:mode==='leave'?1-q:fade,
 colour:colours[id]||colours.unknown,event:last,note};
}
const guestNames={cat:['猫','Cat'],bird:['小鸟','Bird'],door:['门','Door'],turkey:['火鸡','Turkey'],bat:['蝙蝠','Bat'],owl:['猫头鹰','Owl'],puppy:['小狗','Puppy'],swan:['天鹅','Swan'],pageturner:['翻谱员','Page turner'],unknown:['？','?']};
const registry=Object.fromEntries(Object.keys(colours).map(id=>[id,{zh:guestNames[id][0],en:guestNames[id][1],colour:colours[id],position:pose,draw:drawSprite,reactions:words}]));
function compile(c){
 c.guestBeats={};for(const e of c.events)if(e.type==='accident') {const id=e.kind.split('-')[0];(c.guestBeats[id]??=[]).push(e);}
 c.guestNotes=c.notes.filter(n=>c.guestBeats[n.part]||registry[n.part]);
 c.propEvents=c.events.filter(e=>e.type==='prop');
 c.parts=(c.parts||[]).map(p=>({...p}));
 if(c.view==='ensemble')for(const n of c.notes)if(!c.parts.some(p=>p.id===n.part))c.parts.push({id:n.part,zh:registry[n.part]?.zh||'？',en:registry[n.part]?.en||'?'});
 c.pops.push(...c.events.flatMap(e=>{const word=words[e.kind];return word?[{...e,d:.9,zh:word[0],en:word[1]}]:[];}));
 // Knocks/squeaks/hoots follow sounding notes, including every short-short-short-long knock.
 for(const n of c.guestNotes){const k={door:'door-knock',bat:'bat-flap',owl:'owl-hoot'}[n.part];if(k)c.pops.push({t:n.t,d:Math.max(.18,Math.min(.65,n.d)),kind:k,p:n.p,zh:words[k][0],en:words[k][1]});}
 c.pops.sort((a,b)=>a.t-b.t);
 if(c.view==='pitch')c.targets.forEach((n,i)=>{const next=c.targets[i+1];n.vd=Math.min(1.4,Math.max(n.d,next?(next.t-n.t)*.9:n.d));});
 c.targetsLegato=true;
 if(!c.mainNotes.length)c.mainNotes=c.notes.filter(n=>!c.guestBeats[n.part]);
 const ts=[...new Set(c.mainNotes.filter(n=>n.v>=.75).map(n=>n.t))];
 if(!c.accents.length){c.accents=[];for(const t of ts)if(!c.accents.length||t-c.accents.at(-1)>=.28)c.accents.push(t);}
 return c;
}
function latest(c,t,k){return c.propEvents.filter(e=>e.t<=t&&k.includes(e.kind)).at(-1);}
function particles(t,start,count,h,pages,reduced){if(!start)return [];const age=t-start.t;return Array.from({length:count},(_,i)=>{
 const a=reduced?.5:pages?age:(age+i*.137)%5;
 return pages?{x:clamp(650-(80+i*13)*a+Math.sin(i*4+a)*35,65,735),y:clamp(h*.52-70*a+38*a*a+i*3,65,h*.81),angle:i*.4+a*(i%2?1:-1),alpha:clamp(1-age/4,0,1)}:
 {x:60+((i*97.31+Math.sin(a*.7+i)*25)%680+680)%680,y:60+(a/5)*(h*.75-60),angle:0,alpha:.6};});}
function augment(c,s,opt){
 const {t,motionTime:mt}=s,h=opt.stageHeight??1000,reduced=!!opt.reducedMotion;
 s.guests=Object.keys(c.guestBeats).filter(id=>!['cat','bird'].includes(id)).map(id=>(registry[id]||registry.unknown).position(id,mt,c.guestBeats[id],h,reduced));
 const guest=s.cat.visible?s.cat:s.bird.visible?s.bird:s.guests.find(g=>g.visible&&g.alpha>.05);
 if(guest&&!['cat','bird'].includes(guest.id)&&!reduced&&!s.pause&&!s.end){const e=guest.alpha,toward=clamp((guest.x-400)/80,-1,1);s.portrait.x+=toward*6*e;s.portrait.angle+=toward*6*e;}
 s.speechSide=guest?(guest.x>=400?'left':'right'):'center';
 // Place the bubble in the upper opposite corner. Actual CSS maps this stage box exactly.
 s.speechBox={x:s.speechSide==='left'?36:s.speechSide==='right'?444:260,y:70,w:320,h:130};
 if(s.guests.some(g=>g.visible&&t-g.event.t<.8&&(g.mode==='enter'||g.event===c.guestBeats[g.id][0])))s.reactionMark='!';
 const r=s.reaction,age=r?t-r.t:0;
 const level=e=>Math.sin(Math.PI*clamp((t-e.t)/Math.max(.3,e.d??1.65),0,1));
 const mistakes=s.effects.filter(e=>e.type==='mistake');
 const amount=k=>Math.max(0,...mistakes.filter(e=>k.includes(e.kind)).map(level));
 const panic=Math.max(0,...mistakes.map(e=>level(e)*(e.severity??1)/3));
 s.panic=panic;s.runaway=amount(['runaway','rush']);s.sleepy=amount(['sleepy']);s.shiver=amount(['shiver']);
 if(panic&&!s.pause&&!s.end&&!reduced){s.portrait.angle+=Math.sin(mt*9)*panic*7;if(!s.shiver)s.portrait.x+=Math.sin(mt*7)*panic*3;if((r?.severity??1)>=2)s.reactionMark='?!';
 const zoom=Math.max(0,...mistakes.map(e=>{const a=t-e.t;return a<.6?Math.sin(Math.PI*a/.6)*level(e)*(e.severity??1)/3*.16:0;}));s.portrait.scaleX+=zoom;s.portrait.scaleY+=zoom;}
 if(s.sleepy&&!reduced){s.portrait.y+=18*s.sleepy;s.portrait.angle+=10*s.sleepy;}
 if(s.shiver&&!reduced){s.portrait.x+=Math.sin(mt*44)*s.shiver*1.8;}
 if(r?.kind==='jolt-awake'&&!reduced){s.portrait.y-=14*Math.sin(Math.PI*clamp(age/.4,0,1));s.reactionMark='!';}
 const slip=latest(c,t,['slip']);s.slip=slip&&t<slip.t+(slip.d??1.5)?Math.sin(Math.PI*(t-slip.t)/(slip.d??1.5)):0;
 if(s.slip&&!reduced){s.portrait.x+=s.slip*42;s.portrait.angle-=s.slip*22;}
 const snow=latest(c,t,['snow-start','snow-stop']);s.snow=particles(mt,snow?.kind==='snow-start'?snow:null,34,h,false,reduced);
 const pages=latest(c,t,['pages-fly']);s.pages=pages&&t-pages.t<4?particles(mt,pages,9,h,true,reduced):[];
 s.ice=!!latest(c,t,['ice-on']);s.stuckPipes=c.propEvents.filter(e=>e.kind==='pipe-stuck'&&e.t<=t&&!c.propEvents.some(z=>z.kind==='pipe-free'&&z.t>=e.t&&z.t<=t&&(z.p===undefined||z.p===e.p)));
 const watchStart=latest(c,t,['stopwatch-start']),watchStop=latest(c,t,['stopwatch-stop']);
 s.stopwatch=watchStart?{elapsed:Math.max(0,(watchStop&&watchStop.t>=watchStart.t?watchStop.t:t)-watchStart.t),running:!watchStop||watchStop.t<watchStart.t}:null;
 if(s.stopwatch)s.stopwatch.red=s.stopwatch.elapsed+c.duration-t>60;
 const flicker=latest(c,t,['lights-flicker']);s.flicker=flicker&&t-flicker.t<(flicker.d??1.4)?(.04+.04*Math.sin(mt*17)):0;
 s.pageFlip=latest(c,t,['page-flip']);s.stringSnap=latest(c,t,['string-snap']);
 s.baton= Math.sin(mt*5)*.45;
 const pulses=c.accents.filter(a=>a<=mt&&mt-a<.6).map(a=>Math.sin(Math.PI*(mt-a)/.6)*(c.mainNotes.some(n=>Math.abs(n.t-a)<.01&&n.v>.85)?.65:.3));s.baton+=Math.max(0,...pulses);
 s.ensemble=c.parts.map((p,i)=>({...p,y:h*(.43+(i+.5)*.32/Math.max(1,c.parts.length)),height:h*.32/Math.max(1,c.parts.length)}));
 return s;
}
// Cached at setup, never repainted in the animation loop. Art uses 128×128 local coordinates.
function drawSprite(g,id){
 const f=(c,x,y,w,h)=>{g.fillStyle=c;g.fillRect(x,y,w,h);},el=(c,x,y,rx,ry)=>{g.fillStyle=c;g.beginPath();g.ellipse(x,y,rx,ry,0,0,Math.PI*2);g.fill();};
 const tri=(c,pts)=>{g.fillStyle=c;g.beginPath();pts.forEach(([x,y],i)=>i?g.lineTo(x,y):g.moveTo(x,y));g.closePath();g.fill();};
 const eye=(x,y)=>{el('#14040a',x,y,3,4);el('#fff0db',x+1,y-1,1,1);};
 if(id==='door'){f('#a37950',32,12,64,110);f('#593624',39,19,50,97);f('#8b5935',44,25,40,40);f('#8b5935',44,74,40,34);el('#f2c46a',80,70,4,4);return;}
 if(id==='pageturner'){f('#fff0db',68,55,50,38);f('#694729',88,91,4,34);f('#694729',68,124,43,3);el('#f5c394',34,37,15,17);el('#eee2c6',34,21,21,10);f('#72bca9',22,53,27,38);f('#fff0db',25,53,18,10);f('#7d566a',25,91,8,25);f('#7d566a',39,91,8,25);tri('#72bca9',[[46,61],[74,57],[75,66],[46,74]]);eye(40,35);return;}
 if(id==='bat'){tri('#706099',[[57,66],[8,26],[13,65],[26,56],[38,80],[52,75]]);tri('#706099',[[70,66],[120,26],[115,65],[101,56],[88,80],[76,75]]);el('#51406e',64,70,16,23);tri('#51406e',[[50,57],[51,33],[61,52],[75,34],[78,59]]);el('#a998cf',64,56,16,13);eye(58,53);eye(71,53);return;}
 if(id==='swan'){el('#e1f1f8',58,90,40,23);el('#bfd5e9',52,88,26,13);el('#e1f1f8',82,58,10,28);el('#f3f8ff',83,31,15,13);tri('#f2ac66',[[91,32],[116,39],[92,42]]);eye(88,28);return;}
 if(id==='owl'){el('#9c7d66',64,80,31,38);el('#d1b8a0',64,79,22,28);tri('#9c7d66',[[33,51],[34,17],[57,42],[94,17],[94,52]]);el('#b89d82',64,50,35,26);el('#f0ddbe',49,49,15,17);el('#f0ddbe',78,49,15,17);eye(49,48);eye(78,48);tri('#e1a14e',[[58,56],[70,56],[64,67]]);return;}
 if(id==='turkey'){for(let i=0;i<7;i++)el(i%2?'#cd824d':'#86503d',30+i*10,56-Math.sin(i/6*Math.PI)*20,11,30);el('#976044',62,82,30,28);el('#e1a474',82,51,13,17);tri('#f2c46a',[[90,50],[110,57],[92,61]]);el('#d95654',86,69,5,12);f('#d5a057',49,106,4,16);f('#d5a057',69,106,4,16);eye(86,47);return;}
 if(id==='puppy'){el('#dfa369',61,88,32,23);el('#f3c994',82,58,25,24);el('#8d573c',61,58,10,21);el('#8d573c',103,57,9,20);el('#f9dda7',90,71,15,10);el('#392b2c',98,65,5,4);eye(84,54);f('#dfa369',39,98,10,24);f('#dfa369',74,99,10,23);return;}
 el('#c9a7ae',64,79,30,36);eye(53,68);eye(75,68);g.fillStyle='#14040a';g.font='bold 40px system-ui';g.textAlign='center';g.fillText('?',64,111);
}
const api={MAESTROS,registry,words,compile,augment,home};root.TheaterV2=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
