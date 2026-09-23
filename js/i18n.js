/**
 * 表示言語の扱いと、日本語へのフォールバック。
 *
 * 言語はURLで決まる。`/` が日本語、`/en/` が英語。
 * 各ページが自分の言語を定数として描画関数に渡す。
 *
 * クエリやブラウザの保存領域から言語を決める仕組みは置かない。
 * 決め方が2つあると、`/en/` のページを `?lang=ja` で開いたときに
 * どちらが勝つのかが読んで分からなくなるため。
 *
 * data/*.json の各項目は ja と en を持つ。en が未入力のあいだは ja を
 * 表示する。これにより、翻訳を終える前から英語ページを公開でき、
 * 訳した項目から順に英語に変わっていく。
 */

/** 指定言語の文字列を返す。空なら日本語へフォールバックする。 */
export function pick(obj, lang) {
  if (!obj) return "";
  const value = obj[lang];
  if (typeof value === "string" && value.trim() !== "") return value;
  return typeof obj.ja === "string" ? obj.ja : "";
}

/** 記事のタイトルを言語別に取り出す。 */
export function pickTitle(item, lang) {
  return pick({ ja: item?.ja?.title, en: item?.en?.title }, lang);
}

/** 記事の本文を言語別に取り出す。 */
export function pickBody(item, lang) {
  return pick({ ja: item?.ja?.body, en: item?.en?.body }, lang);
}

/**
 * 指定言語で、まだ翻訳されていない項目の数。
 *
 * 英語ページで日本語にフォールバックしている項目がいくつあるかを数える。
 * ページ側はこれが 0 より大きいときだけ案内を出す。すべて訳し終われば
 * 0 になり、案内は自動的に消える。
 */
export function countUntranslated(items, lang) {
  if (lang === "ja" || !Array.isArray(items)) return 0;
  return items.filter((item) => {
    const box = item?.[lang];
    return !box?.title?.trim() || !box?.body?.trim();
  }).length;
}
