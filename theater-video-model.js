/* Deterministic video geometry and capability decisions, usable without a DOM. */
(function(root){
'use strict';
// H.264 first: what phones, WeChat and short-video apps play everywhere (AAC > Opus audio); plain video/mp4 is H.264/AAC on Safari
const mimes=['video/mp4;codecs=avc1.42E01E,mp4a.40.2','video/mp4;codecs=avc1,mp4a.40.2','video/mp4;codecs=avc1,opus','video/mp4','video/webm;codecs=h264,opus','video/webm;codecs=vp9,opus','video/webm;codecs=vp8,opus','video/webm'];
function selectMime(supported){return mimes.find(m=>supported(m))||null;}
function capability({ua='',capture=false,recorder=false,mime=null,audio=true}){return !/MicroMessenger/i.test(ua)&&capture&&recorder&&audio&&!!mime;}
function wrap(s,size,width,measure){const lines=[];let line='';for(const word of String(s).split(/(\s+|(?=[\u2e80-\u9fff])|(?<=[\u2e80-\u9fff]))/u).filter(Boolean)){if(measure(word,size)>width){for(const ch of word){if(line&&measure(line+ch,size)>width){lines.push(line.trim());line='';}line+=ch;}}else if(line&&measure(line+word,size)>width){lines.push(line.trim());line=word.trimStart();}else line+=word;}if(line.trim())lines.push(line.trim());return lines;}
function fit(text,box,size,measure){let lines;for(;size>=4;size--){lines=wrap(text,size,box.w,measure);if(lines.length*size*1.25<=box.h)break;}return {...box,size,lines,lineHeight:size*1.25};}
function layout({title,clip,caption='',credit='',url='zeyuniverse.github.io/tonight-out'},measure){return {width:720,height:1280,stage:{x:0,y:224,w:720,h:900},title:fit(title,{x:36,y:30,w:648,h:72},46,measure),clip:fit(clip,{x:36,y:112,w:648,h:96},32,measure),caption:fit(caption,{x:36,y:964,w:648,h:140},38,measure),url:fit(url,{x:36,y:1148,w:648,h:30},20,measure),credit:fit(credit,{x:36,y:1192,w:648,h:68},12,measure)};}
const api={mimes,selectMime,capability,wrap,fit,layout};root.TheaterVideoModel=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
