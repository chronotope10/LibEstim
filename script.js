import {CLASS_NAMES,CLASS_CODES,DEFAULT_CLASSES,parseCatalog,publicationYear,summarize} from './core.js';
import {openChecklist} from './checklist.js';
const $ = id => document.getElementById(id);
const format = n => n.toLocaleString('ja-JP');
const percent = (a,b) => b ? `${(a / b * 100).toFixed(1)}%` : '—';
const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const selectedFiles = new Map(); let allBooks = [],duplicates = 0, lastYear = null;
$('baseYear').value = new Date().getFullYear();
$('classChecks').innerHTML = CLASS_CODES.map(i => `<label><input type="checkbox" value="${i}" ${DEFAULT_CLASSES.includes(i)?'checked':''}>${i} ${escape(CLASS_NAMES[i])}</label>`).join('');
const getClasses = () => [...document.querySelectorAll('#classChecks input:checked')].map(n => n.value === 'E' ? 'E' : Number(n.value));
const year = () => { const value = Number($('baseYear').value); if(!Number.isInteger(value) || value < 1900 || value > 2100) throw new Error('基準年を1900～2100の整数で入力してください。'); return value; };
function renderFiles(){
  const box = $('fileList'); box.replaceChildren();
  if(!selectedFiles.size) box.textContent = 'ファイルはまだ選択されていません';
  for(const [key,file] of selectedFiles){
    const pill = document.createElement('span'); pill.className='file-pill';
    const name = document.createElement('span'); name.textContent=file.name;
    const del = document.createElement('button'); del.type='button'; del.textContent='×'; del.setAttribute('aria-label',`${file.name}を外す`);
    del.addEventListener('click',()=>{selectedFiles.delete(key);renderFiles();invalidate();});
    pill.append(name,del); box.append(pill);
  }
  $('analyze').disabled = !selectedFiles.size;
}
function invalidate(){ $('results').hidden=true; $('empty').hidden=false; $('status').textContent=''; allBooks=[]; }
function addFiles(list){
  for(const file of list){ if(!/\.(csv|tsv)$/i.test(file.name)){ $('status').textContent='CSVまたはTSVファイルを選んでください。'; continue; }
    selectedFiles.set(`${file.name}:${file.size}:${file.lastModified}`,file);
  }
  renderFiles();invalidate();
}
$('fileInput').addEventListener('change',e=>{addFiles(e.target.files);e.target.value='';});
const drop = $('dropzone');
for(const event of ['dragenter','dragover']) drop.addEventListener(event,e=>{e.preventDefault();drop.classList.add('dragging');});
for(const event of ['dragleave','drop']) drop.addEventListener(event,e=>{e.preventDefault();drop.classList.remove('dragging');});
drop.addEventListener('drop',e=>addFiles(e.dataTransfer.files));
async function decode(file){
  const bytes = await file.arrayBuffer();
  try {return new TextDecoder('utf-8',{fatal:true}).decode(bytes);}
  catch {return new TextDecoder('shift_jis',{fatal:true}).decode(bytes);}
}
$('analyze').addEventListener('click',async()=>{
  $('status').textContent='読み込み中…'; $('analyze').disabled=true; $('results').hidden=true; $('empty').hidden=false;
  try{
    const y=year(), classes=getClasses();
    if(!classes.length) throw new Error('対象とする分類を一つ以上選んでください。');
    let books=[];
    for(const file of selectedFiles.values()) books.push(...parseCatalog(await decode(file),file.name));
    if(!books.length) throw new Error('資料の行がありません。');
    const seen=new Set(); duplicates=0;
    allBooks=books.filter(b=>{if(!b.id) return true;const key=`${b.school}\u0000${b.id}`;if(seen.has(key)){duplicates++;return false;}seen.add(key);return true;});
    lastYear=y;
    const schools=[...new Set(allBooks.map(b=>b.school))].sort((a,b)=>a.localeCompare(b,'ja'));
    $('schoolSelect').replaceChildren(new Option('全校', '__all__'),...schools.map(s=>new Option(s,s)));
    $('schoolSelect').value='__all__'; render();
    $('status').textContent=`${format(allBooks.length)}冊を集計しました${duplicates?`（重複資料番号 ${format(duplicates)}件を除外）`:''}。`;
    $('empty').hidden=true; $('results').hidden=false;
  }catch(e){ $('status').textContent=e.message || '読み込みに失敗しました。CSVを確認してください。'; }
  finally{$('analyze').disabled=!selectedFiles.size;}
});
$('schoolSelect').addEventListener('change',render);
function render(){
  if(!allBooks.length) return;
  let y,classes;
  try {y=year();classes=getClasses();if(!classes.length)throw new Error('対象分類を選んでください。');}
  catch(e){$('status').textContent=e.message;return;}
  const school=$('schoolSelect').value;
  const books=school==='__all__'?allBooks:allBooks.filter(b=>b.school===school);
  const {counts:c,perClass}=summarize(books,classes,y);
  $('resultTitle').textContent=school==='__all__'?'全校の診断結果':`${school}の診断結果`;
  $('resultContext').textContent=`基準年 ${y}年 ｜ 重点点検対象 ${classes.map(k => k === 'E' ? 'E（絵本）' : `${k}類`).join('・')} ｜ ${format(books.length)}冊を集計`;
  const metric=(label,value,detail,feature=false)=>`<div class="metric ${feature?'feature':''}"><span class="label">${label}</span><span class="value">${value}</span><span class="detail">${detail}</span></div>`;
  $('metrics').innerHTML=metric('全所蔵冊数',`${format(c.total)}冊`,'読み込んだ資料の合計')+metric('重点点検対象',`${format(c.target)}冊`,'選択した分類の資料')+metric('出版10年以上',`${format(c.ten)}冊 / ${percent(c.ten,c.evaluable)}`,'対象分類・出版年判明分が分母',true)+metric('出版20年以上',`${format(c.twenty)}冊 / ${percent(c.twenty,c.evaluable)}`,'出版10年以上の内数');
  const bars=[];
  for(const [k,g] of perClass){
    const width=n=>g.evaluable?(n/g.evaluable*100):0;
    const tip=`10年未満 ${g.recent}冊、10～19年 ${g.tenToNineteen}冊、20年以上 ${g.twenty}冊、出版年不明 ${g.missing}冊`;
    bars.push(`<div class="class-row" title="${escape(tip)}"><div class="class-name">${k} ${escape(CLASS_NAMES[k])}</div><div class="stack" role="img" aria-label="${escape(CLASS_NAMES[k])}: ${escape(tip)}"><div class="fresh" style="width:${width(g.recent)}%"></div><div class="aged" style="width:${width(g.tenToNineteen)}%"></div><div class="old" style="width:${width(g.twenty)}%"></div></div><div class="class-value"><b>${percent(g.tenToNineteen+g.twenty,g.evaluable)}</b> <span>(${format(g.tenToNineteen+g.twenty)}冊)</span></div></div>`);
  }
  $('classChart').innerHTML=bars.join('');
  const schools=[...new Set(allBooks.map(b=>b.school))].sort((a,b)=>a.localeCompare(b,'ja'));
  $('schoolChart').innerHTML=schools.map(s=>{
    const sc=summarize(allBooks.filter(b=>b.school===s),classes,y).counts;
    const p=sc.evaluable?sc.ten/sc.evaluable*100:0;
    return `<div class="compare-row ${s===school?'active':''}"><div class="compare-row-top"><b>${escape(s)}</b><span>${percent(sc.ten,sc.evaluable)} <small>(${format(sc.ten)} / ${format(sc.evaluable)}冊)</small></span></div><div class="compare-track" role="img" aria-label="${escape(s)}: 出版10年以上 ${percent(sc.ten,sc.evaluable)}"><div class="compare-fill" style="width:${p}%"></div></div></div>`;
  }).join('');
  const breakdown=[['重点点検対象・出版年判明',c.evaluable],['重点点検対象・出版年不明',c.missingYear],['対象外の分類（E以外）',c.outside-c.outsidePictureBooks],...(!classes.includes('E') ? [['絵本（E）・重点点検対象外',c.outsidePictureBooks]] : []),['請求記号の分類を読み取れない資料',c.missingClass]];
  $('breakdown').innerHTML=breakdown.map(([label,n])=>`<div class="break-row"><span>${label}</span><b>${format(n)}冊</b></div>`).join('');
  $('methodNote').textContent=`集計方法：資料1行を1冊として数え、同じ学校・資料番号の重複は除外。発行後の年数は ${y} − 出版年で計算（出版月は判定に使用しません）。10年以上には20年以上を含みます。${duplicates?`重複 ${format(duplicates)}件を除外。`:''} 年数は内容の正確さや廃棄適否を確定するものではありません。`;
  lastYear=y;
}
$('baseYear').addEventListener('change',()=>{if(allBooks.length)render();});
$('classChecks').addEventListener('change',()=>{if(allBooks.length)render();});
$('printBtn').addEventListener('click',()=>window.print());
$('checklistBtn').addEventListener('click',()=>{
  const classes=getClasses();
  if(!allBooks.length || !classes.length){$('status').textContent='CSVと対象分類を確認してください。';return;}
  openChecklist({books:allBooks,classes,baseYear:lastYear,range:$('checkRange').value,school:$('schoolSelect').value});
});
function csvCell(value){let s=String(value??'');if(/^[\s]*[=+\-@]/.test(s))s="'"+s;return '"'+s.replaceAll('"','""')+'"';}
$('downloadCsv').addEventListener('click',()=>{
  if(!allBooks.length)return;
  const school=$('schoolSelect').value, classes=new Set(getClasses());
  const headers=['所蔵館','資料番号','タイトル','人名','出版者','請求記号','出版年月','経過年数','点検区分','資料種別'];
  const rows=allBooks.filter(b=>school==='__all__'||b.school===school).filter(b=>classes.has(b.ndc)).map(b=>{
    const p=publicationYear(b.pub,lastYear);return {b,p,age:p===null?null:lastYear-p};
  }).filter(({age})=>age!==null&&age>=10).sort((a,b)=>b.age-a.age).map(({b,age})=>[b.school,b.id,b.title,b.author,b.publisher,b.call,b.pub,age,age>=20?'出版20年以上':'出版10～19年',b.type]);
  const csv='\uFEFF'+[headers,...rows].map(row=>row.map(csvCell).join(',')).join('\r\n');
  const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));
  const a=document.createElement('a');a.href=url;a.download=`蔵書鮮度_要点検一覧_${lastYear}年.csv`;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),10000);
});
