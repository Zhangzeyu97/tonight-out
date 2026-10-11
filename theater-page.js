/* Standalone theater chrome; the stage is also mounted by the game. */
(function(root){
'use strict';
const $=id=>root.document.getElementById(id),MAESTROS=root.Maestros;
const stage=root.TheaterStage.mount($('theater-stage'));
const video=root.TheaterVideo.attach($('video-tools'),stage);
let lang='zh',clipIndex=[],mockMode=false,selected='',mode='loading',generation=0;
const tr=(zh,en)=>lang==='zh'?zh:en;
const kindName=k=>({concert:tr('完美演出','Flawless'),wreck:tr('低分车祸','Low-score flop'),accident:tr('高分意外','High-score accident'),full:tr('完整演出','Full performance')})[k];
const clock=t=>`${Math.floor(t/60)}:${String(Math.floor(t%60)).padStart(2,'0')}`;
function time(t){const c=stage.cue;if(!c)return;$('seek').value=String(Math.floor(t*10)/10);$('seek').setAttribute('aria-valuetext',`${t.toFixed(1)} / ${c.duration.toFixed(1)} ${tr('秒','seconds')}`);$('time').textContent=`${clock(t)} / ${clock(c.duration)}`;}
function updatePlay(){$('play').textContent=stage.playing?'Ⅱ':'▶';$('play').setAttribute('aria-label',stage.playing?tr('暂停','Pause'):tr('播放','Play'));}
function writeHash(){if(stage.cue)root.history?.replaceState(null,'',`#clip=${encodeURIComponent(selected)}&t=${stage.time.toFixed(3)}${mockMode?'&mock=1':''}&lang=${lang}`);}
function status(text){$('status').textContent=text;$('status').hidden=!text;}
function credit(){const el=$('credits'),c=stage.credit();el.replaceChildren();el.hidden=!c;if(!c)return;
 const score=String(c.score||''),label=score.includes('Mutopia')?'Mutopia':score||c.typesetter||c.composer||'';const lic=(s)=>/public domain/i.test(s)?tr('公有领域','Public Domain'):/Attribution-ShareAlike|BY-SA/i.test(s)?'CC BY-SA '+((s.match(/\d\.\d/)||['3.0'])[0]):/Attribution/i.test(s)?'CC BY '+((s.match(/\d\.\d/)||['4.0'])[0]):s;
 el.append(root.document.createTextNode((c.line?tr(c.line.zh,c.line.en):tr('乐谱 ','Score ')+label)+' · '));const link=root.document.createElement('a');link.textContent=lic(c.score_license||'');
 if(/^https?:\/\//.test(c.score_license_url||'')){link.href=c.score_license_url;link.target='_blank';link.rel='noopener';}el.append(link);el.title=[c.composer,c.work,c.typesetter,c.audio_license].filter(Boolean).join(' · ');
}
function makeCards(){const container=$('maestros'),pieces=$('pieces'),choices=$('choices');container.replaceChildren();pieces.replaceChildren();choices.replaceChildren();
 const current=MAESTROS.find(m=>m.id===stage.cue?.musician)||MAESTROS.find(m=>selected.replace(/^mock-/,'').startsWith(m.id+'-'))||MAESTROS[0];
 const piece=current.pieces.find(p=>p.id===stage.cue?.piece)||current.pieces.find(p=>selected.includes(`-${p.id}-`))||current.pieces[0];
 const kind=['concert','wreck','accident','full'].find(k=>selected.endsWith(`-${k}`))||'accident';
 const available=(m,p,k)=>clipIndex.filter(c=>c.musician===m&&(!p||c.piece===p)&&(!k||c.kind===k));
 const disabled=(b,name)=>{b.disabled=true;b.title=tr('即将上演','Coming soon');const small=root.document.createElement('small');small.textContent=b.title;b.append(small);b.setAttribute('aria-label',name+' · '+b.title);};
 async function select(rows){const c=rows.find(c=>c.kind===kind)||rows.find(c=>c.kind==='accident')||rows[0];if(!c)return;try{if(await load(c.id)){writeHash();await play();}}catch(_){}}
 for(const m of MAESTROS){const b=root.document.createElement('button');b.className='maestro';const img=root.document.createElement('img');img.src=`assets/portraits/${m.id}.webp`;img.alt='';const label=root.document.createElement('span');label.textContent=m[lang];b.append(img,label);b.setAttribute('aria-pressed',String(m.id===current.id));if(!available(m.id).length)disabled(b,m[lang]);b.addEventListener('click',()=>select(available(m.id,m.pieces.find(p=>available(m.id,p.id).length)?.id)));container.appendChild(b);}
 for(const p of current.pieces){const b=root.document.createElement('button'),label=root.document.createElement('span');label.textContent=p[lang];b.append(label);b.setAttribute('aria-pressed',String(p.id===piece.id));const rows=available(current.id,p.id);if(!rows.length)disabled(b,p[lang]);b.addEventListener('click',()=>select(rows));pieces.appendChild(b);}
 for(const k of ['concert','wreck','accident']){const rows=available(current.id,piece.id,k),b=root.document.createElement('button'),label=root.document.createElement('span');label.textContent=kindName(k);b.append(label);b.setAttribute('aria-pressed',String(kind===k));b.dataset.clip=rows[0]?.id||'';if(!rows.length)disabled(b,kindName(k));b.addEventListener('click',()=>select(rows));choices.appendChild(b);}
}
function copy(){root.document.documentElement.lang=lang==='zh'?'zh-CN':'en';root.document.title=tr('翻车剧场','Flop Theater');$('title').textContent=root.document.title;
 for(const l of ['zh','en'])$('lang-'+l).setAttribute('aria-pressed',String(l===lang));
 $('legend-rh').textContent=tr('旋律','Melody');$('legend-lh').textContent=tr('左手 / 准音','Bass / in tune');$('legend-wrong').textContent=tr('错音','Wrong notes');$('legend-guest').textContent=tr('不速之客','Unexpected guest');
 stage.setLang(lang);video.update();makeCards();credit();time(stage.time);updatePlay();
}
async function load(id,opts={}){selected=id;mockMode=opts.mock??id.startsWith('mock-');mode='loading';$('play').disabled=true;status(tr('正在布置舞台…','Setting the stage…'));makeCards();try{const c=await stage.load(id,opts);if(!c)return null;mode='ready';$('play').disabled=false;$('seek').max=String(c.duration);$('ticks').replaceChildren();for(const e of c.events)if(e.type!=='caption'){const tick=root.document.createElement('i');tick.className=e.type;tick.style.left=`${e.t/c.duration*100}%`;$('ticks').appendChild(tick);}status(stage.audioProblem?tr('音频尚未就绪','Audio coming soon'):'');copy();return c;}catch(err){mode='error';status(tr('演出暂不可用','Performance unavailable'));throw err;}}
async function play(from){await stage.play(from);updatePlay();}
function pause(){const t=stage.pause();time(t);writeHash();updatePlay();return t;}
function seek(t){const s=stage.seek(t);time(stage.time);writeHash();return s;}
function render(t){const s=stage.render(t);time(t);return s;}
root.theater={load,play,pause,seek,render,frames:stage.frames,stage};
stage.on('time',time);stage.on('end',()=>{writeHash();updatePlay();});stage.on('pause',updatePlay);
$('play').addEventListener('click',()=>{if(stage.playing)pause();else play().catch(()=>status(tr('播放失败，请重试','Playback failed. Try again.')));});
$('seek').addEventListener('input',()=>seek(Number($('seek').value)));
for(const l of ['zh','en'])$('lang-'+l).addEventListener('click',()=>{lang=l;copy();writeHash();});
async function fromHash(){const token=++generation,params=new URLSearchParams(root.location.hash.slice(1));mockMode=params.get('mock')==='1'||(params.get('clip')||'').startsWith('mock-');lang=params.get('lang')==='en'?'en':params.get('lang')==='zh'?'zh':lang;
 try{const r=await root.fetch(`assets/cues/${mockMode?'mock-index':'index'}.json`);clipIndex=r.ok?(await r.json()).clips||[]:[];}catch(_){clipIndex=[];}if(token!==generation)return;
 let id=params.get('clip');if(mockMode&&id&&!id.startsWith('mock-'))id='mock-'+id;id=id||clipIndex.find(c=>c.kind==='accident')?.id||clipIndex[0]?.id;
 copy();if(!id){status(tr('即将上演','Coming soon'));return;}try{if(await load(id,{mock:mockMode})){const t=Number(params.get('t')||0);seek(Number.isFinite(t)?t:0);}}catch(_){}
}
root.addEventListener('hashchange',fromHash);root.addEventListener('pagehide',()=>stage.pause());root.document.addEventListener?.('visibilitychange',()=>{if(root.document.hidden)pause();});fromHash();
})(window);
