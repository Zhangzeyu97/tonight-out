/* Shared theater and game repertoire. */
(function(root){
const MAESTROS=[
 ['beethoven','贝多芬','Beethoven',[['fur-elise','致爱丽丝','Für Elise','钢琴','Piano'],['symphony5','命运','Symphony No. 5','管弦乐','Orchestra']]],
 ['mozart','莫扎特','Mozart',[['turca','土耳其进行曲','Rondo alla Turca','钢琴','Piano'],['nachtmusik','小夜曲','Eine kleine Nachtmusik','弦乐','Strings']]],
 ['bach','巴赫','Bach',[['toccata','托卡塔与赋格','Toccata and Fugue','管风琴','Organ'],['prelude-c','C大调前奏曲','Prelude in C','羽管键琴','Harpsichord']]],
 ['chopin','肖邦','Chopin',[['nocturne','夜曲','Nocturne','钢琴','Piano'],['minute-waltz','小狗圆舞曲','Minute Waltz','钢琴','Piano']]],
 ['vivaldi','维瓦尔第','Vivaldi',[['spring','春','Spring','小提琴','Violin'],['winter','冬','Winter','小提琴','Violin']]],
 ['tchaikovsky','柴可夫斯基','Tchaikovsky',[['swan-lake','天鹅湖','Swan Lake','双簧管','Oboe'],['sugar-plum','糖果仙子之舞','Sugar Plum Fairy','钢片琴','Celesta']]]
].map(([id,zh,en,pieces])=>({id,zh,en,piece:pieces[0][0],pieceZh:pieces[0][1],pieceEn:pieces[0][2],pieces:pieces.map(([id,zh,en,instrumentZh,instrumentEn])=>({id,zh,en,instrument:{zh:instrumentZh,en:instrumentEn}}))}));
root.Maestros=MAESTROS;if(typeof module!=='undefined')module.exports=MAESTROS;
})(typeof window!=='undefined'?window:globalThis);
