/* Who's Out Tonight — standalone, seekable theater. No dependencies. */
(function (root) {
  'use strict';
  const W = 800;
  let H = 1000; // Uniform canvas units: portrait mobile stage; updated on resize.
  const C = { curtain:'#1f0810', velvet:'#34101a', velvetHi:'#461724', brass:'#f2c46a', cream:'#fff0db', muted:'#c9a7ae', teal:'#72e3cf', pink:'#ff86a8', coral:'#ff5b4d', blue:'#80cfff', ink:'#14040a' };
  // Add a maestro here; clip IDs are `${id}-${piece}-${kind}`.
  const MAESTROS = [
    { id:'beethoven', piece:'fur-elise', zh:'贝多芬', en:'Beethoven', pieceZh:'致爱丽丝', pieceEn:'Für Elise' },
    { id:'vivaldi', piece:'spring', zh:'维瓦尔第', en:'Vivaldi', pieceZh:'春', pieceEn:'Spring' }
  ];
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
    if(!['keyboard','pitch'].includes(raw.view)) fail('view');
    if(!['concert','wreck','accident'].includes(raw.kind)) fail('kind');
    if(!finite(raw.duration) || raw.duration<=0 || raw.duration>1800) fail('duration');
    if(!Array.isArray(raw.range) || raw.range.length!==2 || !raw.range.every(finite) || raw.range[0]>=raw.range[1] || raw.range[0]<0 || raw.range[1]>127) fail('range');
    if(typeof raw.audio!=='string' || !/^assets\/audio\/[a-zA-Z0-9_./-]+\.(mp3|wav|ogg)$/.test(raw.audio) || raw.audio.includes('..')) fail('local audio path');
    const rows = (name,check,optional=false) => {
      if(optional && raw[name]===undefined) return [];
      if(!Array.isArray(raw[name])) fail(name);
      return raw[name].map((r,i)=> { if(!r || !check(r)) fail(`${name}[${i}]`);return {...r}; }).sort((a,b)=>(a.t??0)-(b.t??0));
    };
    const timed = n => finite(n.t)&&n.t>=0&&n.t<=raw.duration&&finite(n.d)&&n.d>0;
    const notes=rows('notes',n=>timed(n)&&finite(n.p)&&n.p>=0&&n.p<=127&&finite(n.v)&&n.v>=0&&n.v<=1&&['rh','lh','solo','tutti','cat','bird'].includes(n.part)&&typeof n.ok==='boolean'&&(n.want===undefined||finite(n.want)));
    const targets=rows('targets',n=>timed(n)&&finite(n.p)&&n.p>=0&&n.p<=127,true).filter(n=>!n.part||n.part==='solo');
    const curves=rows('curves',c=>typeof c.part==='string'&&Array.isArray(c.pts)&&c.pts.length>0&&c.pts.every((p,i)=>Array.isArray(p)&&p.length===2&&p.every(finite)&&p[0]>=0&&p[0]<=raw.duration&&(i===0||p[0]>c.pts[i-1][0])),true).map(c=>({...c,pts:c.pts.map(p=>p.slice())}));
    const events=rows('events',e=>{
      if(!finite(e.t)||e.t<0||e.t>raw.duration+(e.type==='end'?.4:0)||(e.d!==undefined&&(!finite(e.d)||e.d<=0))) return false;
      switch(e.type) {
        case 'mistake':return ['wrong','stuck','slide','squeak','rush','drag','lost'].includes(e.kind)&&[1,2,3].includes(e.severity);
        case 'pause':return finite(e.d);
        case 'restart':case 'gasp':case 'cheer':return true;
        case 'laugh':return [1,2,3].includes(e.level);
        case 'accident':return /^(cat-(enter|step|sit|leave)|bird-(enter|sing|leave))$/.test(e.kind)&&
          (e.kind.endsWith('-leave')?(e.p===undefined||finite(e.p)&&e.p>=0&&e.p<=127)&&(e.d===undefined||finite(e.d)):finite(e.p)&&e.p>=0&&e.p<=127&&finite(e.d));
        case 'caption':return typeof e.zh==='string'&&typeof e.en==='string'&&finite(e.d)&&['narrator','performer'].includes(e.who);
        case 'end':return ['wreck','accident','bow'].includes(e.kind);
        default:return false;
      }
    });
    // Generators may omit the departure pitch/duration: inherit the last perch/key.
    for(let i=0;i<events.length;i++)if(events[i].type==='accident'&&events[i].kind.endsWith('-leave')) {
      const e=events[i],animal=e.kind.split('-')[0],prev=events.slice(0,i).filter(p=>p.type==='accident'&&p.kind.startsWith(`${animal}-`)).at(-1);
      e.p=e.p??prev?.p??raw.range[1];e.d=e.d??.65;
    }
    const cue={...raw,range:raw.range.slice(),notes,targets,curves,events};
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
    return cue;
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
      if(reaction?.kind==='wrong'&&t-reaction.t<.12){portrait.x=Math.sin((t-reaction.t)*150)*7;portrait.angle+=portrait.x*.5;}
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
    if(cue.kind==='accident') {
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
    return {t,motionTime,litKeys,activeNotes,density,portrait,caption,speech,subtitle,
      captionPlacement:caption?(caption.who==='performer'?'bubble':'subtitle'):null,
      reaction,reactionMark,speechSide,pause,end,effects,trace,loop,onomatopoeia,cat,bird,birdGlyphs,
      audience:effects.filter(e=>['laugh','gasp','cheer'].includes(e.type)),
      spotlight:end?.kind==='wreck'?.35:end?.kind==='bow'?1.4:pause?.6:1};
  }
  // Bounds include the animated scale and outline. Valance ends at canvas y=55.
  function popBox(x,y,width,size,scale=1,unit=1,height=1000) {
    const halfW=(width/2+3.5*unit)*scale,halfH=(size*.75+3.5*unit)*scale;
    return {x:clamp(x,W*.06+halfW,W*.94-halfW),y:clamp(y,55+halfH,height*.84-halfH),halfW,halfH};
  }
  const core={parseCue,computeState,keyboard,targetAt,popBox,MAESTROS};
  if(typeof module!=='undefined'&&module.exports)module.exports=core;
  root.TheaterCore=core;
  if(!root.document)return;

  const $=id=>root.document.getElementById(id), canvas=$('stage-canvas');
  const guestCanvas=$('guest-canvas'),guestCtx=guestCanvas.getContext('2d');
  let ctx=canvas.getContext('2d');
  if(!ctx)return;
  let cue=null, buffer=null, audio=null, source=null, playing=false, offset=0, anchor=0, rate=1, raf=0, request=0, playIntent=0;
  let lang='zh', selected='', mode='loading', lastState=null, audioProblem=false;
  let pixelUnit=800/351; // Canvas units per CSS pixel; set from measured stage width.
  const motion=root.matchMedia?.('(prefers-reduced-motion: reduce)');
  const tr=(zh,en)=>lang==='zh'?zh:en;
  const kinds=['concert','wreck','accident'];
  const kindName=k=>({concert:tr('完美演出','Flawless'),wreck:tr('低分车祸','Low-score flop'),accident:tr('高分意外','High-score accident')})[k];
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
  function noteColor(n) {return !n.ok?C.coral:n.part==='cat'?C.pink:n.part==='bird'?C.blue:n.part==='lh'?C.teal:C.brass;}
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
      rounded(key.x+.5,key.y+jolt,key.w-1,key.h,black?3:4);fill(n?noteColor(n):black?'#21121a':'#fff0db');
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
    if(!cue.targetsLegato) {   // bars run to the next written note (Trombone-Champ style), not the short sounding gate
      const solo=cue.targets.filter(n=>!n.part||n.part==='solo').slice().sort((a,b)=>a.t-b.t);
      solo.forEach((n,i)=>{const gap=i+1<solo.length?solo[i+1].t-n.t:n.d;n.vd=Math.min(1.4,Math.max(n.d,gap*.9));});
      cue.targetsLegato=true;
    }
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
    for(const e of cue.pops)for(const l of ['zh','en'])measured(e[l],(e.kind==='cat-tap'?16:26)*pixelUnit,true);
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
      const age=state.motionTime-e.t,q=clamp(age/e.d,0,1),small=e.kind==='cat-tap';
      let x=400,y=H*.52;
      if(e.kind.startsWith('cat')){x=small?pitchX(cue,e.p):state.cat.x;y=H*.68-(small?60:80)*pixelUnit;}
      if(e.kind.startsWith('bird')){x=state.bird.x;y=state.bird.y+48*pixelUnit;}
      if(e.kind==='squeak'){x=360;y=H*.52;}
      if(e.kind==='clunk'){x=pitchX(cue,e.p);y=H*.64;}
      const scale=motion?.matches||state.pause?1:1+Math.sin(q*Math.PI*3)*.12*(1-q);
      const size=(small?16:26)*pixelUnit,word=e[lang],box=popBox(x,y,measured(word,size,true),size,scale,pixelUnit,H);
      ctx.save();ctx.translate(box.x,box.y);ctx.scale(scale,scale);
      ctx.globalAlpha=q>.75?1-(q-.75)*4:1;
      ctx.font=`900 ${size}px system-ui`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.lineJoin='round';ctx.strokeStyle=C.ink;ctx.lineWidth=7*pixelUnit;ctx.strokeText(word,0,0);ctx.fillStyle=small?C.pink:C.cream;ctx.fillText(word,0,0);ctx.restore();
    }
  }
  const domCache=new WeakMap();
  function put(el,key,value,apply) {let m=domCache.get(el);if(!m)domCache.set(el,m=new Map());if(m.get(key)===value)return;m.set(key,value);apply(value);}
  const css=(el,prop,v)=>put(el,prop,v,x=>{el.style[prop]=x;});
  const txt=(el,v)=>put(el,'#text',v,x=>{el.textContent=x;});
  const hide=(el,v)=>put(el,'#hidden',v,x=>{el.hidden=x;});
  function render(time) {
    if(!cue)return null;
    const state=computeState(cue,time,{reducedMotion:motion?.matches,stageHeight:H});lastState=state;
    ctx.save();ctx.clearRect(0,0,W,H);background(state);if(cue.view==='keyboard')drawKeyboard(state);else drawPitch(state);
    drawCat(state.cat,state.motionTime);reactions(state);audience(state);onomatopoeia(state);ctx.restore();
    // A transparent guest surface sits above the portrait's stacking context.
    // Only the small sprite, notes and word are drawn here; no backdrop repaint.
    const mainCtx=ctx;ctx=guestCtx;
    try {ctx.save();ctx.clearRect(0,0,W,H);drawBird(state.bird,state.motionTime);birdMusic(state);onomatopoeia(state,true);ctx.restore();}
    finally {ctx=mainCtx;}
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
    css($('speech'),'fontSize',reactionSpeech?(r.type==='pause'?'26px':'23px'):'16px');
    if(state.speech||reactionSpeech)txt($('speech-text'),reactionSpeech||state.speech[lang]);
    css($('speech'),'width',reactionSpeech?'145px':'190px');
    const speechWidth=reactionSpeech?145:190,stageWidth=W/pixelUnit;
    const side=state.speechSide==='left'?-1:state.speechSide==='right'?1:0;
    const bubbleX=side*(stageWidth*.44-speechWidth/2);
    css($('speech'),'top',side?'65%':'94%');
    put($('speech'),'side',state.speechSide,v=>{$('speech').dataset.side=v;});
    css($('speech'),'transform',`translateX(-50%) translate(${(bubbleX+p.x).toFixed(1)}px,${p.y.toFixed(1)}px)`);
    const stamp=$('stamp');hide(stamp,!state.end);
    if(state.end){
      const q=motion?.matches?1:ease(clamp((state.t-state.end.t)/.3,0,1));
      put(stamp,'class',state.end.kind,()=>{stamp.className=`stamp${state.end.kind==='bow'?' bow':''}`;});
      txt(stamp,state.end.kind==='bow'?'Bravo!':state.end.kind==='wreck'?tr('车祸现场','TRAIN WRECK'):tr('意外事故','ACCIDENT'));
      css(stamp,'transform',`translate(-50%,-50%) rotate(${(-9+(1-q)*24).toFixed(2)}deg) scale(${(1+(1-q)*.55).toFixed(3)})`);
    }
    const tenth=Math.floor(state.t*10)/10;   // the seek bar and clock only need ~10 updates a second
    const seek=$('seek'),sv=String(tenth);
    if(seek.value!==sv){seek.value=sv;seek.setAttribute('aria-valuetext',`${tenth.toFixed(1)} / ${cue.duration.toFixed(1)} ${tr('秒','seconds')}`);}
    txt($('time'),`${clockText(state.t)} / ${clockText(cue.duration)}`);
    return state;
  }
  function clockText(t){return `${Math.floor(t/60)}:${String(Math.floor(t%60)).padStart(2,'0')}`;}
  function resize() {
    const rect=canvas.getBoundingClientRect(),dpr=Math.min(root.devicePixelRatio||1,dprCap)*quality,width=Math.max(1,Math.round(rect.width*dpr)),height=Math.max(1,Math.round(rect.height*dpr));
    H=W*rect.height/Math.max(1,rect.width);pixelUnit=W/Math.max(1,rect.width);
    if(canvas.width!==width||canvas.height!==height){canvas.width=width;canvas.height=height;ctx.setTransform(width/W,0,0,height/H,0,0);}
    if(guestCanvas.width!==width||guestCanvas.height!==height){guestCanvas.width=width;guestCanvas.height=height;guestCtx.setTransform(width/W,0,0,height/H,0,0);}
    if(cue){warmText();render(lastState?.t??offset);}
  }
  function context() {
    if(!audio){const Audio=root.AudioContext||root.webkitAudioContext;if(!Audio)throw new Error('Web Audio is unavailable');audio=new Audio();}
    return audio;
  }
  const nowMs=()=>root.performance&&root.performance.now?root.performance.now():Date.now();
  let perfAnchor=0,smooth=0;
  function audioTime() {return offset+(audio.currentTime-anchor)*rate;}
  function currentTime() {
    if(!cue)return 0;if(!playing)return clamp(offset,0,cue.duration);
    // Web Audio's clock advances in coarse steps on some browsers; animate from performance.now and
    // pull gently toward the audio clock so visuals never drift from the sound.
    const est=offset+(nowMs()-perfAnchor)/1000*rate,drift=audioTime()-est;
    if(Math.abs(drift)>.08)perfAnchor-=drift*1000/rate;else perfAnchor-=drift*100/rate;
    smooth=offset+(nowMs()-perfAnchor)/1000*rate;
    return clamp(smooth,0,cue.duration);
  }
  function stopSource(){if(source){source.onended=null;try{source.stop();}catch(_){}source.disconnect();source=null;}}
  function updatePlay(){ $('play').textContent=playing?'Ⅱ':'▶';$('play').setAttribute('aria-label',playing?tr('暂停','Pause'):tr('播放','Play')); }
  function writeHash(){if(cue&&root.history?.replaceState)root.history.replaceState(null,'',`#clip=${encodeURIComponent(selected)}&t=${(lastState?.t??offset).toFixed(3)}`);}
  function pause() {
    playIntent++;offset=currentTime();playing=false;stopSource();root.cancelAnimationFrame(raf);raf=0;updatePlay();if(cue){render(offset);writeHash();}return offset;
  }
  function startSource() {
    stopSource();anchor=audio.currentTime;perfAnchor=nowMs();
    if(buffer&&offset<buffer.duration){source=audio.createBufferSource();source.buffer=buffer;source.playbackRate.value=rate;source.connect(audio.destination);source.start(0,offset);}
  }
  let dprCap=2,frameAvg=16,lastFrame=0,slowFrames=0,quality=1,lastDraw=0;
  const frameLog=[];   // [wall ms, clip t] of the last frames drawn, for diagnosing judder
  function tick() {
    if(!playing)return;
    const now=nowMs();
    lastDraw=now;if(lastFrame){frameAvg=frameAvg*.9+(now-lastFrame)*.1;slowFrames=frameAvg>26?slowFrames+1:0;}lastFrame=now;
    if(slowFrames>45&&dprCap>1){dprCap=dprCap>1.5?1.5:1;slowFrames=0;resize();}
    const t=currentTime();render(t);frameLog.push([now,t]);if(frameLog.length>240)frameLog.shift();
    if(t>=cue.duration){pause();return;}raf=root.requestAnimationFrame(tick);
  }
  async function play() {
    if(!cue||mode==='loading')return;
    if(playing)return;
    const generation=request,intent=++playIntent,ac=context();await ac.resume();if(generation!==request||intent!==playIntent||mode==='loading'||playing)return;
    if(offset>=cue.duration)offset=0;playing=true;lastFrame=0;startSource();updatePlay();tick();
  }
  function seek(time) {
    if(!cue)return null;const running=playing;offset=clamp(finite(time)?time:0,0,cue.duration);
    if(running)startSource();const state=render(offset);writeHash();return state;
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
  async function load(clipId) {
    if(typeof clipId!=='string'||!/^[-a-z0-9]+$/.test(clipId))throw new Error('Invalid clip ID');
    pause();const token=++request;selected=clipId;mode='loading';cue=null;buffer=null;lastState=null;offset=0;audioProblem=false;
    $('play').disabled=true;updateCopy();
    async function fetchCue(id){const res=await root.fetch(`assets/cues/${id}.json`);if(!res.ok){const e=new Error(`Cue HTTP ${res.status}`);e.status=res.status;throw e;}return parseCue(await res.json());}
    try {
      let next;
      next=await fetchCue(clipId);
      if(next.id!==clipId&&next.id!==`mock-${clipId}`)throw new Error('Cue ID does not match requested clip');
      if(token!==request)return null;
      cue=next;mode=cue.id.startsWith('mock-')?'mock':'real';
      // Render immediately; audio fetching/decoding must not delay screenshot frames.
      setupCue();render(0);resize();updateCopy();
      try {
        const ac=context();let decoded;
        if(mode==='mock')decoded=synthMock(cue,ac);
        else{const res=await root.fetch(cue.audio);if(!res.ok)throw new Error(`Audio HTTP ${res.status}`);decoded=await ac.decodeAudioData(await res.arrayBuffer());}
        if(token!==request)return null;buffer=decoded;
        if(mode==='real'&&Math.abs(buffer.duration-cue.duration)>.15)audioProblem='duration';
      }catch(err){if(token!==request)return null;audioProblem=true;}
      if(token!==request)return null;
      $('play').disabled=false;updateCopy();return cue;
    } catch(err) {
      if(token!==request)return null;mode='error';cue=null;updateCopy();$('status').textContent=tr('无法加载演出：','Unable to load performance: ')+err.message;throw err;
    }
  }
  function setupCue() {
    $('seek').max=String(cue.duration);$('portrait-img').src=`assets/portraits/${cue.musician}.webp`;
    warmText();
    const ticks=$('ticks');ticks.replaceChildren();
    for(const e of cue.events)if(e.type!=='caption') {const i=root.document.createElement('i');i.className=e.type;i.style.left=`${e.t/cue.duration*100}%`;ticks.appendChild(i);}
  }
  function makeCards() {
    const container=$('maestros'),choices=$('choices');container.replaceChildren();choices.replaceChildren();
    const current=MAESTROS.find(m=>selected.replace(/^mock-/,'').startsWith(m.id))||MAESTROS[0];
    const kind=kinds.find(k=>selected.endsWith(`-${k}`))||'accident';
    async function select(id) {
      try{await context().resume();const c=await load(id);if(c){writeHash();await play();}}catch(err){showPlaybackError(err);}
    }
    for(const m of MAESTROS) {
      const chip=root.document.createElement('button');chip.className='maestro';
      const img=root.document.createElement('img');img.src=`assets/portraits/${m.id}-thumb.webp`;img.alt='';
      const name=root.document.createElement('span');name.textContent=m[lang];chip.append(img,name);
      chip.setAttribute('aria-pressed',String(m.id===current.id));
      chip.addEventListener('click',()=>select(`${m.id}-${m.piece}-${kind}`));container.appendChild(chip);
    }
    for(const k of kinds) {
      const id=`${current.id}-${current.piece}-${k}`,button=root.document.createElement('button');button.textContent=kindName(k);button.setAttribute('aria-pressed',String(kind===k));button.dataset.clip=id;
      button.addEventListener('click',()=>select(id));choices.appendChild(button);
    }
  }
  function updateCopy() {
    root.document.documentElement.lang=lang==='zh'?'zh-CN':'en';root.document.title=tr('翻车剧场','Flop Theater');$('title').textContent=tr('翻车剧场','Flop Theater');
    $('lang-zh').setAttribute('aria-pressed',String(lang==='zh'));$('lang-en').setAttribute('aria-pressed',String(lang==='en'));makeCards();
    $('maestros').setAttribute('aria-label',tr('选择演出','Choose a performance'));$('stage').setAttribute('aria-label',tr('演出舞台','Performance stage'));$('seek').setAttribute('aria-label',tr('演出进度','Performance position'));
    txt($('loop-label'),tr('原地打转','STUCK ON REPEAT'));
    $('legend-rh').textContent=tr('旋律','Melody');$('legend-lh').textContent=tr('左手 / 准音','Bass / in tune');$('legend-wrong').textContent=tr('错音','Wrong notes');$('legend-guest').textContent=tr('不速之客','Unexpected guest');
    const m=MAESTROS.find(m=>m.id===cue?.musician);
    if(cue){$('now-playing').textContent=`${m?m[lang]:cue.musician} · ${m?(lang==='zh'?m.pieceZh:m.pieceEn):cue.piece} · ${kindName(cue.kind)}`;$('portrait-img').alt=m?m[lang]:cue.musician;}
    $('ticket').textContent=mode==='mock'?tr('模拟演出','MOCK PREVIEW'):mode==='real'?tr('现场','ON STAGE'):'PREVIEW';
    $('status').textContent=mode==='loading'?tr('正在布置舞台…','Setting the stage…'):mode==='mock'?tr('模拟 cue · 本地合成音频 · 真实片段就绪后自动替换','Mock cues · synthesized preview audio · real clips take priority'):tr('音频与 cue 同步 · 拖动进度可逐帧审阅','Audio + cues in sync · scrub to review any frame');
    if(audioProblem)$('status').textContent=audioProblem==='duration'?tr('音频与 cue 时长不同，请核对片段；画面按 cue 时长播放','Audio / cue duration differs; timeline follows the cue'):tr('音频尚未就绪 · 可继续无声预览画面','Audio unavailable · visual preview is still available');
    $('status').hidden=mode==='real'&&!audioProblem;
    updatePlay();if(cue)render(lastState?.t??offset);
  }
  function showPlaybackError(err){$('status').hidden=false;$('status').textContent=tr('播放失败：','Playback failed: ')+err.message;}
  $('play').addEventListener('click',()=>playing?pause():play().catch(showPlaybackError));
  $('seek').addEventListener('input',()=>seek(Number($('seek').value)));
  for(const l of ['zh','en'])$(`lang-${l}`).addEventListener('click',()=>{lang=l;updateCopy();});
  root.addEventListener('resize',resize);motion?.addEventListener?.('change',()=>render(currentTime()));
  if(root.ResizeObserver)new root.ResizeObserver(resize).observe(canvas);
  root.document.fonts?.ready.then(()=>{textWidths.clear();warmText();if(cue)render(currentTime());});
  root.theater={load,play,pause,seek,render,frames:()=>frameLog.slice()};
  async function fromHash() {
    const params=new URLSearchParams(root.location.hash.slice(1)),id=params.get('clip')||'beethoven-fur-elise-accident';
    try{const c=await load(id);if(c){const t=Number(params.get('t')||0);seek(finite(t)?t:0);}}catch(_){/* load reports the concrete error in the status line */}
  }
  root.addEventListener('hashchange',fromHash);resize();fromHash();
})(typeof window!=='undefined'?window:globalThis);
