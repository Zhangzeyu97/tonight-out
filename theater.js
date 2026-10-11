/* Who's Out Tonight — standalone, seekable theater. No dependencies. */
(function (root) {
  'use strict';
  const W = 800;
  const C = { curtain:'#1f0810', velvet:'#34101a', velvetHi:'#461724', brass:'#f2c46a', cream:'#fff0db', muted:'#c9a7ae', teal:'#72e3cf', pink:'#ff86a8', coral:'#ff5b4d', blue:'#80cfff', ink:'#14040a' };
  const V2=root.TheaterV2||(typeof require==='function'?require('./theater-v2.js'):null);
  const MAESTROS=V2.MAESTROS;
  const clamp = (x,a,b) => Math.max(a,Math.min(b,x));
  const mix = (a,b,p) => a+(b-a)*p;
  const ease = p => p*p*(3-2*p);
  const finite = x => typeof x === 'number' && Number.isFinite(x);
  const isBlack = p => [1,3,6,8,10].includes(((p%12)+12)%12);
  function lowerBound(items,t,value = x=>x.t) {
    let l=0,r=items.length; while(l<r) {const m=(l+r)>>1;if(value(items[m])<t) l=m+1;else r=m;} return l;
  }
  function keyboard(range, height=1000) {
    const whites=[]; for(let p=Math.ceil(range[0]);p<=range[1];p++) if(!isBlack(p)) whites.push(p);
    const width=720/whites.length, keys=[];
    for(let p=Math.ceil(range[0]);p<=range[1];p++) {
      const black=isBlack(p), i=lowerBound(whites,p,x=>x);
      keys.push({ p, black, x:40+(black?i*width-width*.3:i*width), w:black?width*.6:width, y:height*.68, h:height*(black?.06:.10) });
    }
    return keys;
  }
  function parseCue(raw) {
    const fail = s => {throw new Error(`Invalid cue: ${s}`);};
    if(!raw || typeof raw!=='object') fail('object required');
    for(const k of ['id','musician','piece']) if(typeof raw[k]!=='string' || !/^[a-z0-9-]+$/.test(raw[k])) fail(k);
    if(!['keyboard','pitch','ensemble'].includes(raw.view)) fail('view');
    if(!['concert','wreck','accident','full'].includes(raw.kind)) fail('kind');
    if(!finite(raw.duration) || raw.duration<=0 || raw.duration>1800) fail('duration');
    if(!Array.isArray(raw.range) || raw.range.length!==2 || !raw.range.every(finite) || raw.range[0]>=raw.range[1]) fail('range');
    raw.range=[Math.max(0,Math.min(raw.range[0],115)),Math.min(127,Math.max(raw.range[1],12))];if(raw.range[1]-raw.range[0]<12)raw.range[1]=raw.range[0]+12;   // tolerate guest-inflated ranges
    if(typeof raw.audio!=='string' || !/^assets\/audio\/[a-zA-Z0-9_./-]+\.(mp3|wav|ogg)$/.test(raw.audio) || raw.audio.includes('..')) fail('local audio path');
    const rows = (name,check,optional=false) => {
      if(optional && raw[name]===undefined) return [];
      if(!Array.isArray(raw[name])) fail(name);
      return raw[name].map((r,i)=> { if(!r || !check(r)) fail(`${name}[${i}]`);return {...r}; }).sort((a,b)=>(a.t??0)-(b.t??0));
    };
    const timed = n => finite(n.t)&&n.t>=0&&n.t<=raw.duration&&finite(n.d)&&n.d>0;
    const notes=rows('notes',n=>timed(n)&&finite(n.p)&&n.p>=0&&n.p<=127&&finite(n.v)&&n.v>=0&&n.v<=1&&typeof n.part==='string'&&/^[a-z0-9-]+$/.test(n.part)&&(n.glide===undefined||Array.isArray(n.glide)&&n.glide.length===2&&n.glide.every(finite))&&typeof n.ok==='boolean'&&(n.want===undefined||finite(n.want)));
    const targets=rows('targets',n=>timed(n)&&finite(n.p)&&n.p>=0&&n.p<=127,true).filter(n=>!n.part||n.part==='solo');
    const curves=rows('curves',c=>typeof c.part==='string'&&Array.isArray(c.pts)&&c.pts.length>0&&c.pts.every((p,i)=>Array.isArray(p)&&p.length===2&&p.every(finite)&&p[0]>=0&&p[0]<=raw.duration&&(i===0||p[0]>c.pts[i-1][0])),true).map(c=>({...c,pts:c.pts.map(p=>p.slice())}));
    const events=rows('events',e=>{
      if(!finite(e.t)||e.t<0||e.t>raw.duration+(e.type==='end'?.4:0)||(e.d!==undefined&&(!finite(e.d)||e.d<=0))) return false;
      switch(e.type) {
        case 'mistake':return typeof e.kind==='string'&&(e.severity===undefined||[1,2,3].includes(e.severity));
        case 'pause':return finite(e.d);
        case 'restart':case 'gasp':case 'cheer':return true;
        case 'laugh':return [1,2,3].includes(e.level);
        case 'accident':return typeof e.kind==='string'&&/^[a-z0-9]+-[a-z0-9-]+$/.test(e.kind)&&(e.p===undefined||finite(e.p)&&e.p>=0&&e.p<=127)&&(e.x===undefined||finite(e.x)&&e.x>=0&&e.x<=1);
        case 'prop':return typeof e.kind==='string'&&(e.p===undefined||finite(e.p));
        case 'caption':return typeof e.zh==='string'&&typeof e.en==='string'&&finite(e.d)&&['narrator','performer'].includes(e.who);
        case 'end':return ['wreck','accident','bow'].includes(e.kind);
        default:return false;
      }
    });
    if(raw.view==='ensemble'&&(!Array.isArray(raw.parts)||!raw.parts.length||raw.parts.some(p=>!p||typeof p.id!=='string'||typeof p.zh!=='string'||typeof p.en!=='string')||new Set(raw.parts.map(p=>p.id)).size!==raw.parts.length))fail('parts');
    // Generators may omit the departure pitch/duration: inherit the last perch/key.
    for(let i=0;i<events.length;i++)if(events[i].type==='accident'&&events[i].kind.endsWith('-leave')) {
      const e=events[i],animal=e.kind.split('-')[0],prev=events.slice(0,i).filter(p=>p.type==='accident'&&p.kind.startsWith(`${animal}-`)).at(-1);
      e.p=e.p??prev?.p??raw.range[1];e.d=e.d??.65;
    }
    const cue={...raw,instrument:raw.instrument||(raw.view==='keyboard'?'piano':raw.view==='pitch'?'violin':'strings'),range:raw.range.slice(),notes,targets,curves,events};
    if(cue.view==='keyboard'&&notes.length) {
      let lo=Math.floor(Math.min(...notes.map(n=>n.p))/12)*12;
      let hi=Math.ceil(Math.max(...notes.map(n=>n.p))/12)*12;
      // Guest notes take priority over the usual three-octave melody window.
      // MIDI 32–92 needs 24–96 when padded to whole C-to-C octaves.
      if(cue.kind!=='accident'&&hi-lo>36) {
        const melody=notes.filter(n=>n.part==='rh');
        const pitches=(melody.length?melody:notes).map(n=>n.p);
        const center=(Math.min(...pitches)+Math.max(...pitches))/2;
        lo=clamp(Math.round((center-18)/12)*12,0,84);hi=lo+36;
      }
      cue.range=[lo,Math.max(lo+12,hi)];
    } else if(cue.view==='pitch') {
      const pitches=[...targets.filter(n=>!n.part||n.part==='solo').map(n=>n.p),...curves.filter(c=>c.part==='solo').flatMap(c=>c.pts.map(p=>p[1]))];
      if(!pitches.length)pitches.push(...notes.filter(n=>n.part==='solo').map(n=>n.p));
      if(pitches.length)cue.range=[Math.max(0,Math.floor(Math.min(...pitches))-2),Math.min(127,Math.ceil(Math.max(...pitches))+2)];
    }
    // Compile guest phrases once: a gap starts a new answer, not each trill note.
    cue.catNotes=notes.filter(n=>n.part==='cat');
    cue.birdNotes=notes.filter(n=>n.part==='bird');
    cue.answers=[];
    for(const n of cue.birdNotes) {
      if(n.role==='call'){n.answer=0;continue;}   // contact calls and cadence tweets are not duel rounds
      const last=cue.answers.at(-1);
      if(!last||n.t-last.until>.35)cue.answers.push({t:n.t,until:n.t+n.d,round:cue.answers.length+1});
      else last.until=Math.max(last.until,n.t+n.d);
      n.answer=cue.answers.length;
    }
    cue.endings=events.filter(e=>e.type==='end').map(e=>({...e,t:raw.duration-e.t<=.4?Math.max(0,raw.duration-.4):e.t,cueTime:e.t}));
    cue.keys=keyboard(cue.range);
    cue.keyByPitch=Object.fromEntries(cue.keys.map(k=>[k.p,k]));
    cue.soloCurves=curves.filter(c=>c.part==='solo');
    cue.mainNotes=notes.filter(n=>n.part==='rh'||n.part==='solo');
    // Compile each trapped figure once. A wrong D natural still counts as an
    // attempted D♯ via `want`; count only pairs whose second gate has finished.
    cue.accents=cue.mainNotes.filter((n,i,a)=>i===0||n.t-a[i-1].t>=.28||n.v>=.85).map(n=>n.t);
    cue.loops=events.filter(e=>e.type==='mistake'&&e.kind==='stuck').map(event=>{
      const ns=cue.mainNotes.slice(lowerBound(cue.mainNotes,event.t));
      const pairs=[];let until=raw.duration;
      for(let i=0;i<ns.length;i+=2) {
        const a=ns[i],b=ns[i+1];
        if((a.want??a.p)!==76||!b||(b.want??b.p)!==75){until=a.t;break;}
        pairs.push({start:a.t,turn:b.t,finish:b.t+b.d});
      }
      return {event,pairs,until};
    });
    cue.pops=events.flatMap(e=>{
      const kind=e.type==='restart'?'restart':e.type==='mistake'&&e.kind==='squeak'?'squeak':e.type==='accident'?e.kind:null;
      const words={'cat-enter':['喵！','MEOW!'],squeak:['吱——！','SQUEAK!'],restart:['再来！','Again!']};
      return words[kind]?[{t:e.t,d:.8,kind,zh:words[kind][0],en:words[kind][1],p:e.p}]:[];
    });
    if(cue.view==='keyboard'&&cue.kind==='wreck')for(let i=0;i<notes.length;i++) {
      const n=notes[i];if(n.ok||i&&Math.abs(notes[i-1].t-n.t)<.01)continue;
      const chord=notes.filter(k=>Math.abs(k.t-n.t)<.01&&!k.ok);
      if(chord.length>=3)cue.pops.push({t:n.t,d:.8,kind:'clunk',zh:'咚——',en:'CLUNK',p:chord[Math.floor(chord.length/2)].p});
    }
    for(const n of cue.catNotes)cue.pops.push({t:n.t,d:.36,kind:'cat-tap',zh:'叮',en:'tink',p:n.p});
    for(const a of cue.answers)cue.pops.push({t:a.t,d:.8,kind:'bird-sing',zh:'啾啾！',en:'TWEET!'});
    cue.pops.sort((a,b)=>a.t-b.t);
    cue.maxNoteDuration=Math.max(0,...notes.map(n=>n.d));
    return V2.compile(cue);
  }
  function targetAt(cue,t) {
    let i=lowerBound(cue.targets,t+1e-8)-1;
    // Main-line targets may overlap; use the latest target still sounding.
    for(;i>=0;i--) {const n=cue.targets[i];if(t>=n.t&&t<n.t+n.d)return n;}
    return null;
  }
  function pitchX(cue,p) {
    if(cue.view==='keyboard') {
      const key=cue.keyByPitch[clamp(Math.round(p),cue.range[0],cue.range[1])]; if(key)return key.x+key.w/2;
    }
    return mix(40,760,clamp((p-cue.range[0])/(cue.range[1]-cue.range[0]),0,1));
  }
  const pitchY=(cue,p,height=1000)=>mix(height*.81,height*.37,clamp((p-cue.range[0])/(cue.range[1]-cue.range[0]),0,1));
  function animalState(cue,t,animal,reduced,height=1000) {
    const beats=cue.events.filter(e=>e.type==='accident'&&e.kind.startsWith(`${animal}-`)&&e.t<=t);
    if(!beats.length)return {visible:false,x:850,y:340,mode:'absent',p:null,progress:0,scaleX:1,scaleY:1};
    const entry=beats.findLast(e=>e.kind===`${animal}-enter`&&t<e.t+e.d);
    // A first paw note can share the entrance timestamp; preserve its leap.
    const event=entry&&entry.t===beats.at(-1).t?entry:beats.at(-1);
    const mode=event.kind.slice(animal.length+1),dt=t-event.t,p=t>=event.t+event.d?1:clamp(dt/event.d,0,1),q=ease(p);
    const index=beats.indexOf(event),prev=index>0?beats[index-1]:event;
    const dest=animal==='cat'?{x:pitchX(cue,event.p),y:height*.68}:{x:585,y:height*.37};
    let x=dest.x,y=dest.y;
    if(mode==='enter') {x=mix(850,dest.x,q);y=mix(180,dest.y,q)-(reduced?0:95*Math.sin(Math.PI*p));}
    if(mode==='step'||mode==='sit') {x=mix(pitchX(cue,prev.p),dest.x,q);y-=reduced||mode==='sit'?0:7*Math.sin(p*4*Math.PI);}
    if(mode==='leave') {
      const start=animal==='cat'?{x:pitchX(cue,prev.p),y:height*.68}:{x:585,y:height*.37};
      x=mix(start.x,850,q);y=mix(start.y,80,q)-(reduced?0:80*Math.sin(Math.PI*p));
    }
    const squash=animal==='cat'&&!reduced&&mode==='enter'&&p>.75&&p<1?Math.sin((p-.75)*4*Math.PI)*.2:0;
    return {visible:mode!=='leave'||p<1,x,y,mode,p:event.p,progress:p,age:dt,scaleX:1+squash,scaleY:1-squash,event};
  }
  // PURE: no DOM, clock, randomness, mutation, or accumulated animation state.
  function computeState(cue,time,options={}) {
    const t=clamp(finite(time)?time:0,0,cue.duration), reduced=!!options.reducedMotion;
    const height=options.stageHeight??1000;
    const end=cue.endings.filter(e=>e.t<=t).at(-1)||null;
    const effects=cue.events.filter(e=>e.t<=t && t<e.t+(e.d??({mistake:1.65,restart:.85,laugh:2.1,gasp:1.1,cheer:3.2}[e.type]??0)));
    const captions=effects.filter(e=>e.type==='caption');
    const caption=captions.at(-1)||null;
    const speech=captions.filter(e=>e.who==='performer').at(-1)||null;
    const subtitle=captions.filter(e=>e.who==='narrator').at(-1)||null;
    const pause=effects.filter(e=>e.type==='pause'&&e.part!=='tutti').at(-1)||null;
    const motionTime=pause?pause.t:t;
    const reaction=pause||effects.filter(e=>['mistake','restart'].includes(e.type)).reduce((last,e)=>
      last&&last.t===e.t&&last.type==='restart'?last:e,null);
    const start=lowerBound(cue.notes,Math.max(0,t-cue.maxNoteDuration));
    const activeNotes=cue.notes.slice(start,lowerBound(cue.notes,t+1e-8)).filter(n=>t>=n.t&&t<n.t+n.d);
    const litKeys=[...new Set(activeNotes.map(n=>Math.round(n.p)))].sort((a,b)=>a-b);
    const density=cue.notes.slice(lowerBound(cue.notes,Math.max(0,t-.25)),lowerBound(cue.notes,t+.25)).length;
    const segment=cue.loops.find(s=>t>=s.event.t&&t<s.until);
    const loop=segment?{count:segment.pairs.filter(p=>p.finish<=t+1e-8).length,event:segment.event,until:segment.until}:null;
    const latest=cue.mainNotes[lowerBound(cue.mainNotes,motionTime+1e-8)-1];
    const noteAge=latest?motionTime-latest.t:10;
    const forte=cue.kind==='concert'&&activeNotes.some(n=>n.v>=.65);
    const portrait={x:0,y:0,angle:0,scaleX:1,scaleY:1};
    if(!reduced&&!pause&&!end) {
      // Continuous, musical motion: slow sway + breathing, and one soft nod per phrase start / accent.
      // (A hop on every note made the portrait twitch ~8 times a second in fast passages, which read as stutter.)
      const busy=density>0;
      portrait.angle=Math.sin(motionTime*1.5)*(forte?3:busy?2:1);
      portrait.y=Math.sin(motionTime*3)*(forte?2:1.2);
      const accent=cue.accents[lowerBound(cue.accents,motionTime+1e-8,x=>x)-1];
      if(accent!==undefined&&motionTime-accent<.45){const k=Math.sin((motionTime-accent)/.45*Math.PI);portrait.y-=k*(forte?7:5);portrait.angle+=k*1.5;}
      if(segment&&segment.pairs.length){   // stuck on E–D♯: rock smoothly in time with the pairs
        const ps=segment.pairs,period=ps.length>1?(ps.at(-1).start-ps[0].start)/(ps.length-1):.3;
        portrait.angle=Math.sin((motionTime-segment.event.t)/Math.max(.12,period)*Math.PI*2)*6;
      }
      if(reaction?.kind==='wrong'&&t-reaction.t<.3){portrait.x=Math.sin((t-reaction.t)/.3*Math.PI)*3;portrait.angle+=portrait.x*.5;}
      if(reaction?.type==='restart')portrait.y=-Math.sin(clamp((t-reaction.t)/.65,0,1)*Math.PI)*20;
      if(reaction?.kind==='slide'||activeNotes.some(n=>n.part==='solo'&&!n.ok))portrait.angle+=Math.sin(t*18)*3;
      if(reaction?.kind==='squeak'){const q=Math.sin(clamp((t-reaction.t)/.5,0,1)*Math.PI*2)*.2;portrait.scaleY=1+q;portrait.scaleX=1-q*.6;}
    }
    if(end?.kind==='wreck'){portrait.angle=12;portrait.y=8;}
    const onomatopoeia=cue.pops.filter(e=>e.t<=t&&t<e.t+e.d);
    const trace=[];
    const traceTime=motionTime;
    for(const curve of cue.soloCurves) {
      const pts=curve.pts;if(pts[0][0]>traceTime||pts.at(-1)[0]<traceTime-2.4)continue;
      const visible=pts.slice(Math.max(0,lowerBound(pts,traceTime-2.4,p=>p[0])-1),lowerBound(pts,traceTime+1e-8,p=>p[0]));
      const i=lowerBound(pts,traceTime,p=>p[0]);
      if(i>0&&i<pts.length&&pts[i-1][0]<traceTime) {const a=pts[i-1],b=pts[i];visible.push([traceTime,mix(a[1],b[1],(traceTime-a[0])/(b[0]-a[0]))]);}
      trace.push(visible.map(([at,p])=>{const target=targetAt(cue,at);const error=target?Math.abs(p-target.p):0;return {t:at,p,good:!!target&&error<=.35,bigMiss:!!target&&error>1.5};}));
    }
    const cat=animalState(cue,motionTime,'cat',reduced,height),bird=animalState(cue,motionTime,'bird',reduced,height);
    const tap=cue.catNotes[lowerBound(cue.catNotes,motionTime+1e-8)-1];
    cat.tap=tap&&motionTime-tap.t<.12?{p:tap.p,age:motionTime-tap.t,lift:reduced?0:Math.sin((motionTime-tap.t)/.12*Math.PI)*14}:null;
    // During repeated taps stay at the sounding key, even without a new step cue.
    if(cat.visible&&cat.mode!=='enter'&&tap&&tap.t>=cat.event.t&&(motionTime<tap.t+tap.d||motionTime>=cat.event.t+(cat.event.d||0))) {   // on a sounding key, or parked after a step
      let i=lowerBound(cue.catNotes,motionTime+1e-8)-1;while(i>=0&&cue.catNotes[i].t>tap.t-.03)i--;   // previous paw press, not the same cluster
      const prev=cue.catNotes[i],pitch=cat.event.t===tap.t?cat.event.p:tap.p,to=pitchX(cue,pitch);
      const from=prev&&prev.t>=cat.event.t?pitchX(cue,prev.p):cat.x;
      cat.x=mix(from,to,ease(clamp((motionTime-tap.t)/.05,0,1)));cat.tap&&(cat.tap.p=pitch);
    }
    const answer=cue.answers.filter(a=>a.t<=motionTime).at(-1)||null;
    bird.round=answer?.round??0;
    bird.answer=answer&&motionTime<answer.until?answer:null;
    const birdGlyphs=cue.birdNotes.filter(n=>n.t<=motionTime&&motionTime<n.t+.85).map(n=>({t:n.t,age:motionTime-n.t,
      big:!!cue.answers.length&&n.answer===cue.answers.length&&cue.answers.at(-1).until-cue.answers.at(-1).t>1}));
    if(cue.kind==='accident'&&(cue.catNotes.length||cue.birdNotes.length)) {
      const finale=cue.endings.find(e=>e.kind==='accident');
      if(finale&&t>=finale.t-.7) {
        const animal=cue.view==='keyboard'?'cat':'bird',guest=animal==='cat'?cat:bird;
        const from=animalState(cue,Math.max(0,finale.t-.7),animal,reduced,height);
        const q=ease(clamp((t-(finale.t-.7))/.7,0,1));
        Object.assign(guest,{visible:true,x:mix(from.x,400,q),y:mix(from.y,height*.72,q),mode:'bow',age:t-finale.t,progress:q,
          scaleX:1.05,scaleY:reduced?1:.82});
      }
    }
    const guest=cat.visible?cat:bird.visible?bird:null;
    if(guest&&!reduced&&!pause&&!end) {
      const toward=guest.x>=400?1:-1;
      portrait.x+=toward*6;portrait.angle=clamp(portrait.angle+toward*6,-8,8);
    }
    const entrance=effects.some(e=>e.type==='accident'&&e.kind.endsWith('-enter'));
    const reactionMark=pause?null:entrance||effects.some(e=>e.type==='gasp')?'!':reaction?.kind==='squeak'?'!!':reaction?.kind==='lost'?'?':
      ['wrong','slide','rush','drag'].includes(reaction?.kind)&&reaction.severity>=2?'?!':null;
    const speechSide=guest?(guest.x>=400?'left':'right'):'center';
    return V2.augment(cue,{t,motionTime,litKeys,activeNotes,density,portrait,caption,speech,subtitle,
      captionPlacement:caption?(caption.who==='performer'?'bubble':'subtitle'):null,
      reaction,reactionMark,speechSide,pause,end,effects,trace,loop,onomatopoeia,cat,bird,birdGlyphs,
      audience:effects.filter(e=>['laugh','gasp','cheer'].includes(e.type)),
      spotlight:end?.kind==='wreck'?.35:end?.kind==='bow'?1.4:pause?.6:1},options);
  }
  // Bounds include the animated scale and outline. Valance ends at canvas y=55.
  function popBox(x,y,width,size,scale=1,unit=1,height=1000) {
    const halfW=(width/2+3.5*unit)*scale,halfH=(size*.75+3.5*unit)*scale;
    return {x:clamp(x,W*.06+halfW,W*.94-halfW),y:clamp(y,55+halfH,height*.84-halfH),halfW,halfH};
  }
  const core={parseCue,computeState,keyboard,targetAt,popBox,MAESTROS,registry:V2.registry};
  if(typeof module!=='undefined'&&module.exports)module.exports=core;
  root.TheaterCore=core;
  let active=null;
  const cueCache=new Map(),bufferCache=new Map();let creditPromise;
  const fetchCredits=()=>creditPromise||(creditPromise=root.fetch('assets/audio/pilot/credits.json').then(r=>r.ok?r.json():{}).catch(()=>({})));
  function mount(container,options={}){
  if(!container||!root.document)throw new Error('A stage container is required');
  const style=root.document.createElement('style');style.textContent=STYLE;container.appendChild(style);
  let H=1000,destroyed=false,muted=!!options.muted,gain=null;
  const listeners=new Map(),emit=(name,value)=>{for(const fn of listeners.get(name)||[])fn(value);};

  const nodes={};
  function el(key,tag,parent){const n=root.document.createElement(tag);n.className='ts-'+key;nodes[key]=n;(parent||container).appendChild(n);return n;}
  const stage=el('stage','section');stage.setAttribute('aria-label','Performance stage');
  el('now-playing','span',stage).className='ts-sr-only';el('ticket','span',stage).className='ts-sr-only';
  for(const key of ['stage-canvas','guest-canvas'])el(key,'canvas',stage).setAttribute('aria-hidden','true');
  const rig=el('portrait-rig','div',stage),portrait=el('portrait','div',rig);
  el('portrait-img','img',portrait);el('reaction-mark','span',portrait).hidden=true;
  const loop=el('loop','div',rig);loop.hidden=true;el('loop-label','small',loop);el('loop-text','span',loop);
  const speech=el('speech','div',rig);speech.hidden=true;el('speech-text','span',speech);
  const caption=el('caption','div',stage);caption.hidden=true;el('caption-text','span',caption);el('stamp','div',stage).hidden=true;
  const $=id=>nodes[id],canvas=$('stage-canvas');

  const guestCanvas=$('guest-canvas'),guestCtx=guestCanvas.getContext('2d');
  let ctx=canvas.getContext('2d');
  if(!ctx)return;
  let cue=null, buffer=null, audio=null, source=null, playing=false, offset=0, anchor=0, rate=1, raf=0, request=0, playIntent=0;
  let mockMode=false,credits={};
  let lang=options.lang==='en'?'en':'zh',selected='',mode='loading',lastState=null,audioProblem=false;
  let pixelUnit=800/351; // Canvas units per CSS pixel; set from measured stage width.
  const motion=root.matchMedia?.('(prefers-reduced-motion: reduce)');
  const tr=(zh,en)=>lang==='zh'?zh:en;
  const kinds=['concert','wreck','accident'];
  const kindName=k=>({concert:tr('完美演出','Flawless'),wreck:tr('低分车祸','Low-score flop'),accident:tr('高分意外','High-score accident'),full:tr('完整演出','Full performance')})[k];
  function rounded(x,y,w,h,r=4) {ctx.beginPath();ctx.roundRect(x,y,w,h,r);}
  function fill(color) {ctx.fillStyle=color;ctx.fill();}
  function ellipse(x,y,rx,ry,color) {ctx.beginPath();ctx.ellipse(x,y,rx,ry,0,0,Math.PI*2);fill(color);}
  function line(points,color,width=2) {ctx.beginPath();points.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.strokeStyle=color;ctx.lineWidth=width;ctx.lineCap='round';ctx.lineJoin='round';ctx.stroke();}
  function text(s,x,y,size,color=C.cream,font='system-ui') {ctx.font=`${size}px ${font}`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle=color;ctx.fillText(s,x,y);}
  // Static stage art is painted once per canvas size into offscreen layers; each frame only blits them.
  // (Full-canvas gradients and curtain curves redrawn every frame were the main raster cost on phones.)
  let layerKey='',layerBase=null,layerFront=null,layerSpot=[null,null],layerAll=[null,null];
  function layer(draw) {
    const c=root.document.createElement('canvas');c.width=canvas.width;c.height=canvas.height;
    const g=c.getContext('2d');g.setTransform(canvas.width/W,0,0,canvas.height/H,0,0);
    const keep=ctx;ctx=g;try{draw();}finally{ctx=keep;}return c;
  }
  function paintBase() {ctx.fillStyle=C.ink;ctx.fillRect(0,0,W,H);}
  function paintSpot(pause) {
    const glow=ctx.createRadialGradient(400,H*.18,5,400,H*.28,pause?180:430);
    glow.addColorStop(0,'rgba(255,226,170,.24)');glow.addColorStop(1,'rgba(255,226,170,0)');ctx.fillStyle=glow;ctx.fillRect(0,0,W,H);
    const spread=pause?110:340;
    ctx.fillStyle='rgba(255,236,190,.09)';ctx.beginPath();ctx.moveTo(380,0);ctx.lineTo(420,0);ctx.lineTo(400+spread,H*.83);ctx.lineTo(400-spread,H*.83);ctx.closePath();ctx.fill();
  }
  function paintFront() {
    const floor=ctx.createLinearGradient(0,H*.76,0,H);floor.addColorStop(0,'#47221c');floor.addColorStop(1,'#12040a');ctx.fillStyle=floor;ctx.fillRect(0,H*.76,W,H*.24);
    for(let i=0;i<=18;i++)line([[400+(i-9)*26,H*.76],[400+(i-9)*80,H]],'#14040a66',1);
    line([[0,H*.84],[800,H*.84]],'#f2c46a40',2);
    for(const side of [0,1]) {ctx.save();if(side){ctx.translate(W,0);ctx.scale(-1,1);}ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(66,0);ctx.bezierCurveTo(64,H*.35,28,H*.5,18,H*.82);ctx.lineTo(0,H*.88);ctx.closePath();fill(C.velvet);for(let i=0;i<3;i++)line([[8+i*18,0],[5+i*10,H*.4],[3+i*5,H*.83]],i%2?'#461724':'#220910',7);ctx.restore();}
    for(let i=0;i<10;i++) {ctx.beginPath();ctx.moveTo(i*80,0);ctx.lineTo(i*80+80,0);ctx.bezierCurveTo(i*80+76,55,i*80+9,55,i*80,0);fill(i%2?'#461724':C.velvet);line([[i*80+8,30],[i*80+40,40],[i*80+73,29]],'#7a5219',2);}
    line([[0,4],[800,4]],C.brass,3);
  }
  let layersOK=true;
  function buildLayers() {
    const key=`${canvas.width}x${canvas.height}x${H.toFixed(2)}`;if(key===layerKey)return;layerKey=key;
    layerBase=layer(paintBase);layerSpot=[layer(()=>paintSpot(false)),layer(()=>paintSpot(true))];layerFront=layer(paintFront);
    layerAll=[false,true].map(pause=>layer(()=>{paintBase();paintSpot(pause);paintFront();}));
  }
  function blit(c,alpha=1) {ctx.save();ctx.setTransform(1,0,0,1,0,0);ctx.globalAlpha=alpha;ctx.drawImage(c,0,0);ctx.restore();}
  function background(state) {
    if(layersOK)try{if(typeof ctx.drawImage!=='function')throw 0;buildLayers();}catch(_){layersOK=false;}   // no offscreen canvas: paint directly
    if(!layersOK){paintBase();if(state.spotlight>0){ctx.save();ctx.globalAlpha=state.spotlight;paintSpot(state.pause);ctx.restore();}paintFront();return;}
    if(state.spotlight>=.999)return blit(layerAll[state.pause?1:0]);
    blit(layerBase);
    if(state.spotlight>0)blit(layerSpot[state.pause?1:0],state.spotlight);
    blit(layerFront);
  }
  function paw(x,y,size,color) {
    ellipse(x,y,size*.35,size*.28,color);
    for(let i=0;i<3;i++)ellipse(x+(i-1)*size*.29,y-size*.4,size*.15,size*.19,color);
  }
  function noteColor(n) {return !n.ok?C.coral:n.part==='cat'?C.pink:n.part==='bird'?C.blue:V2.registry[n.part]?.colour??(n.part==='lh'||n.part==='ped'||n.part==='pedal'?C.teal:C.brass);}
  function sparkBurst(x,y,age,reduced) {
    if(age<0||age>.35)return;
    const q=reduced?.4:age/.35;ctx.save();ctx.globalAlpha=1-q*.7;
    for(let i=0;i<7;i++){const a=i*Math.PI*2/7,r=12+q*55;line([[x+Math.cos(a)*r,y+Math.sin(a)*r],[x+Math.cos(a)*(r+13),y+Math.sin(a)*(r+13)]],i%2?C.brass:C.coral,4);}
    text('✕',x,y-25,32,C.coral);ctx.restore();
  }
  function drawKeyboard(state) {
    const lookahead=2.5,top=H*.43,keyY=H*.68,speed=(keyY-top)/lookahead,at=state.motionTime;
    const keys=keyboard(cue.range,H);
    const keyFor=p=>keys[clamp(Math.round(p),cue.range[0],cue.range[1])-cue.range[0]];
    ctx.save();ctx.beginPath();ctx.rect(40,top,720,keyY-top);ctx.clip();
    ctx.fillStyle='#14040a88';ctx.fillRect(40,top,720,keyY-top);
    for(const key of keys)if(!key.black)line([[key.x,top],[key.x,keyY]],'#fff0db15',1);
    const first=lowerBound(cue.notes,Math.max(0,at-cue.maxNoteDuration));
    for(let i=first;i<cue.notes.length&&cue.notes[i].t<=at+lookahead;i++) {
      const n=cue.notes[i];if(n.t+n.d<at)continue;
      const key=keyFor(n.p),y=keyY-(n.t-at)*speed,h=Math.max(10,n.d*speed),col=noteColor(n);
      rounded(key.x,y-h,key.w,h,4);fill(col);ctx.fillStyle='#fff5';ctx.fillRect(key.x+2,y-h+2,Math.max(1,key.w-4),3);
      if(!n.ok)text('✕',key.x+key.w/2,y-h/2,Math.min(26,key.w),C.ink);
      if(n.part==='cat')paw(key.x+key.w/2,y-h/2,Math.min(20,key.w*.7),C.ink);
    }
    ctx.restore();
    rounded(34,keyY-6,732,H*.10+14,7);fill('#7a5219');
    const active=new Map(state.activeNotes.map(n=>[clamp(Math.round(n.p),cue.range[0],cue.range[1]),n]));
    const recent=cue.notes.slice(lowerBound(cue.notes,Math.max(0,at-.35)),lowerBound(cue.notes,at+1e-8)).filter(n=>!n.ok);
    for(const black of [false,true])for(const key of keys)if(key.black===black) {
      const n=active.get(key.p),wrong=recent.filter(n=>clamp(Math.round(n.p),cue.range[0],cue.range[1])===key.p).at(-1);
      const jolt=wrong&&!motion?.matches&&!state.pause?-Math.sin(clamp((at-wrong.t)/.24,0,1)*Math.PI)*13:0;
      rounded(key.x+.5,key.y+jolt,key.w-1,key.h,black?3:4);fill(n?noteColor(n):cue.instrument==='harpsichord'?(black?'#fff0db':'#271c19'):black?'#21121a':'#fff0db');
      if(n){if(n.part==='cat')paw(key.x+key.w/2,key.y+key.h*.65,Math.min(24,key.w),C.ink);if(!n.ok)text('✕',key.x+key.w/2,key.y+key.h*.6,Math.min(28,key.w),C.ink);}
      if(!black&&key.p%12===0)text(`C${Math.floor(key.p/12)-1}`,key.x+key.w/2,keyY+key.h-12,18,'#7a5219');
    }
    for(const n of recent){const k=keyFor(n.p);sparkBurst(k.x+k.w/2,keyY,at-n.t,motion?.matches);}
    line([[40,keyY],[760,keyY]],C.brass,3);
  }
  const catScale=()=>48*pixelUnit/78;
  const birdScale=()=>56*pixelUnit/44;
  function drawPitch(state) {
    const x0=40,x1=760,head=224,speed=330,top=H*.37,bottom=H*.81,at=state.motionTime;   // ~2 s across the lane so fast violin notes read as bars
    rounded(x0,top,720,bottom-top,9);fill('#14040ab0');
    ctx.save();ctx.beginPath();ctx.rect(x0,top,720,bottom-top);ctx.clip();
    for(let p=Math.ceil(cue.range[0]);p<=cue.range[1];p++)if(p%2===0){const y=pitchY(cue,p,H);line([[x0,y],[x1,y]],p%12===0?'#f2c46a40':'#fff0db10',1);if(p%12===0)text(`C${Math.floor(p/12)-1}`,64,y,18,C.muted);}
    for(const n of cue.targets) {
      if(n.part&&n.part!=='solo')continue;
      const x=head+(n.t-at)*speed,w=Math.max(7,(n.vd||n.d)*speed);if(x>x1||x+w<x0)continue;
      const h=Math.max(10*pixelUnit,(bottom-top)/(cue.range[1]-cue.range[0])*.8);
      rounded(x,pitchY(cue,n.p,H)-h/2,w,h,h/2);fill('#f4dbaab3');ctx.strokeStyle='#926135';ctx.lineWidth=1.5*pixelUnit;ctx.stroke();
    }
    for(const good of [false,true]) {
      ctx.save();ctx.beginPath();
      for(const points of state.trace)for(let i=1;i<points.length;i++) {
        const a=points[i-1],b=points[i];if(b.good!==good)continue;
        const ax=head+(a.t-at)*speed,bx=head+(b.t-at)*speed,ay=pitchY(cue,a.p,H),by=pitchY(cue,b.p,H);
        ctx.moveTo(ax,ay);
        if(!good&&!motion?.matches){ctx.lineTo(mix(ax,bx,.5),mix(ay,by,.5)+Math.sin(b.t*137)*5);}
        ctx.lineTo(bx,by);
      }
      ctx.strokeStyle=good?C.teal:C.coral;ctx.lineCap='round';
      ctx.globalAlpha=.2;ctx.lineWidth=9*pixelUnit;ctx.stroke();
      ctx.globalAlpha=1;ctx.lineWidth=5*pixelUnit;ctx.stroke();ctx.restore();
    }
    line([[head,top],[head,bottom]],C.cream,3);
    const current=state.trace.flat().filter(p=>Math.abs(p.t-at)<.045).at(-1);
    if(current)ellipse(head,pitchY(cue,current.p,H),9,9,current.good?C.teal:C.coral);
    ctx.restore();
  }
  function drawCat(cat,t) {
    if(!cat.visible)return;
    ctx.save();ctx.translate(cat.x,cat.y);ctx.scale(cat.scaleX*catScale(),cat.scaleY*catScale());
    if(cat.mode==='bow')ctx.rotate(motion?.matches?.12:.25);
    const sit=cat.mode==='sit'||cat.mode==='bow',strut=motion?.matches?0:Math.sin(cat.age*20)*3;
    // A hand-drawn chubby tabby; paths and details are original to this page.
    ctx.save();ctx.translate(-23,-25);ctx.rotate(motion?.matches?-.25:Math.sin(t*4)*.3);
    ctx.beginPath();ctx.moveTo(0,0);ctx.bezierCurveTo(-38,-3,-44,-36,-27,-38);ctx.bezierCurveTo(-11,-39,-16,-21,-32,-24);ctx.strokeStyle='#e69442';ctx.lineWidth=10;ctx.lineCap='round';ctx.stroke();line([[-32,-21],[-36,-23]],'#9b4a29',5);ctx.restore();
    ellipse(0,-25,sit?25:33,sit?31:24,'#e69442');ellipse(1,-20,17,20,'#ffc47b');
    for(let i=0;i<3;i++)line([[-17+i*14,-45],[-15+i*14,-35]],'#a2532b',4);
    // Four little feet meet the key surface; alternating lifts on a step.
    for(let i=0;i<4;i++){
      const x=-23+i*15,tap=i===3?cat.tap:null;
      const dy=tap?tap.lift:cat.mode==='step'?(i%2?strut:-strut):0,press=tap&&tap.age>.085;
      ellipse(x,-5-Math.max(0,dy),press?10:8,press?4:6,'#f6b56b');
      line([[x-2,-4-Math.max(0,dy)],[x-2,-1-Math.max(0,dy)]],'#a2532b',1);
    }
    ctx.save();ctx.translate(sit?4:17,-48);
    ctx.beginPath();ctx.moveTo(-21,-8);ctx.lineTo(-22,-29);ctx.lineTo(-4,-16);ctx.lineTo(11,-29);ctx.lineTo(22,-7);ctx.closePath();fill('#e69442');
    ctx.beginPath();ctx.moveTo(-18,-13);ctx.lineTo(-18,-23);ctx.lineTo(-9,-16);ctx.closePath();fill('#ffaaa1');ctx.beginPath();ctx.moveTo(10,-16);ctx.lineTo(12,-24);ctx.lineTo(17,-13);ctx.closePath();fill('#ffaaa1');
    ellipse(0,-4,25,21,'#f3a854');ellipse(-5,5,10,7,'#ffd39c');ellipse(8,5,10,7,'#ffd39c');
    for(let i=-1;i<=1;i++)line([[i*7-2,-22],[i*6,-15]],'#a2532b',3);
    if(sit){line([[-15,-4],[-9,-1],[-4,-4]],C.ink,2);line([[5,-4],[11,-1],[16,-4]],C.ink,2);}else{ellipse(-9,-5,4.3,5.3,C.cream);ellipse(11,-5,4.3,5.3,C.cream);ellipse(-8,-5,1.6,4,C.ink);ellipse(12,-5,1.6,4,C.ink);}
    ctx.beginPath();ctx.moveTo(-1,2);ctx.lineTo(5,2);ctx.lineTo(2,6);ctx.closePath();fill('#b05752');line([[2,6],[2,10],[-3,11]],C.ink,1.5);line([[2,10],[7,11]],C.ink,1.5);
    for(const s of [-1,1])for(let i=0;i<3;i++)line([[s*13,4+i*3],[s*29,1+i*5]],'#6c3528',1);
    ctx.restore();
    if(cat.mode==='step'&&!motion?.matches){ctx.globalAlpha=1-cat.progress;for(let i=0;i<2;i++)paw(-24-i*15,4,9,C.pink);}
    ctx.restore();
  }
  function drawBird(bird,t) {
    if(!bird.visible)return;
    ctx.save();ctx.translate(bird.x,bird.y);ctx.scale(birdScale(),birdScale());
    if(bird.mode==='bow')ctx.rotate(motion?.matches?.12:.35);
    const flying=bird.mode==='leave'||bird.mode==='enter'&&bird.progress<1;
    const flap=motion?.matches?0:Math.sin(t*30),singing=!!bird.answer;
    line([[-7,-6],[-10,1],[-3,1]],'#d5a057',2);line([[5,-6],[7,1],[13,1]],'#d5a057',2);
    ctx.beginPath();ctx.moveTo(-12,-13);ctx.lineTo(-29,-25);ctx.lineTo(-24,-10);ctx.closePath();fill('#4a8fc1');
    ellipse(-2,-17,17,13,'#61b7e3');ellipse(3,-13,11,9,'#b7e6ed');
    ctx.save();ctx.translate(-5,-18);ctx.rotate(flying?flap*.85:-.3);ellipse(-7,-2,13,flying?6:8,'#3f8fcb');line([[-18,-3],[-7,-1]],'#80cfff',1.5);ctx.restore();
    ellipse(11,-27,12,11,'#80cfff');ellipse(16,-29,3,3,C.ink);ellipse(17,-30,1,1,C.cream);
    ctx.beginPath();ctx.moveTo(21,-28);ctx.lineTo(32,-25-(singing?3:0));ctx.lineTo(22,-23);ctx.closePath();fill(C.brass);
    if(singing){ctx.beginPath();ctx.moveTo(21,-22);ctx.lineTo(30,-19);ctx.lineTo(21,-18);ctx.closePath();fill('#df9f48');}
    line([[7,-36],[5,-43],[13,-37]],'#61b7e3',2);
    ctx.restore();
  }
  // All recurring labels are measured at setup/resize, never in the frame loop.
  const textWidths=new Map();
  function measured(s,size,bold=false) {
    const font=`${bold?'900 ':''}${size}px system-ui`,key=`${font}:${s}`;
    if(!textWidths.has(key)){ctx.font=font;textWidths.set(key,ctx.measureText(s).width);}
    return textWidths.get(key);
  }
  function warmText() {
    if(!cue)return;
    for(const e of cue.pops)for(const l of ['zh','en'])measured(e[l],(e.kind==='cat-tap'?16:e.kind==='bat-flap'?12:26)*pixelUnit,true);
    for(const [word,size] of [['哈',18],['ha',18],['哇！',18],['Whoa!',18],['Bravo!',16]])measured(word,size*pixelUnit);
    for(let n=0;n<=cue.answers.length;n++)for(const word of [`斗琴 第 ${n} 回合`,`Round ${n}`])measured(word,12*pixelUnit);
  }
  function bubble(s,x,y,color=C.cream,size=16) {
    const w=Math.max(size+8,measured(s,size)+14);
    rounded(x-w/2,y-size*.7,w,size*1.5,7);fill(color);
    ctx.beginPath();ctx.moveTo(x-4,y+size*.8);ctx.lineTo(x+4,y+size*.8);ctx.lineTo(x-1,y+size*1.1);ctx.closePath();fill(color);text(s,x,y+1,size,C.ink);
  }
  function reactions(state) {
    // Punctuation is a DOM child of the moving portrait; pause has no glyph.
    if(state.loop) {
      ctx.save();ctx.translate(400,H*(H<750?.07:.09)-25);
      ctx.beginPath();for(let i=0;i<100;i++){const a=i*.18+(motion?.matches?0:state.motionTime*3),r=6+i*.7;i?ctx.lineTo(Math.cos(a)*r,Math.sin(a)*r*.3):ctx.moveTo(0,0);}ctx.strokeStyle=C.brass;ctx.lineWidth=5;ctx.stroke();ctx.restore();
    }
  }
  function birdMusic(state) {
    const bird=state.bird;if(!bird.visible)return;
    const k=birdScale(),beak={x:bird.x+32*k,y:bird.y-25*k};
    for(const n of state.birdGlyphs) {
      const q=motion?.matches?.3:clamp(n.age/.85,0,1),size=(n.big?25:19)*pixelUnit;
      const x=clamp(beak.x+q*65,48+size/2,752-size/2),y=Math.max(55+size/2,beak.y-q*(n.big?180:120));
      ctx.save();ctx.globalAlpha=1-q*.85;text(n.big?'♫':'♪',x,y,size,C.blue);ctx.restore();
    }
    if(bird.round&&bird.mode!=='bow'&&bird.mode!=='leave') {
      const word=tr(`斗琴 第 ${bird.round} 回合`,`Round ${bird.round}`),size=12*pixelUnit,w=measured(word,size)+16*pixelUnit;
      const x=clamp(bird.x,48+w/2,752-w/2),y=bird.y+18*pixelUnit;
      rounded(x-w/2,y-size*.7,w,size*1.5,5*pixelUnit);fill('#1b3146');
      text(word,x,y,size,C.blue);
    }
  }
  function audience(state) {
    const a=state.audience.at(-1),age=a?state.motionTime-a.t:0;
    const scale=clamp(24*pixelUnit/50,.75,1.3),count=10;
    for(let i=0;i<count;i++) {
      const x=42+i*79,variation=i%4;
      const bounce=a?.type==='laugh'&&!motion?.matches&&!state.pause?Math.abs(Math.sin(age*(9+a.level*2)+i*.9))*a.level*7:0;
      const y=H*.94-bounce;
      ctx.save();ctx.translate(x,y);ctx.scale(scale,scale);
      if(state.pause)ctx.rotate(i%2?.18:-.18);
      const skin=['#795362','#a37578','#604253','#8b6863'][i%4];
      ellipse(0,32,33,34,'#271923');ellipse(0,0,22,25,skin);
      if(variation===0){ellipse(-17,-19,10,10,'#392734');ellipse(0,-12,22,13,'#392734');}
      if(variation===1){rounded(-23,-40,46,24,4);fill('#392734');rounded(-30,-19,60,7,3);fill('#392734');}
      if(variation===2){ctx.beginPath();ctx.arc(0,-3,25,Math.PI,Math.PI*2);fill('#392734');}
      if(variation===3)for(const dx of [-10,10]){ctx.beginPath();ctx.arc(dx,0,7,0,Math.PI*2);ctx.strokeStyle=C.muted;ctx.lineWidth=2;ctx.stroke();}
      for(const dx of [-8,8])ellipse(dx,0,2.5,2.5,C.ink);
      if(a?.type==='gasp')ellipse(0,12,5,7,C.ink);
      else if(a?.type==='laugh'){ctx.beginPath();ctx.arc(0,9,9,0,Math.PI);fill(C.ink);}
      else line([[-5,12],[5,12]],C.ink,2);
      if(a?.type==='cheer') {
        const clap=motion?.matches||state.pause?3:7+Math.sin(age*24+i)*6;
        for(const sign of [-1,1]){ctx.save();ctx.translate(sign*(19+clap),15);ctx.rotate(sign*.4);ellipse(0,0,7,13,'#deb19a');ctx.restore();}
      }
      ctx.restore();
      if(a&&age<1.7) {
        const bubbles=a.type==='laugh'?a.level*2:2;
        const show=a.type==='laugh'&&a.level===3?(i<=2||i>=7):i>0&&i<count-1&&i%Math.max(1,Math.floor(8/bubbles))===0;
        if(show)bubble(a.type==='laugh'?tr('哈','ha'):a.type==='gasp'?tr('哇！','Whoa!'):'Bravo!',x,y-48*scale-(i%2)*12,C.cream,(a.type==='cheer'?16:18)*pixelUnit);
      }
    }
    if(a?.type==='laugh'&&a.level===3) {
      text(tr('哈哈哈','HAHAHA'),400,H*.87,28*pixelUnit,C.brass);
    }
    for(const e of state.audience.filter(e=>e.type==='cheer'))for(let i=0;i<8;i++){
      const dt=motion?.matches?.7:state.motionTime-e.t-i*.12;if(dt<0||dt>2.4)continue;
      const x=70+i*94+Math.sin(i*4)*dt*55,y=H*.96-H*.65*dt+H*.29*dt*dt;
      ctx.save();ctx.translate(x,y);ctx.scale(1.7,1.7);ctx.rotate(motion?.matches?0:dt*(i%2?3:-3));line([[0,0],[0,24]],'#608954',3);ellipse(4,15,5,3,'#72a664');for(let j=0;j<5;j++)ellipse(Math.cos(j*1.25)*4,Math.sin(j*1.25)*4,5,5,j%2?C.pink:C.coral);ellipse(0,0,3,3,'#b4293d');ctx.restore();
    }
  }
  function onomatopoeia(state,onlyBird=false) {
    // Bird answers get one pop; simultaneous cat notes each pop above their key.
    const pops=new Map(state.onomatopoeia.map(e=>[e.kind==='cat-tap'?`cat-${e.p}`:e.kind.startsWith('bird')?'bird':e.kind,e]));
    for(const e of pops.values()) {
      if(e.kind==='restart'||e.kind.startsWith('bird')!==onlyBird)continue;
      const age=state.motionTime-e.t,q=clamp(age/e.d,0,1),small=e.kind==='cat-tap'||e.kind==='bat-flap';
      let x=400,y=H*.52;
      if(e.kind.startsWith('cat')){x=small?pitchX(cue,e.p):state.cat.x;y=H*.68-(small?60:80)*pixelUnit;}
      if(e.kind.startsWith('bird')){x=state.bird.x;y=state.bird.y+48*pixelUnit;}
      const newGuest=state.guests.find(g=>g.id===e.kind.split('-')[0]&&g.visible);
      if(newGuest){x=newGuest.x;y=newGuest.y-95*pixelUnit;}
      if(e.kind==='squeak'){x=360;y=H*.52;}
      if(e.kind==='clunk'){x=pitchX(cue,e.p);y=H*.64;}
      if(e.kind==='owl-hoot')y-=ease(q)*20*pixelUnit;
      const scale=motion?.matches||state.pause||e.kind==='owl-hoot'?1:1+Math.sin(q*Math.PI*3)*.12*(1-q);
      const size=(e.kind==='bat-flap'?12:small?16:26)*pixelUnit,word=e[lang],box=popBox(x,y,measured(word,size,true),size,scale,pixelUnit,H);
      ctx.save();ctx.translate(box.x,box.y);ctx.scale(scale,scale);
      ctx.globalAlpha=q>.75?1-(q-.75)*4:1;
      ctx.font=`900 ${size}px system-ui`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.lineJoin='round';ctx.strokeStyle=C.ink;ctx.lineWidth=7*pixelUnit;ctx.strokeText(word,0,0);ctx.fillStyle=small?C.pink:C.cream;ctx.fillText(word,0,0);ctx.restore();
    }
  }
  const sprites=new Map();let organLayer=null,organKey='',reflection=null,reflectionKey='';
  function warmSprites(){
    const img=$('portrait-img'),refKey=`${cue?.musician}/${canvas.width}/${canvas.height}`;
    if(img.complete&&img.naturalWidth&&reflectionKey!==refKey){
      reflectionKey=refKey;reflection=root.document.createElement('canvas');reflection.width=160;reflection.height=80;const g=reflection.getContext('2d');
      g.save();g.translate(80,80);g.scale(1,-.5);g.beginPath();g.ellipse(0,80,70,80,0,0,Math.PI*2);g.clip();g.drawImage(img,-70,0,140,160);g.restore();
    }
    for(const id of Object.keys(V2.registry))if(!['cat','bird'].includes(id)&&!sprites.has(id)){
      const c=root.document.createElement('canvas');c.width=c.height=256;const g=c.getContext('2d');g.scale(2,2);V2.registry[id].draw(g,id);sprites.set(id,c);
    }
    const key=`${canvas.width}/${canvas.height}/${cue.instrument}`;
    if(organKey!==key){organKey=key;organLayer=cue.instrument==='organ'?layer(paintOrgan):null;}
  }
  function paintOrgan(){for(let i=0;i<19;i++){const x=72+i*35,h=H*(.2+Math.sin(i/18*Math.PI)*.14);rounded(x,55,22,h,11);fill(i%2?'#8f8981':'#bab2a0');line([[x+5,62],[x+5,h+40]],'#ddd5bc',3);rounded(x+5,h+34,12,10,2);fill('#29252b');}}
  function spriteImage(sprite,x,y,size,id){
    if(sprite&&typeof ctx.drawImage==='function')ctx.drawImage(sprite,x,y,size,size);
    else{ctx.save();ctx.translate(x,y);ctx.scale(size/128,size/128);(V2.registry[id]||V2.registry.unknown).draw(ctx,id);ctx.restore();}
  }
  function drawSceneProps(s){
    if(organLayer){if(typeof ctx.drawImage==='function')blit(organLayer);else paintOrgan();}
    if(s.ice){if(reflection&&typeof ctx.drawImage==='function'){ctx.save();ctx.globalAlpha=.16;ctx.drawImage(reflection,325+s.portrait.x*pixelUnit,H*.765,150,H*.07);ctx.restore();}ctx.fillStyle='#80cfff35';ctx.fillRect(30,H*.765,740,H*.075);for(let i=0;i<8;i++)line([[60+i*93,H*.79],[105+i*86,H*.81]],'#d5f4ff66',2);}
    for(const e of s.stuckPipes){const x=72+(((e.p??60)%19)+19)%19*35;ctx.save();ctx.globalAlpha=.65;rounded(x+Math.sin(s.motionTime*26)*1.5,55,22,H*.25,11);fill(C.coral);ctx.restore();}
    if(s.sleepy){ctx.fillStyle='#14040a44';ctx.fillRect(0,55,100,H*.76);ctx.fillRect(700,55,100,H*.76);}
  }
  function drawSkin(s){
    if(cue.view==='keyboard'){
      const at=s.motionTime,ky=H*.68;
      if(cue.instrument==='organ'){
        rounded(65,H*.79,670,H*.037,5);fill('#503326');
        for(let i=0;i<18;i++){const lit=s.activeNotes.some(n=>['ped','pedal'].includes(n.part)&&Math.round(n.p)%18===i);rounded(70+i*37,H*.79,32,H*.03,3);fill(lit?C.teal:'#b29671');}
      }
      if(['harpsichord','celesta'].includes(cue.instrument))for(const n of s.activeNotes){
        const age=at-n.t;if(age>.35)continue;const x=pitchX(cue,n.p),q=age/.35;ctx.save();ctx.globalAlpha=1-q;
        if(cue.instrument==='celesta'){line([[x-7,ky-12-q*25],[x+7,ky-12-q*25]],C.cream,2);line([[x,ky-19-q*25],[x,ky-5-q*25]],C.cream,2);ellipse(x,ky-12-q*25,3,3,C.blue);}
        else{line([[x,ky-4],[x+10,ky-24-q*15]],C.brass,2);line([[x+2,ky-14],[x+14,ky-19]],C.cream,2);}
        ctx.restore();
      }
    }
    if(cue.view==='pitch'){
      const p=s.trace.at(-1)?.at(-1)?.p??cue.range[0],y=pitchY(cue,p,H)+s.slip*H*.12;
      if(cue.instrument==='oboe'){line([[214,y-28],[230,y+25]],'#deb487',8);line([[211,y-31],[218,y-18]],'#57333a',4);for(let i=0;i<4;i++)ellipse(218+i*3,y-11+i*8,2.5,2.5,C.cream);}
      else{ellipse(225,y+1,12,20,'#b17243');ellipse(223,y-10,10,11,'#c89552');line([[222,y-35],[226,y+15]],'#e9d4ad',3);line([[210,y-18],[242,y+14]],C.cream,2);}
    }
    if(s.stopwatch){const v=s.stopwatch,col=v.red?C.coral:C.brass;rounded(42,65,125,44,8);fill('#14040add');ellipse(62,86,12,12,col);line([[62,86],[62,77]],C.ink,2);text(`${v.elapsed.toFixed(1)}s`,115,87,18,col);}
    const snap=s.stringSnap;if(snap&&s.t-snap.t<1.8){const age=s.t-snap.t,q=ease(clamp(age/.5,0,1));ctx.save();ctx.globalAlpha=1-clamp((age-1)/.8,0,1);line(Array.from({length:18},(_,i)=>[220+i*4,H*.58+Math.sin(i*.5)*q*16]),C.cream,2);sparkBurst(230,H*.58,age,motion?.matches);ctx.restore();}
    const flip=s.pageFlip;if(flip&&s.t-flip.t<.8){const q=clamp((s.t-flip.t)/.8,0,1);ctx.save();ctx.translate(650,H*.61);ctx.scale(Math.cos(q*Math.PI),1);ctx.fillStyle=C.cream;ctx.fillRect(-22,-30,44,35);ctx.restore();}
    if(s.flicker){ctx.fillStyle=`rgba(20,4,10,${s.flicker})`;ctx.fillRect(0,0,W,H);}
  }
  function drawEnsemble(s){
    const head=240,speed=210,at=s.motionTime;
    rounded(36,H*.43,728,H*.32,8);fill('#14040ab0');
    for(const p of s.ensemble){const size=Math.min(12*pixelUnit,p.height*.38);text(p[lang],108,p.y,size,C.muted);line([[184,p.y+p.height/2],[756,p.y+p.height/2]],'#fff0db20',1);}
    ctx.save();ctx.beginPath();ctx.rect(190,H*.43,570,H*.32);ctx.clip();
    const first=lowerBound(cue.notes,Math.max(0,at-cue.maxNoteDuration-1));
    for(let i=first;i<cue.notes.length&&cue.notes[i].t<=at+2.5;i++){
      const n=cue.notes[i],lane=s.ensemble.find(p=>p.id===n.part);if(!lane)continue;
      const x=head+(n.t-at)*speed,w=Math.max(7,n.d*speed),h=lane.height*(.2+n.v*.55);if(x+w<190||x>760)continue;
      rounded(x,lane.y-h/2,w,h,Math.min(7,h/2));fill(noteColor(n));
      if(!n.ok)line([[x+3,lane.y-h*.25],[x+Math.min(w-3,12),lane.y+h*.25]],C.ink,2);
    }
    ctx.restore();line([[head,H*.43],[head,H*.75]],C.cream,2);
    // Baton is continuous between accents, with a longer swing on fortissimo.
    ctx.save();ctx.translate(535+s.portrait.x*pixelUnit,H*(H<750?.28:.32)+s.portrait.y*pixelUnit);ctx.rotate(s.baton);line([[0,15],[40,-24]],C.cream,3);ellipse(0,15,6,6,C.brass);ctx.restore();
  }
  function drawGuests(s){
    const unit=Math.min(pixelUnit,2.3),at=s.motionTime;
    for(const g of s.guests){if(!g.visible)continue;const sprite=sprites.get(g.id)||sprites.get('unknown');
      const size=(g.id==='door'?78:g.id==='pageturner'?70:58)*unit;
      ctx.save();ctx.globalAlpha=g.alpha;ctx.translate(g.x,g.y);ctx.rotate(g.angle||0);
      if(g.id==='door'){
        const opening=g.mode==='open'?ease(clamp(g.age/.8,0,1)):0,knock=cue.guestNotes.filter(n=>n.part==='door'&&n.t<=at&&at<n.t+.3).at(-1)||(g.mode==='knock'&&g.age<.3?{t:g.event.t}:null);
        const shake=knock&&!motion?.matches?Math.sin((at-knock.t)/.3*Math.PI*4)*2:0;
        rounded(-size*.2,-size*.75,size*.45,size*.55,4);fill('#deb487');line([[-size*.1,-size*.72],[-size*.1,-size*.83],[size*.16,-size*.83],[size*.16,-size*.72]],'#deb487',3);
        ctx.save();ctx.translate(-size*.25+shake,-size);ctx.scale(1-opening*.8,1);spriteImage(sprite,0,0,size,g.id);ctx.restore();
        if(opening>.1){for(let i=0;i<3;i++)line([[i*8-8,-size*.85],[i*8-8+Math.sin(at*2+i)*4,-size*.97]],'#fff0db99',2);text(tr('外卖！','DELIVERY!'),0,-size*.48,11*pixelUnit,C.ink);}
      }else{
        if(g.id==='swan'){ellipse(0,4,size*.65,5,'#80cfff55');line([[-size*.65,6],[size*.7,6]],C.blue,1);}
        spriteImage(sprite,-size/2,-size,size,g.id);
        if(g.id==='turkey'){ellipse(size*.16,-size*.41+Math.sin(at*9)*2,size*.035,size*.10,C.coral);}
        if(['gobble','hoot','bark','honk'].includes(g.mode)&&g.age<(g.event.d??.7)){ellipse(size*.23,-size*.62,size*.06,size*.04+(Math.sin(g.age*6)**2)*size*.035,C.ink);}
        if(g.id==='owl'){const swivel=motion?.matches?0:Math.sin(at*1.4)*.17;ctx.save();ctx.translate(0,-size*.6);ctx.rotate(swivel);ellipse(-size*.12,0,size*.08,size*.1,C.cream);ellipse(size*.12,0,size*.08,size*.1,C.cream);ellipse(-size*.12+swivel*10,0,2,3,C.ink);ellipse(size*.12+swivel*10,0,2,3,C.ink);ctx.restore();}
        if(g.id==='bat'&&g.mode==='flap'){const a=motion?.matches?0:Math.sin(at*16)*.65;for(const sign of [-1,1]){ctx.save();ctx.translate(sign*size*.14,-size*.45);ctx.rotate(sign*a);ellipse(sign*size*.23,0,size*.25,size*.075,'#8871af');ctx.restore();}}
        if(g.id==='puppy'&&g.mode==='spin'){for(let i=0;i<3;i++){ctx.save();ctx.globalAlpha=.35;line([[-size*.3,-size*.2],[-size*.55,-size*.4+Math.sin(at*22+i)*7]],'#edbc7d',4);ctx.restore();}}
        if(g.id==='swan'&&g.mode==='honk'&&g.age<(g.event.d??.8)){const q=Math.sin(Math.PI*clamp(g.age/Math.max(.12,g.event.d??.8),0,1));ellipse(size*.15,-size*.48-q*size*.12,size*.06,size*.2,C.cream);ellipse(size*.15,-size*.67-q*size*.18,size*.10,size*.08,C.cream);ellipse(size*.18,-size*.69-q*size*.18,2,2,C.ink);line([[size*.20,-size*.65-q*size*.18],[size*.35,-size*.60-q*size*.18]],C.brass,3);}
        if(g.id==='swan'&&g.mode==='flap'&&g.age<2){const spread=Math.sin(Math.PI*clamp(g.age/2,0,1));for(const sign of [-1,1]){ctx.save();ctx.rotate(sign*spread*.4);ellipse(sign*size*.35,-size*.4,size*.4,size*.08,C.cream);ctx.restore();}for(let i=0;i<7;i++){const q=clamp(g.age/2,0,1);ellipse(Math.sin(i*3)*q*size,-size*.4-q*50+i*3,4,2,C.cream);}}
        if(g.id==='pageturner'&&g.mode==='flip'&&g.age<.8){const q=clamp(g.age/.8,0,1);ctx.save();ctx.translate(size*.18,-size*.55);ctx.scale(Math.cos(q*Math.PI),1);ctx.fillStyle=C.cream;ctx.fillRect(0,0,size*.27,size*.22);ctx.restore();}
      }
      ctx.restore();
      for(const n of cue.guestNotes)if(n.part===g.id&&at>=n.t&&at<n.t+.7){const q=(at-n.t)/.7;ctx.save();ctx.globalAlpha=1-q;ellipse(g.x+q*28,g.y-size-q*35-(n.glide?mix(n.glide[0],n.glide[1],ease(clamp((at-n.t)/Math.max(.12,n.d),0,1)))*4:0),4*pixelUnit,4*pixelUnit,g.colour);ctx.restore();}
    }
    for(const p of s.snow)ellipse(p.x,p.y,2.5,2.5,'#d5f4ff99');
    for(const p of s.pages){ctx.save();ctx.globalAlpha=p.alpha;ctx.translate(p.x,p.y);ctx.rotate(p.angle);ctx.fillStyle=C.cream;ctx.fillRect(-13,-18,26,36);for(let i=0;i<4;i++)line([[-9,-10+i*6],[9,-10+i*6]],'#694729',1);ctx.restore();}
  }
  function drawPanic(s){
    const t=s.motionTime,top=H*(H<750?.07:.09),bottom=top+H*(H<750?.27:.33),p=s.portrait;
    if(s.panic>.01){
      for(let i=0;i<5;i++){const q=motion?.matches?.4:(t*1.5+i*.2)%1,sign=i%2?1:-1;ctx.save();ctx.globalAlpha=s.panic*(1-q);ellipse(400+sign*(83+q*75)+p.x/pixelUnit,top+65+q*60+i*7,4,7,C.blue);ctx.restore();}
      // Wide eyes amplify the zoom pulse while preserving the actual portrait image.
      if(s.reaction?.severity>=3){ctx.save();ctx.globalAlpha=s.panic;for(const sign of [-1,1]){ellipse(400+sign*15,top+H*.12,8,11,C.cream);ellipse(400+sign*15+Math.sin(t*3),top+H*.12,3,5,C.ink);}ctx.restore();}
    }
    if(s.runaway>.01){
      for(let i=0;i<7;i++){const x=80+((t*150+i*89)%650);line([[x,top+60+i*12],[x+25*s.runaway,top+60+i*12]],'#fff0db88',2);}
      rounded(52,113,86,48,7);fill('#14040add');text(tr('速度','TEMPO'),95,126,11*pixelUnit,C.coral);ctx.save();ctx.translate(95,153);ctx.rotate(Math.sin(t*(8+12*s.runaway))*.6);line([[0,0],[0,-19]],C.coral,3);ctx.restore();
    }
    if(s.sleepy){text('Zzz',500+Math.sin(t)*7,top+60-(t%2)*12,18*pixelUnit,C.muted);}
    if(s.shiver){line([[305,top+10],[320,top],[328,top+17],[339,top+4]],C.blue,3);text(tr('哒哒哒','brrr'),400,bottom+15,14*pixelUnit,C.blue);}
    if(s.reaction?.kind==='miscount')text(tr('1、2、3…4？','1, 2, 3…4?'),400,top+20,15*pixelUnit,C.brass);
  }

  const domCache=new WeakMap();
  function put(el,key,value,apply) {let m=domCache.get(el);if(!m)domCache.set(el,m=new Map());if(m.get(key)===value)return;m.set(key,value);apply(value);}
  const css=(el,prop,v)=>put(el,prop,v,x=>{el.style[prop]=x;});
  const txt=(el,v)=>put(el,'#text',v,x=>{el.textContent=x;});
  const hide=(el,v)=>put(el,'#hidden',v,x=>{el.hidden=x;});
  function frameState(time, reduced=motion?.matches) {
    const state=computeState(cue,time,{reducedMotion:reduced,stageHeight:H});
    if(reduced){const still=computeState(cue,0,{reducedMotion:true,stageHeight:H});for(const key of Object.keys(still))if(!["t","subtitle","speech","end","reaction"].includes(key))state[key]=still[key];}
    return state;
  }
  function paintScene(state) {
    ctx.save();ctx.clearRect(0,0,W,H);background(state);drawSceneProps(state);if(cue.view==='keyboard')drawKeyboard(state);else if(cue.view==='ensemble')drawEnsemble(state);else drawPitch(state);drawSkin(state);
    drawCat(state.cat,state.motionTime);reactions(state);audience(state);onomatopoeia(state);ctx.restore();
    // A transparent guest surface sits above the portrait's stacking context.
    // Only the small sprite, notes and word are drawn here; no backdrop repaint.
    const mainCtx=ctx;ctx=guestCtx;
    try {ctx.save();ctx.clearRect(0,0,W,H);drawBird(state.bird,state.motionTime);birdMusic(state);drawGuests(state);drawPanic(state);onomatopoeia(state,true);ctx.restore();}
    finally {ctx=mainCtx;}
  }
  function render(time) {
    if(!cue||destroyed)return null;
    const state=frameState(time);lastState=state;paintScene(state);
    const p=state.portrait,r=state.reaction;
    hide($('reaction-mark'),!state.reactionMark);
    if(state.reactionMark)txt($('reaction-mark'),state.reactionMark);
    css($('portrait'),'transform',`translate(${p.x.toFixed(1)}px,${p.y.toFixed(1)}px) rotate(${p.angle.toFixed(2)}deg) scale(${p.scaleX.toFixed(3)},${p.scaleY.toFixed(3)})`);
    css($('portrait'),'filter',state.end?.kind==='wreck'?'brightness(.6)':'none');
    const loop=$('loop');hide(loop,!state.loop);
    if(state.loop){txt($('loop-text'),tr('E–升D','E–D♯')+` ×${state.loop.count}`);css(loop,'transform',`scale(${(1+Math.min(state.loop.count,10)*.012).toFixed(3)})`);}
    hide($('caption'),!state.subtitle);
    if(state.subtitle)txt($('caption-text'),state.subtitle[lang]);
    const reactionSpeech=r?.type==='pause'?'……':r?.type==='restart'?tr('再来！','Again!'):null;
    hide($('speech'),!state.speech&&!reactionSpeech);
    css($('speech'),'fontSize',reactionSpeech?(r.type==='pause'?'26px':'23px'):'13px');
    if(state.speech||reactionSpeech)txt($('speech-text'),reactionSpeech||state.speech[lang]);
    css($('speech'),'width',`${320/pixelUnit}px`);
    const side=state.speechSide==='left'?-1:state.speechSide==='right'?1:0;
    put($('speech'),'side',state.speechSide,v=>{$('speech').dataset.side=v;});
    const bubbleX=side*(400-36-160)/pixelUnit;
    css($('speech'),'transform',`translateX(-50%) translate(${bubbleX.toFixed(1)}px,0px)`);
    const stamp=$('stamp');hide(stamp,!state.end);
    if(state.end){
      const q=motion?.matches?1:ease(clamp((state.t-state.end.t)/.3,0,1));
      put(stamp,'class',state.end.kind,()=>{stamp.className=`ts-stamp${state.end.kind==='bow'?' ts-bow':''}`;});
      txt(stamp,state.end.kind==='bow'?'Bravo!':state.end.kind==='wreck'?tr('车祸现场','TRAIN WRECK'):tr('意外事故','ACCIDENT'));
      css(stamp,'transform',`translate(-50%,-50%) rotate(${(-9+(1-q)*24).toFixed(2)}deg) scale(${(1+(1-q)*.55).toFixed(3)})`);
    }
    return state;
  }
  const exportMeasures=new Map(),exportPlans=new Map();
  function compose(out,time,layout={}) {
    if(!cue||destroyed)return null;
    const state=frameState(time,false);paintScene(state);
    const model=root.TheaterVideoModel,measure=(value,size)=>{const key=size+":"+value;if(!exportMeasures.has(key)){out.font=`700 ${size}px system-ui`;exportMeasures.set(key,out.measureText(value).width);}return exportMeasures.get(key);};
    const m=MAESTROS.find(m=>m.id===cue.musician),piece=m?.pieces.find(p=>p.id===cue.piece),credit=api.credit();
    const clip=lang==='zh'?`${m?.zh||cue.musician}《${piece?.zh||cue.piece}》· ${kindName(cue.kind)}`:`${m?.en||cue.musician} · ${piece?.en||cue.piece} · ${kindName(cue.kind)}`;
    const lic=(s='')=>/public domain/i.test(s)?tr('公有领域','Public Domain'):/Attribution-ShareAlike|BY-SA/i.test(s)?'CC BY-SA '+((s.match(/\d\.\d/)||['3.0'])[0]):/Attribution/i.test(s)?'CC BY '+((s.match(/\d\.\d/)||['4.0'])[0]):s;
    const cLine=credit?`${credit.line?.[lang]||credit.typesetter||credit.score} · ${lic(credit.score_license)} · ${tr('合成演奏改编','Synthesized adaptation')}`:'';   // short: URLs are unreadable in a video
    const copy={title:tr('《今晚谁出局》',"Who's Out Tonight"),clip,caption:state.subtitle?.[lang]||'',credit:cLine,...layout};const key=JSON.stringify(copy);if(!exportPlans.has(key))exportPlans.set(key,model.layout(copy,measure));const plan=exportPlans.get(key);
    function words(block,color=C.cream){out.save();out.font=`700 ${block.size}px system-ui`;out.fillStyle=color;out.textAlign='center';out.textBaseline='middle';const top=block.y+(block.h-block.lines.length*block.lineHeight)/2;block.lines.forEach((line,i)=>out.fillText(line,block.x+block.w/2,top+block.lineHeight*(i+.5)));out.restore();}
    out.save();out.fillStyle=C.ink;out.fillRect(0,0,plan.width,plan.height);words(plan.title,C.brass);words(plan.clip);
    const box=plan.stage;out.save();out.translate(box.x,box.y);out.scale(box.w/W,box.h/H);out.beginPath();out.rect(0,0,W,H);out.clip();out.drawImage(canvas,0,0,W,H);
    // The same portrait offsets, origin, tilt and scales used by the live rig.
    const pw=W*(H<750?.20:.34),ph=pw/.85,px=(W-pw)/2,py=H*(H<750?.07:.09),p=state.portrait,img=$('portrait-img');
    out.save();out.translate(px+pw/2+p.x*pixelUnit,py+ph*.85+p.y*pixelUnit);out.rotate(p.angle*Math.PI/180);out.scale(p.scaleX,p.scaleY);out.translate(-pw/2,-ph*.85);
    const ring=out.createLinearGradient(0,0,pw,ph);ring.addColorStop(0,'#7a5219');ring.addColorStop(.3,'#ffe09a');ring.addColorStop(.6,C.brass);ring.addColorStop(1,'#2b1907');out.fillStyle=ring;out.beginPath();out.ellipse(pw/2,ph/2,pw/2,ph/2,0,0,Math.PI*2);out.fill();
    if(img.complete&&img.naturalWidth){out.save();out.beginPath();out.ellipse(pw/2,ph/2,pw/2-5*pixelUnit,ph/2-5*pixelUnit,0,0,Math.PI*2);out.clip();if(state.end?.kind==='wreck')out.filter='brightness(.6)';const ratio=Math.max(pw/img.naturalWidth,ph/img.naturalHeight),iw=img.naturalWidth*ratio,ih=img.naturalHeight*ratio;out.drawImage(img,(pw-iw)/2,(ph-ih)/2,iw,ih);out.restore();}
    if(state.reactionMark)words(model.fit(state.reactionMark,{x:pw*.82,y:-5,w:pw*.28,h:60},30*pixelUnit,measure));out.restore();
    out.drawImage(guestCanvas,0,0,W,H);
    const reactionSpeech=state.reaction?.type==='pause'?'……':state.reaction?.type==='restart'?tr('再来！','Again!'):null;
    if(state.speech||reactionSpeech){const side=state.speechSide==='left'?-1:state.speechSide==='right'?1:0,x=240+side*204;const block=model.fit(reactionSpeech||state.speech[lang],{x:x+12,y:80,w:296,h:96},reactionSpeech?30:25,measure);out.fillStyle=C.cream;out.beginPath();out.roundRect(x,70,320,116,16);out.fill();words(block,'#261019');}
    if(state.loop){const x=px+pw*.82,y=py+ph*.24;out.fillStyle=C.brass;out.beginPath();out.roundRect(x,y,200,80,10);out.fill();words(model.fit(tr('原地打转','STUCK ON REPEAT')+`\n${tr('E–升D','E–D♯')} ×${state.loop.count}`,{x:x+8,y:y+4,w:184,h:72},22,measure),'#28100e');}
    if(state.end){const q=ease(clamp((state.t-state.end.t)/.3,0,1));out.save();out.translate(W/2,H*.51);out.rotate((-9+(1-q)*24)*Math.PI/180);out.scale(1+(1-q)*.55,1+(1-q)*.55);out.fillStyle='#14040ae8';out.fillRect(-240,-52,480,104);out.strokeStyle=state.end.kind==='bow'?C.brass:C.coral;out.lineWidth=4;out.strokeRect(-240,-52,480,104);words(model.fit(state.end.kind==='bow'?'Bravo!':state.end.kind==='wreck'?tr('车祸现场','TRAIN WRECK'):tr('意外事故','ACCIDENT'),{x:-228,y:-44,w:456,h:88},44,measure),out.strokeStyle);out.restore();}
    out.restore();if(plan.caption.lines.length){out.fillStyle='#14040af2';out.beginPath();out.roundRect(24,plan.caption.y-4,672,plan.caption.h+8,12);out.fill();words(plan.caption);}
    words(plan.url,C.brass);words(plan.credit,C.muted);out.restore();return state;
  }
  function clockText(t){return `${Math.floor(t/60)}:${String(Math.floor(t%60)).padStart(2,'0')}`;}
  function resize() {
    if(destroyed)return;
    const rect=options.fixedSize||canvas.getBoundingClientRect(),dpr=(options.fixedSize?1:Math.min(root.devicePixelRatio||1,dprCap)*quality),width=Math.max(1,Math.round(rect.width*dpr)),height=Math.max(1,Math.round(rect.height*dpr));
    // Canvas pixels remain measured at physical size; DOM anchors use logical CSS pixels.
    H=W*rect.height/Math.max(1,rect.width);pixelUnit=W/Math.max(1,rect.width/(options.coordinateScale?.()||1));
    if(canvas.width!==width||canvas.height!==height){canvas.width=width;canvas.height=height;ctx.setTransform(width/W,0,0,height/H,0,0);}
    if(guestCanvas.width!==width||guestCanvas.height!==height){guestCanvas.width=width;guestCanvas.height=height;guestCtx.setTransform(width/W,0,0,height/H,0,0);}
    if(cue){warmText();warmSprites();css($('speech'),'marginTop',`${(70-H*(H<750?.07:.09))/pixelUnit}px`);render(lastState?.t??offset);}
  }
  function context() {
    if(options.audio)return options.audio.context();
    if(!audio){const Audio=root.AudioContext||root.webkitAudioContext;if(!Audio)throw new Error('Web Audio is unavailable');audio=new Audio();}
    return audio;
  }
  const nowMs=()=>root.performance&&root.performance.now?root.performance.now():Date.now();
  let perfAnchor=0,smooth=0;
  function audioTime() {return source&&audio?offset+(audio.currentTime-anchor)*rate:offset+(nowMs()-perfAnchor)/1000*rate;}
  function currentTime() {
    if(!cue)return 0;if(!playing)return clamp(offset,0,cue.duration);
    // Web Audio's clock advances in coarse steps on some browsers; animate from performance.now and
    // pull gently toward the audio clock so visuals never drift from the sound.
    const est=offset+(nowMs()-perfAnchor)/1000*rate,drift=audioTime()-est;
    if(Math.abs(drift)>.08)perfAnchor-=drift*1000/rate;else perfAnchor-=drift*100/rate;
    smooth=offset+(nowMs()-perfAnchor)/1000*rate;
    return clamp(smooth,0,cue.duration);
  }
  function stopSource(){if(source){source.onended=null;try{source.stop();}catch(_){}source.disconnect();source=null;}if(gain){gain.disconnect?.();gain=null;}}
  function pause() {
    playIntent++;offset=currentTime();playing=false;stopSource();root.cancelAnimationFrame(raf);raf=0;if(active===api)active=null;if(cue&&!destroyed)render(offset);emit('pause',offset);return offset;
  }
  function startSource() {
    stopSource();perfAnchor=nowMs();anchor=audio?.currentTime||0;
    if(buffer&&audio&&!muted&&options.audio?.muted?.()!==true&&offset<buffer.duration){
      source=audio.createBufferSource();source.buffer=buffer;source.playbackRate.value=rate;
      if(audio.createGain){gain=audio.createGain();source.connect(gain);gain.connect(options.audio?.destination?.()||audio.destination);
        const t=audio.currentTime;gain.gain.setValueAtTime(offset>0?0:1,t);gain.gain.linearRampToValueAtTime(1,t+(offset>0?.25:0));
      }else source.connect(audio.destination);
      source.start(0,offset);
    }
  }
  let dprCap=options.dprCap||2,frameAvg=16,lastFrame=0,slowFrames=0,quality=1,lastDraw=0;
  const frameLog=[];   // [wall ms, clip t] of the last frames drawn, for diagnosing judder
  function tick() {
    if(!playing)return;
    const now=nowMs();
    lastDraw=now;if(lastFrame){frameAvg=frameAvg*.9+(now-lastFrame)*.1;slowFrames=frameAvg>26?slowFrames+1:0;}lastFrame=now;
    if(slowFrames>45&&dprCap>1){dprCap=dprCap>1.5?1.5:1;slowFrames=0;resize();}
    const t=currentTime();render(t);frameLog.push([now,t,nowMs()-now]);if(frameLog.length>240)frameLog.shift();
    emit('time',t);if(t>=cue.duration){pause();emit('end',cue);return;}raf=root.requestAnimationFrame(tick);
  }
  async function play(from) {
    if(!cue||destroyed||mode==='loading')return;
    if(Number.isFinite(from))seek(from);if(playing)return;
    if(active&&active!==api)active.pause();active=api;
    const generation=request,intent=++playIntent;
    try{audio=context();if(!muted&&options.audio?.muted?.()!==true)await audio?.resume();}catch(_){audio=null;}
    if(destroyed||generation!==request||intent!==playIntent||mode==='loading'||playing)return;
    if(active&&active!==api)active.pause();active=api;
    if(offset>=cue.duration)offset=0;playing=true;lastFrame=0;startSource();tick();
  }
  function seek(time) {
    if(!cue)return null;const running=playing;offset=clamp(finite(time)?time:0,0,cue.duration);
    if(running)startSource();const state=render(offset);emit('time',offset);return state;
  }
  // Lightweight preview timbres, generated from MOCK notes / sampled pitch.
  // Production clips always use decoded audio; never pair mock cues with real music.
  function synthMock(c,ac) {
    const sampleRate=22050,b=ac.createBuffer(1,Math.ceil(c.duration*sampleRate),sampleRate),out=b.getChannelData(0);
    for(const n of c.notes) {
      const start=Math.floor(n.t*sampleRate),len=Math.min(Math.floor((n.d+.035)*sampleRate),out.length-start);
      const curve=n.part==='solo'?c.curves.find(k=>Math.abs(k.pts[0][0]-n.t)<.001):null;
      let phase=0,index=1;
      for(let i=0;i<len;i++) {
        const dt=i/sampleRate;let pitch=n.p;
        if(curve){const pts=curve.pts;while(index<pts.length-1&&pts[index][0]<n.t+dt)index++;const a=pts[index-1],z=pts[index];pitch=mix(a[1],z[1],clamp((n.t+dt-a[0])/(z[0]-a[0]),0,1));}
        phase+=2*Math.PI*440*Math.pow(2,(pitch-69)/12)/sampleRate;
        const env=Math.min(1,dt/.007)*Math.max(0,Math.min(1,(n.d+.035-dt)/.04))*Math.exp(-dt*(c.view==='keyboard'?4:1));
        const wave=Math.sin(phase)+.24*Math.sin(phase*2)+.1*Math.sin(phase*3);
        out[start+i]+=wave*env*n.v*(n.part==='lh'?.1:.15);
      }
    }
    for(let i=0;i<out.length;i++)out[i]=Math.tanh(out[i]);return b;
  }
  async function load(clipId,{mock=false}={}) {
    if(destroyed)return null;if(mock&&!clipId.startsWith('mock-'))clipId='mock-'+clipId;mockMode=mock||clipId.startsWith('mock-');
    if(typeof clipId!=='string'||!/^[-a-z0-9]+$/.test(clipId))throw new Error('Invalid clip ID');
    pause();const token=++request;selected=clipId;mode='loading';cue=null;buffer=null;lastState=null;offset=0;audioProblem=false;
    updateCopy();
    async function fetchCue(id){if(!cueCache.has(id)){const job=root.fetch(`assets/cues/${id}.json`).then(async res=>{if(!res.ok)throw new Error(`Cue HTTP ${res.status}`);return await res.json();});cueCache.set(id,job);job.catch(()=>cueCache.delete(id));}return parseCue(await cueCache.get(id));}
    try {
      let next;
      [next,credits]=await Promise.all([fetchCue(clipId),fetchCredits()]);
      if(next.id!==clipId&&next.id!==`mock-${clipId}`)throw new Error('Cue ID does not match requested clip');
      if(token!==request)return null;
      cue=next;mode=cue.id.startsWith('mock-')?'mock':'real';
      // Render immediately; audio fetching/decoding must not delay screenshot frames.
      setupCue();render(0);resize();updateCopy();
      try {
        const ac=context();audio=ac;let decoded;
        if(mode==='mock')decoded=synthMock(cue,ac);
        else if(options.audio?.load)decoded=await options.audio.load(cue.audio);
        else{if(!bufferCache.has(cue.audio)){const job=root.fetch(cue.audio).then(async res=>{if(!res.ok)throw new Error(`Audio HTTP ${res.status}`);return ac.decodeAudioData(await res.arrayBuffer());});bufferCache.set(cue.audio,job);job.catch(()=>bufferCache.delete(cue.audio));}decoded=await bufferCache.get(cue.audio);}
        if(token!==request)return null;buffer=decoded;
        if(mode==='real'&&Math.abs(buffer.duration-cue.duration)>.15)audioProblem='duration';
      }catch(err){if(token!==request)return null;audioProblem=true;}
      if(token!==request)return null;
      updateCopy();emit('load',cue);return cue;
    } catch(err) {
      if(token!==request)return null;mode='error';cue=null;updateCopy();emit('error',err);throw err;
    }
  }
  function setupCue() {
    $('portrait-img').src=`assets/portraits/${cue.musician}.webp`;
    warmText();warmSprites();
    css($('speech'),'top','0');
    css($('speech'),'marginTop',`${(70-H*(H<750?.07:.09))/pixelUnit}px`);
  }
  function updateCopy() {
    $('stage').setAttribute('aria-label',tr('演出舞台','Performance stage'));
    txt($('loop-label'),tr('原地打转','STUCK ON REPEAT'));
    const m=MAESTROS.find(m=>m.id===cue?.musician);
    if(cue){$('now-playing').textContent=`${m?m[lang]:cue.musician} · ${m?.pieces.find(p=>p.id===cue.piece)?.[lang]||cue.piece} · ${kindName(cue.kind)}`;$('portrait-img').alt=m?m[lang]:cue.musician;}
    $('ticket').textContent=mode==='mock'?tr('模拟演出','MOCK PREVIEW'):mode==='real'?tr('现场','ON STAGE'):'PREVIEW';
    if(cue)render(lastState?.t??offset);
  }
  $('portrait-img').addEventListener('load',()=>{reflectionKey='';if(cue){warmSprites();render(currentTime());}});
  const motionChange=()=>{if(!destroyed)render(currentTime());};
  root.addEventListener('resize',resize);motion?.addEventListener?.('change',motionChange);
  const observer=root.ResizeObserver?new root.ResizeObserver(resize):null;observer?.observe(canvas);
  root.document.fonts?.ready.then(()=>{if(destroyed)return;textWidths.clear();warmText();if(cue)render(currentTime());});
  const api={load,play,pause,seek,render,compose,audioData:()=>({context:context(),buffer,muted:options.audio?.muted?.()??muted}),get lang(){return lang;},frames:()=>frameLog.slice(),
    on(name,fn){if(!listeners.has(name))listeners.set(name,new Set());listeners.get(name).add(fn);return ()=>listeners.get(name)?.delete(fn);},
    setLang(l){lang=l==='en'?'en':'zh';updateCopy();},
    setMuted(b){const t=currentTime();muted=!!b;if(playing){offset=t;startSource();}},
    fadeOut(seconds=.25){if(gain&&audio){gain.gain.cancelScheduledValues(audio.currentTime);gain.gain.setValueAtTime(gain.gain.value,audio.currentTime);gain.gain.linearRampToValueAtTime(0,audio.currentTime+seconds);}},
    credit(){return cue?credits[`${cue.musician}-${cue.piece}`]:null;},
    get cue(){return cue;},get audioProblem(){return audioProblem;},get time(){return currentTime();},get playing(){return playing;},stage,nodes,
    destroy(){if(destroyed)return;pause();destroyed=true;request++;observer?.disconnect();root.removeEventListener?.('resize',resize);motion?.removeEventListener?.('change',motionChange);listeners.clear();stage.remove();style.remove();cue=buffer=lastState=null;sprites.clear();textWidths.clear();layerBase=layerFront=null;layerAll=layerSpot=[];}
  };
  resize();return api;
  }
  const STYLE=".ts-stage{--curtain:#1f0810;--brass:#f2c46a;--cream:#fff0db;--low:#ff5b4d;--display:\"TO Display\",system-ui,sans-serif;color:var(--cream);font:15px/1.4 system-ui;box-sizing:border-box}.ts-stage *{box-sizing:border-box}.ts-stage [hidden]{display:none!important}    .ts-stage{position:relative;isolation:isolate;width:100%;aspect-ratio:4/5;max-height:72vh;overflow:hidden;border-radius:12px;border:1px solid #f2c46a66;background:#14040a;box-shadow:0 15px 40px #0005}.ts-stage canvas{position:absolute;inset:0;width:100%;height:100%}.ts-guest-canvas{z-index:3;pointer-events:none}.ts-portrait-rig{position:absolute;left:50%;top:9%;width:34%;min-width:120px;aspect-ratio: .85;transform:translateX(-50%);pointer-events:none;z-index:2}.ts-portrait{position:absolute;inset:0;border-radius:50%;padding:5px;background:linear-gradient(120deg,#7a5219,#ffe09a 25%,#7a5219 48%,#f2c46a 68%,#2b1907);box-shadow:0 0 0 2px #7a5219,0 0 0 4px #f2c46a44,0 8px 16px #0008;transform-origin:50% 85%;will-change:transform}.ts-reaction-mark{position:absolute;left:94%;top:8%;transform:translate(-50%,-50%);z-index:3;color:var(--cream);font:900 28px/1 system-ui;text-shadow:2px 2px 0 #14040a,-2px -2px 0 #14040a;pointer-events:none}.ts-portrait img{display:block;width:100%;height:100%;object-fit:cover;border-radius:50%;border:1px solid #2b1907}\n    .ts-caption{position:absolute;left:4%;right:4%;bottom:17%;z-index:5;padding:8px 10px;color:var(--cream);background:#14040af2;border:1px solid #f2c46a66;border-radius:7px;font-size:15px;font-weight:700;line-height:1.3;text-align:center;pointer-events:none}.ts-speech{position:absolute;left:50%;top:94%;width:190px;max-width:60vw;transform:translateX(-50%);padding:7px 10px;border:2px solid #7a5219;border-radius:14px;background:var(--cream);color:#261019;font-size:16px;font-weight:700;line-height:1.25;text-align:center;z-index:5}.ts-speech::before{content:\"\";position:absolute;top:-9px;left:45%;width:15px;height:15px;transform:rotate(45deg);background:var(--cream);border-left:2px solid #7a5219;border-top:2px solid #7a5219}.ts-speech[data-side=left]::before{left:72%}.ts-speech[data-side=right]::before{left:20%}.ts-speech span{position:relative;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}.ts-loop{position:absolute;left:82%;top:24%;transform-origin:left center;white-space:nowrap;background:var(--brass);color:#28100e;border:2px solid #fff0db;border-radius:9px;padding:5px 7px;box-shadow:3px 4px 0 #0006;font-weight:900;font-size:15px;line-height:1.2}.ts-loop small{display:block;font-size:9px;letter-spacing:.1em;margin-bottom:3px}.ts-stamp{position:absolute;z-index:6;left:50%;top:51%;white-space:nowrap;font:900 clamp(28px,8vw,70px)/1.1 var(--display);color:var(--low);border:4px double currentColor;border-radius:7px;background:#14040ae8;padding:10px 12px;box-shadow:0 4px 22px #0006;pointer-events:none}.ts-stamp.ts-bow{color:var(--brass);border:0;background:transparent;text-shadow:0 0 25px var(--brass);font:900 clamp(42px,12vw,85px)/1.1 Georgia,serif}\n.ts-portrait-rig .ts-speech span{-webkit-line-clamp:3}@media(prefers-reduced-motion:reduce){.ts-portrait{will-change:auto}}.ts-sr-only{position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%)}@media(min-width:601px){.ts-stage{aspect-ratio:16/10}.ts-portrait-rig{width:20%;top:7%;min-width:120px}.ts-speech{font-size:16px}.ts-loop{font-size:17px}.ts-caption{bottom:17%;left:10%;right:10%}}";
  root.TheaterStage={mount,async preload(id,{audio}={}){
    if(!/^[-a-z0-9]+$/.test(id))throw new Error('Invalid clip ID');
    if(!cueCache.has(id)){const job=root.fetch(`assets/cues/${id}.json`).then(async r=>{if(!r.ok)throw new Error(`Cue HTTP ${r.status}`);return r.json();});cueCache.set(id,job);job.catch(()=>cueCache.delete(id));}
    const cue=parseCue(await cueCache.get(id));if(audio?.load)await audio.load(cue.audio);return cue;
  }};
})(typeof window!=='undefined'?window:globalThis);
