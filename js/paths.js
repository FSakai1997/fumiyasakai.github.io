/**
 * サイト内のファイルを、ページの階層に依存せず参照するための関数。
 *
 * data/*.json に入っている画像のパスは "image/Earth.jpg" のように
 * サイトのルートからの位置で書かれている。これをそのまま src に出すと
 * ページからの相対パスとして解釈され、/en/research.html からは
 * /en/image/Earth.jpg を探して404になる。
 *
 * このモジュールは常に /js/ に置かれるので、モジュール自身の位置を
 * 基準にすれば、どの階層のページから呼んでも同じ場所を指す。
 * データの参照先 (render-*.js の DATA_URL) と同じ考え方。
 */

const EXTERNAL = /^(https?:)?\/\//;

/**
 * サイト内のパスを絶対URLに直す。
 * 外部URLとデータURLはそのまま返す。
 */
export function assetUrl(path) {
  if (!path) return "";
  const value = String(path);
  if (EXTERNAL.test(value) || value.startsWith("data:")) return value;
  // 先頭の "/" や "./" を取り除いてから、サイトのルート基準で組み立てる。
  const clean = value.replace(/^\.?\//, "");
  return new URL(`../${clean}`, import.meta.url).href;
}
