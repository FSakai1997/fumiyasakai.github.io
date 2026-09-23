/**
 * 表示言語の決定と、日本語へのフォールバック。
 *
 * data/*.json の各項目は ja と en を持つ。en が未入力のあいだは ja を表示する。
 * これにより、英語版ページを追加するときにデータ構造を変えずに済み、
 * 翻訳も本当に必要な項目から順に進められる。
 */

const STORAGE_KEY = "siteLang";
const SUPPORTED = ["ja", "en"];
const DEFAULT_LANG = "ja";

/** ?lang=en → localStorage → 既定値 ja の順で決定する。 */
export function currentLang() {
  try {
    const requested = new URLSearchParams(location.search).get("lang");
    if (SUPPORTED.includes(requested)) {
      localStorage.setItem(STORAGE_KEY, requested);
      return requested;
    }
    const saved = localStorage.getItem(STORAGE_KEY);
    if (SUPPORTED.includes(saved)) return saved;
  } catch {
    // プライベートブラウジング等で localStorage が使えないことがある。
    // 言語が決まらないだけで描画は続けられるので、既定値に落とす。
  }
  return DEFAULT_LANG;
}

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
