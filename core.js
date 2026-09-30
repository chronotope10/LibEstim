export const NDC_NAMES = ['総記','哲学','歴史・地理','社会科学','自然科学','技術・工学','産業','芸術','言語','文学'];
export const CLASS_NAMES = {...NDC_NAMES, E:'絵本'};
export const CLASS_CODES = [...NDC_NAMES.keys(), 'E'];
export const DEFAULT_CLASSES = [0,2,3,4,5,6,7];

export function parseDelimited(text, delimiter) {
  const rows = []; let row = [], field = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"' && field === '') quoted = true;
    else if (c === delimiter) { row.push(field); field = ''; }
    else if (c === '\r' || c === '\n') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field); if (row.some(v => v.trim())) rows.push(row);
      row = []; field = '';
    } else field += c;
  }
  if (quoted) throw new Error('引用符が閉じられていません。CSVの形式を確認してください。');
  row.push(field); if (row.some(v => v.trim())) rows.push(row);
  return rows;
}
export function parseCatalog(text, filename) {
  const firstLine = text.split(/\r?\n/, 1)[0];
  const delimiter = firstLine.split('\t').length > firstLine.split(',').length ? '\t' : ',';
  const rows = parseDelimited(text.replace(/^\uFEFF/, ''), delimiter);
  if (!rows.length) throw new Error(`${filename}: 空のファイルです。`);
  const normalize = s => String(s ?? '').replace(/^[\uFEFF\s]+|\s+$/g, '').normalize('NFKC').replace(/\s+/g, '');
  const headers = rows[0].map(normalize);
  const col = name => headers.indexOf(normalize(name));
  const call = col('請求記号'), pub = col('出版年月');
  if (call < 0 || pub < 0) throw new Error(`${filename}: 「請求記号」「出版年月」の列が必要です。`);
  const indices = Object.fromEntries(['資料番号','タイトル','サブタイトル','人名','出版者','所蔵館','資料種別'].map(k => [k, col(k)]));
  const locationColumn = col('保管場所') >= 0 ? col('保管場所') : col('所蔵場所');
  const fallback = filename.replace(/\.(csv|tsv)$/i, '');
  const books = [];
  for (let line = 1; line < rows.length; line++) {
    const row = rows[line];
    if (row.every(v => !v.trim())) continue;
    const get = i => i < 0 ? '' : (row[i] ?? '').trim();
    const school = get(indices['所蔵館']) || fallback;
    const classification = get(call).normalize('NFKC').toUpperCase().match(/^\s*([0-9E])/);
    const ndc = classification ? (classification[1] === 'E' ? 'E' : Number(classification[1])) : null;
    books.push({id:get(indices['資料番号']),title:get(indices['タイトル']),subtitle:get(indices['サブタイトル']),author:get(indices['人名']),publisher:get(indices['出版者']),type:get(indices['資料種別']),school,location:get(locationColumn)||'場所未設定',call:get(call),pub:get(pub),ndc,file:filename});
  }
  return books;
}
export function publicationYear(s, baseYear) {
  const m = String(s ?? '').normalize('NFKC').trim().match(/^(\d{4})(?=$|[\s\/\-.年])/);
  if (!m) return null;
  const year = Number(m[1]);
  return year >= 1450 && year <= baseYear ? year : null;
}
export function summarize(books, classes, baseYear) {
  const chosen = new Set(classes);
  const counts = {total:books.length,target:0,evaluable:0,ten:0,twenty:0,missingYear:0,missingClass:0,outside:0,outsidePictureBooks:0};
  const perClass = new Map([...chosen].sort((a,b) => CLASS_CODES.indexOf(a)-CLASS_CODES.indexOf(b)).map(k => [k,{total:0,evaluable:0,recent:0,tenToNineteen:0,twenty:0,missing:0}]));
  for (const b of books) {
    if (b.ndc === null) { counts.missingClass++; continue; }
    if (!chosen.has(b.ndc)) { counts.outside++; if (b.ndc === 'E') counts.outsidePictureBooks++; continue; }
    counts.target++;
    const g = perClass.get(b.ndc); g.total++;
    const pubYear = publicationYear(b.pub,baseYear);
    if (pubYear === null) { counts.missingYear++; g.missing++; continue; }
    counts.evaluable++; g.evaluable++;
    const age = baseYear - pubYear;
    if (age >= 20) {counts.twenty++; counts.ten++; g.twenty++;}
    else if (age >= 10) {counts.ten++; g.tenToNineteen++;}
    else g.recent++;
  }
  return {counts,perClass};
}

export function checklistGroups(books, classes, baseYear, range = '10', school = '__all__') {
  const chosen = new Set(classes);
  const groups = new Map();
  for (const b of books) {
    if (school !== '__all__' && b.school !== school) continue;
    if (!chosen.has(b.ndc)) continue;
    const pubYear = publicationYear(b.pub, baseYear);
    if (range !== 'all' && (pubYear === null || baseYear - pubYear < Number(range))) continue;
    const key = `${b.school}\u0000${b.location || '場所未設定'}`;
    if (!groups.has(key)) groups.set(key, {school:b.school, location:b.location || '場所未設定', books:[]});
    groups.get(key).books.push(b);
  }
  const dateKey = b => {
    const year = publicationYear(b.pub, baseYear);
    if (year === null) return Number.POSITIVE_INFINITY;
    const month = String(b.pub).normalize('NFKC').trim().match(/^\d{4}[\/\-.年]\s*(\d{1,2})/);
    const m = month && Number(month[1]) >= 1 && Number(month[1]) <= 12 ? Number(month[1]) : 0;
    return year * 12 + m;
  };
  for (const group of groups.values()) group.books.sort((a,b) => dateKey(a)-dateKey(b) || a.id.localeCompare(b.id, 'ja'));
  return [...groups.values()].sort((a,b) => a.school.localeCompare(b.school,'ja') || a.location.localeCompare(b.location,'ja'));
}
