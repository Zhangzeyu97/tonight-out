/* One reusable real-time recorder for every theater host. No DOM capture. */
(function(root){
'use strict';
const M=root.TheaterVideoModel;
let active=null;
function support(){const mime=root.MediaRecorder?.isTypeSupported?M.selectMime(m=>root.MediaRecorder.isTypeSupported(m)):null;return {mime,ok:M.capability({ua:root.navigator?.userAgent||'',capture:!!root.HTMLCanvasElement?.prototype.captureStream,recorder:!!root.MediaRecorder,mime,audio:!!(root.AudioContext||root.webkitAudioContext)?.prototype.createMediaStreamDestination})};}
function attach(container,stage,{onAudio=()=>{}}={}){const button=root.document.createElement('button');button.type='button';button.className='tv-save';container.appendChild(button);const update=()=>{const cap=support();button.textContent=stage.lang==='zh'?(cap.ok?'存成视频':'在浏览器中打开即可保存视频'):(cap.ok?'Save video':'Open in a browser to save the video');button.disabled=!cap.ok||!stage.cue||stage.audioProblem===true;};button.addEventListener('click',e=>{e.stopPropagation();save(stage,{onAudio}).catch(()=>{});});const off=stage.on('load',update);update();return {update,destroy(){off();if(active?.owner===stage)active.close();button.remove();}};}
async function save(owner,{onAudio=()=>{}}={}){if(active||!owner.cue||!support().ok)return;
 const clipId=owner.cue.id,lang=owner.lang,tr=(zh,en)=>lang==='zh'?zh:en,doc=root.document,opener=doc.activeElement;
 owner.pause();
 const back=doc.createElement('div');back.className='tv-back';back.innerHTML='<section class="tv-dialog" role="dialog" aria-modal="true"><canvas width="720" height="1280" aria-hidden="true"></canvas><p role="status" aria-live="polite"></p><button type="button"></button></section>';
 const dialog=back.querySelector('section'),canvas=back.querySelector('canvas'),status=back.querySelector('p'),action=back.querySelector('button');dialog.setAttribute('aria-label',tr('存成视频','Save video'));action.textContent=tr('取消','Cancel');status.textContent=tr('准备中…','Preparing…');if(root.GameFrame)root.GameFrame.append(back);else doc.body.appendChild(back);action.focus();
 const hidden=doc.createElement('div');hidden.style.cssText='position:fixed;left:-10000px;top:-10000px;width:720px;height:900px;pointer-events:none';hidden.setAttribute('aria-hidden','true');doc.body.appendChild(hidden);
 let release=null,rig,recorder,stream,src,dest,raf=0,cancelled=false,closed=false,file=null,recording=true,audioActive=false;
 const setAudio=value=>{if(audioActive!==value){audioActive=value;onAudio(value);}};
 const stop=()=>{setAudio(false);root.cancelAnimationFrame(raf);try{src?.stop();}catch(_){}src?.disconnect();dest?.disconnect();stream?.getTracks().forEach(t=>t.stop());};
 const close=()=>{if(closed)return;closed=true;cancelled=true;if(recorder?.state==='recording')recorder.stop();stop();rig?.destroy();hidden.remove();release?.();back.remove();doc.removeEventListener('keydown',key,true);doc.removeEventListener('visibilitychange',visibility);root.removeEventListener('pagehide',close);if(active?.owner===owner)active=null;if(opener?.isConnected)opener.focus({preventScroll:true});};
 const key=e=>{if(root.GameDialogs)return;if(e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();close();}else if(e.key==='Tab'){e.preventDefault();e.stopImmediatePropagation();action.focus();}};
 const visibility=()=>{if(doc.hidden&&recording)close();};doc.addEventListener('keydown',key,true);doc.addEventListener('visibilitychange',visibility);root.addEventListener('pagehide',close);active={owner,close};if(root.GameDialogs)release=root.GameDialogs.enter(back,close,action);
 const download=()=>{const url=root.URL.createObjectURL(file),a=doc.createElement('a');a.href=url;a.download=file.name;doc.body.appendChild(a);a.click();a.remove();root.setTimeout(()=>root.URL.revokeObjectURL(url),60000);};
 action.addEventListener('click',async()=>{if(!file){close();return;}try{if((/Android|iPhone|iPad|Mobile/i.test(root.navigator.userAgent||'')||root.matchMedia?.('(pointer: coarse)').matches)&&root.navigator.canShare?.({files:[file]})&&root.navigator.share){await root.navigator.share({files:[file]});}else download();close();}catch(e){if(e.name==='AbortError')return;download();close();}});
 try{
  const {context:ac,buffer,muted}=owner.audioData();if(!buffer)throw new Error('Audio unavailable');await ac.resume();if(cancelled)return;
  rig=root.TheaterStage.mount(hidden,{lang,dprCap:1,fixedSize:{width:720,height:900},audio:{context:()=>ac,load:async()=>buffer}});
  await rig.load(clipId);if(cancelled)return;
  const img=rig.nodes['portrait-img'];if(img.decode)await img.decode();if(cancelled)return;
  await doc.fonts?.ready;if(cancelled)return;
  const ctx=canvas.getContext('2d');rig.compose(ctx,0);
  stream=canvas.captureStream(30);dest=ac.createMediaStreamDestination();for(const track of dest.stream.getAudioTracks())stream.addTrack(track);
  const mime=support().mime;recorder=new root.MediaRecorder(stream,{mimeType:mime,videoBitsPerSecond:4000000,audioBitsPerSecond:128000});const chunks=[];
  recorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data);};
  recorder.onerror=()=>{recording=false;stop();status.textContent=tr('录制失败，请重试','Recording failed. Try again.');action.textContent=tr('关闭','Close');};
  recorder.onstop=()=>{if(cancelled||!recording)return;recording=false;stop();const type=recorder.mimeType||mime,ext=type.includes('mp4')?'mp4':'webm';file=new root.File(chunks,`tonight-out-${clipId}.${ext}`,{type});status.textContent=tr('视频已就绪','Video ready');action.textContent=tr('存成视频','Save video');rig.destroy();rig=null;hidden.remove();};
  src=ac.createBufferSource();src.buffer=buffer;src.connect(dest);if(!muted)src.connect(ac.destination);
  // Schedule one origin for the full audio buffer and the canvas clock.
  let start=0,last=-Infinity,progress=-1;const duration=Math.max(rig.cue.duration,buffer.duration);
  recorder.onstart=()=>{if(cancelled)return;start=ac.currentTime+.06;setAudio(true);src.start(start);
   const frame=now=>{if(cancelled||!recording)return;const t=Math.max(0,Math.min(duration,ac.currentTime-start));if(t>=duration||now-last>=1000/30-1){last=now;rig.compose(ctx,t);const seconds=Math.floor(t);if(seconds!==progress){progress=seconds;status.textContent=tr(`录制中 ${seconds}/${Math.ceil(duration)} 秒`,`Recording ${seconds}/${Math.ceil(duration)} s`);}}if(t>=duration){recorder.stop();return;}raf=root.requestAnimationFrame(frame);};raf=root.requestAnimationFrame(frame);
  };recorder.start(250);
 }catch(_){if(cancelled)return;recording=false;stop();status.textContent=tr('录制失败，请重试','Recording failed. Try again.');action.textContent=tr('关闭','Close');}
}
const style=root.document.createElement('style');style.textContent='.tv-save{border:1px solid #f2c46a66;border-radius:9px;background:#34101a;color:#fff0db;font:600 13px/1.3 system-ui;padding:9px 12px;cursor:pointer;margin:6px 0}.tv-save:disabled{font-size:11px;opacity:.65;cursor:default}.tv-back{position:fixed;inset:0;z-index:100;background:#14040af5;display:grid;place-items:center;padding:12px}.tv-dialog{display:grid;justify-items:center;gap:9px;width:min(400px,100%);color:#fff0db;font:14px/1.4 system-ui}.tv-dialog canvas{display:block;width:auto;height:auto;max-width:100%;max-height:calc(100dvh - 135px);aspect-ratio:9/16;border:1px solid #f2c46a66;border-radius:8px}.tv-dialog p{margin:0}.tv-dialog button{padding:10px 22px;border:0;border-radius:9px;background:#f2c46a;color:#1f0810;font:700 14px/1.2 system-ui;cursor:pointer}';root.document.head.appendChild(style);
root.TheaterVideo={attach,save,support};
})(window);
