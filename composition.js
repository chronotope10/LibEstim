import {parseCatalog,NDC_NAMES} from './core.js';
import {RATIOS,standardBooks,composition,deduplicate} from './composition-core.js';
const $=id=>document.getElementById(id), fmt=n=>n.toLocaleString('ja-JP');
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const key=school=>'libestim.composition.v1:'+school;
let books=[], raw=[], generation=0;
const labels={elementary:'小学校',junior:'中学校',high:'高等学校'};
function restore(){
  $('schoolType').value=''; $('classCount').value='';
  try {
    const settings=JSON.parse(localStorage.getItem(key($('compositionSchool').value)) || 'null');
    if(settings && Object.hasOwn(RATIOS,settings.type) && Number.isSafeInteger(settings.classes) && settings.classes>0){$('schoolType').value=settings.type;$('classCount').value=settings.classes;}
    $('saveStatus').textContent='校種と学級数は学校ごとにこのブラウザへ保存します。蔵書データは保存しません。';
  }catch{$('saveStatus').textContent='保存設定を読み込めませんでした。今回は入力して利用できます。';}
}
function schoolBooks(){return books.filter(b=>b.school===$('compositionSchool').value);}
function filters(){
  const types=[...new Set(schoolBooks().map(b=>b.type))].sort((a,b)=>a.localeCompare(b,'ja'));
  $('typeFilter').hidden=!types.some(Boolean);
  $('typeChoices').replaceChildren(...types.map(type=>{
    const label=document.createElement('label'),input=document.createElement('input');input.type='checkbox';input.value=type;input.checked=true;
    label.append(input,document.createTextNode(type||'種別未設定'));return label;
  }));
}
async function load(files){
  const token=++generation;
  books=[];raw=[];$('compositionResults').hidden=true;$('compositionEmpty').hidden=false;$('compositionSchool').disabled=true;
  $('loadStatus').textContent='読み込み中…';
  try{
    const parsed=[];
    for(const file of files){
      if(!/\.(csv|tsv)$/i.test(file.name))throw new Error('CSVまたはTSVファイルを選んでください。');
      const bytes=await file.arrayBuffer();let text;
      try{text=new TextDecoder('utf-8',{fatal:true}).decode(bytes);}catch{text=new TextDecoder('shift_jis',{fatal:true}).decode(bytes);}
      parsed.push(...parseCatalog(text,file.name));
    }
    if(token!==generation)return;
    if(!parsed.length)throw new Error('資料の行がありません。');
    raw=parsed;books=deduplicate(raw).books;
    const schools=[...new Set(books.map(b=>b.school))].sort((a,b)=>a.localeCompare(b,'ja'));
    $('compositionSchool').replaceChildren(...schools.map(s=>new Option(s,s)));$('compositionSchool').disabled=false;
    $('loadStatus').textContent=`${files.map(f=>f.name).join('、')} ｜ ${fmt(books.length)}冊を読み込みました。`;
    restore();filters();render();
  }catch(e){if(token!==generation)return;$('loadStatus').textContent=e.message;$('validation').textContent='CSVを確認して、もう一度選択してください。';}
}
function render(){
  $('compositionResults').hidden=true;$('compositionEmpty').hidden=false;$('validation').textContent='';
  if(!books.length)return;
  const type=$('schoolType').value,classes=Number($('classCount').value);
  let standard;
  try{standard=standardBooks(type,classes);}catch(e){$('validation').textContent=e.message;return;}
  try{localStorage.setItem(key($('compositionSchool').value),JSON.stringify({type,classes}));$('saveStatus').textContent='校種と学級数をこのブラウザに保存しました。蔵書データは保存しません。';}
  catch{$('saveStatus').textContent='設定を保存できませんでした。診断は利用できますが、次回は再入力してください。';}
  const selected=new Set([...$('typeChoices').querySelectorAll('input:checked')].map(n=>n.value));
  const all=schoolBooks(),included=all.filter(b=>selected.has(b.type)),c=composition(included),ratios=RATIOS[type];
  const metric=(label,value,detail)=>`<div class="metric"><span class="label">${label}</span><span class="value">${value}</span><span class="detail">${detail}</span></div>`;
  $('compositionTitle').textContent=`${$('compositionSchool').value}の蔵書構成診断`;
  $('compositionContext').textContent=`${labels[type]} ｜ ${classes}学級 ｜ 選択した資料種別の資料を集計`;
  $('compositionMetrics').innerHTML=metric('現在の蔵書数',`${fmt(c.total)}冊`,'選択した資料種別の合計')+metric('図書標準',standard===null?'対象外':`${fmt(standard)}冊`,'文科省 学校図書館図書標準')+metric('達成率',standard===null?'—':`${(c.total/standard*100).toFixed(1)}%`,'現在の蔵書数 ÷ 図書標準')+metric('不足冊数',standard===null?'—':`${fmt(Math.max(0,standard-c.total))}冊`,'標準を満たす場合は0冊');
  $('achievementText').textContent=standard===null?'高等学校には文科省のこの図書標準を適用せず、下の蔵書構成のみ比較します。':`${fmt(c.total)}冊 / ${fmt(standard)}冊（${(c.total/standard*100).toFixed(1)}%）${c.total>=standard?'：標準冊数を満たしています。':'：あと'+fmt(standard-c.total)+'冊です。'}`;
  $('achievementTrack').hidden=standard===null;$('achievementFill').style.width=standard?`${Math.min(100,c.total/standard*100)}%`:'0%';
  $('coverageNote').textContent=`0～9類とEの計${fmt(c.classified)}冊を100％として比較します。Eの${fmt(c.picture)}冊は9類（文学）に合算しています。分類不明${fmt(c.unknown)}冊は構成比の対象外です。${c.classified?'':'比較可能な資料がありません。'}`;
  $('ratioChart').innerHTML=c.counts.map((n,i)=>{
    const pct=c.classified?n/c.classified*100:0;
    return `<div class="ratio-row"><strong>${i} ${i === 9 ? '文学（E含む）' : NDC_NAMES[i]}</strong><div class="ratio-track" role="img" aria-label="${i === 9 ? '文学（E含む）' : NDC_NAMES[i]}：現在${c.classified?pct.toFixed(1)+'%':'算出不可'}、標準${ratios[i]}%"><div class="ratio-fill" style="width:${pct}%"></div><div class="ratio-marker" style="left:${ratios[i]}%"></div></div><span>${c.classified?pct.toFixed(1)+'%':'—'}</span></div>`;
  }).join('');
  $('ratioRows').innerHTML=c.counts.map((n,i)=>{
    const pct=n/c.classified*100,diff=pct-ratios[i];
    return `<tr><th scope="row">${i} ${i === 9 ? '文学（E含む）' : NDC_NAMES[i]}</th><td>${fmt(n)}</td><td>${c.classified?pct.toFixed(1)+'%':'—'}</td><td>${ratios[i]}%</td><td>${c.classified?(diff>0?'+':'')+diff.toFixed(1)+' pt':'—'}</td></tr>`;
  }).join('');
  const duplicates=deduplicate(raw.filter(b=>b.school===$('compositionSchool').value)).duplicates;
  $('compositionBreakdown').innerHTML=[['読み込んだ資料（重複除外後）',all.length],['資料種別の選択で除外',all.length-c.total],['分類判明（Eを9類に合算）',c.classified],['うち絵本（E）',c.picture],['分類不明',c.unknown],['重複資料番号による除外',duplicates]].map(([s,n])=>`<div class="break-row"><span>${esc(s)}</span><b>${fmt(n)}冊</b></div>`).join('');
  $('compositionEmpty').hidden=true;$('compositionResults').hidden=false;
}
$('catalogFiles').addEventListener('change',e=>{const files=[...e.target.files];if(files.length)load(files);e.target.value='';});
const drop=$('compositionDrop');
for(const name of ['dragenter','dragover'])drop.addEventListener(name,e=>{e.preventDefault();drop.classList.add('dragging');});
for(const name of ['dragleave','drop'])drop.addEventListener(name,e=>{e.preventDefault();drop.classList.remove('dragging');});
drop.addEventListener('drop',e=>load([...e.dataTransfer.files]));
$('compositionSchool').addEventListener('change',()=>{restore();filters();render();});
for(const id of ['schoolType','classCount','typeChoices'])$(id).addEventListener('change',render);
$('forgetSettings').addEventListener('click',()=>{
  try{localStorage.removeItem(key($('compositionSchool').value));$('schoolType').value='';$('classCount').value='';render();$('saveStatus').textContent='この学校の保存設定を削除しました。';}
  catch{$('saveStatus').textContent='保存設定を削除できませんでした。ブラウザの設定を確認してください。';}
});
$('compositionPrint').addEventListener('click',()=>window.print());

