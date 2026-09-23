/**
 * 日付の整形と、記事の年別グループ化。
 *
 * ニュース記事の日付は data/news.json の `date`（並べ替え用の ISO 日付）と
 * `dateLabel`（表示用の原文）の2つで表される。学会参加や研究滞在の記事には
 * "2023.12.11-15" や "2024.09-12" のような期間表記があり、単一日では
 * 表しきれないため。dateLabel が空でなければ、表示は必ずそちらを使う。
 */

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** "2026-09-16" → "2026.09.16"（一覧ページの表記） */
export function formatDotted(iso) {
  const m = ISO_DATE.exec(iso ?? "");
  return m ? `${m[1]}.${m[2]}.${m[3]}` : (iso ?? "");
}

/** "2026-09-16" → "2026年9月16日"（トップページの表記） */
export function formatJapanese(iso) {
  const m = ISO_DATE.exec(iso ?? "");
  if (!m) return iso ?? "";
  return `${m[1]}年${Number(m[2])}月${Number(m[3])}日`;
}

/** 並べ替えと年分類に使う西暦。解釈できなければ 0。 */
export function yearOf(iso) {
  const m = ISO_DATE.exec(iso ?? "");
  return m ? Number(m[1]) : 0;
}

/** 一覧ページに表示する日付。期間表記はそのまま出す。 */
export function archiveDate(item) {
  return item?.dateLabel || formatDotted(item?.date);
}

/** トップページに表示する日付。期間表記はそのまま出す。 */
export function recentDate(item) {
  return item?.dateLabel || formatJapanese(item?.date);
}

/**
 * 記事を年ごとにまとめる。oldestLabelYear 以前はひとつのグループに集約する。
 * 戻り値は年の新しい順。グループ内の並びは入力順のまま。
 */
export function groupByYear(items, oldestLabelYear) {
  const buckets = new Map();
  for (const item of items) {
    const year = yearOf(item.date);
    const key = year <= oldestLabelYear ? oldestLabelYear : year;
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(item);
  }
  return [...buckets.keys()]
    .sort((a, b) => b - a)
    .map((key) => ({
      id: `year-${key}`,
      label: key === oldestLabelYear ? `${key}年以前` : `${key}年`,
      items: buckets.get(key),
    }));
}
