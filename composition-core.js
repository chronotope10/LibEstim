export const RATIOS = {
  elementary: [6,3,16,10,16,6,5,8,5,25],
  junior: [6,5,16,10,15,6,5,8,6,23],
  high: [7,7,16,12,14,6,4,8,7,19]
};

// 文部科学省 学校図書館図書標準（小学校・中学校）
export function standardBooks(type, classes) {
  if (!Number.isSafeInteger(classes) || classes < 1) throw new Error('学級数を1以上の整数で入力してください。');
  if (type === 'high') return null;
  if (!['elementary','junior'].includes(type)) throw new Error('校種を選択してください。');
  if (type === 'elementary' && classes === 1) return 2400;
  if (classes <= 2) return type === 'elementary' ? 3000 : 4800;
  const bands = type === 'elementary'
    ? [[6,2,3000,520],[12,6,5080,480],[18,12,7960,400],[30,18,10360,200],[Infinity,30,12760,120]]
    : [[6,2,4800,640],[12,6,7360,560],[18,12,10720,480],[30,18,13600,320],[Infinity,30,17440,160]];
  const [,base,total,step] = bands.find(([limit]) => classes <= limit);
  return total + step * (classes-base);
}

export function composition(books) {
  const counts = Array(10).fill(0);
  let picture = 0, unknown = 0;
  for (const b of books) {
    if (Number.isInteger(b.ndc) && b.ndc >= 0 && b.ndc <= 9) counts[b.ndc]++;
    else if (b.ndc === 'E') { picture++; counts[9]++; }
    else unknown++;
  }
  return {total: books.length, counts, picture, unknown, classified: counts.reduce((a,b)=>a+b,0)};
}

export function deduplicate(books) {
  const seen = new Set(); let duplicates = 0;
  const unique = books.filter(b => {
    if (!b.id) return true;
    const key = JSON.stringify([b.school,b.id]);
    if (seen.has(key)) { duplicates++; return false; }
    seen.add(key); return true;
  });
  return {books:unique,duplicates};
}
