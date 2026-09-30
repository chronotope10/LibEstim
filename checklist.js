import {checklistGroups} from './core.js';

const escape = value => String(value ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const rangeLabel = {10:'出版10年以上',20:'出版20年以上',all:'全資料'};

export function openChecklist({books,classes,baseYear,range,school}) {
  const groups=checklistGroups(books,classes,baseYear,range,school);
  if (!groups.length) { alert('この条件に合う資料はありません。対象の分類や年数を確認してください。'); return; }
  const popup=window.open('', '_blank');
  if (!popup) { alert('チェックシートを開けませんでした。ブラウザのポップアップを許可してください。'); return; }
  const total=groups.reduce((n,g)=>n+g.books.length,0);
  const parts=groups.map(g=>`<section class="check-group">
    <table><colgroup><col class="pub"><col class="id"><col class="call"><col class="title"><col class="subtitle"><col class="author"><col class="publisher"><col class="mark"><col class="mark"><col class="mark"></colgroup>
    <thead><tr class="section-title"><th colspan="10"><span>蔵書チェックシート</span><span>${escape(g.school)}　｜　保管場所：${escape(g.location)}　｜　${g.books.length.toLocaleString('ja-JP')}冊</span><small>基準年 ${baseYear}年 ／ ${escape(rangeLabel[range])} ／ 出版年月の古い順</small></th></tr>
    <tr class="column-title"><th>出版年月</th><th>資料番号</th><th>請求記号</th><th>タイトル</th><th>サブタイトル</th><th>著者名</th><th>出版社</th><th>廃棄<br>予定</th><th>要<br>確認</th><th>保留</th></tr></thead>
    <tbody>${g.books.map(b=>`<tr><td>${escape(b.pub)}</td><td>${escape(b.id)}</td><td>${escape(b.call)}</td><td>${escape(b.title)}</td><td>${escape(b.subtitle)}</td><td>${escape(b.author)}</td><td>${escape(b.publisher)}</td><td class="check"><span aria-label="廃棄予定"></span></td><td class="check"><span aria-label="要確認"></span></td><td class="check"><span aria-label="保留"></span></td></tr>`).join('')}</tbody></table>
  </section>`).join('');
  const css=new URL('./checklist.css',import.meta.url).href;
  popup.document.open();
  popup.document.write(`<!doctype html><html lang="ja"><head><meta charset="utf-8"><title>蔵書チェックシート</title><link rel="stylesheet" href="${escape(css)}"></head><body><div class="print-tools"><strong>蔵書チェックシート</strong><span>${groups.length}か所・${total.toLocaleString('ja-JP')}冊</span><button type="button" id="printSheet">印刷 / PDF保存</button><small>保管場所ごとに改ページします。出版年不明の資料は「全資料」を選んだ場合に末尾へ表示します。</small></div><main>${parts}</main></body></html>`);
  popup.document.close();
  popup.document.getElementById('printSheet').addEventListener('click',()=>popup.print());
}
