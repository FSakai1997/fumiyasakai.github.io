/**
 * ライブプレビュー。
 *
 * 公開ページと同じ style.css を、iframe の中で読み込む。
 * 管理画面のCSSが混ざらないため、プレビューの見え方は本番と一致する。
 *
 * 描画に使うHTMLは js/render-news.js と js/render-cv.js が組み立てる。
 * 管理画面用に描画コードを書き直してはならない。書き直せば、プレビューと
 * 本番が時間とともに食い違っていく。
 */

import { debounce } from "./dom.js";

/**
 * iframe の中に置く土台。
 * <base href="../"> があるので、style.css も image/*.jpg も
 * 公開ページと同じ相対パスで解決される。
 */
function shell(bodyClass, inner) {
  return `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<base href="../">
<link rel="stylesheet" href="style.css">
<link href="https://fonts.googleapis.com/css2?family=Lato:wght@300;400;700&family=Noto+Serif+JP:wght@400;700&display=swap" rel="stylesheet">
<style>
  body { margin: 0; background: #fff; }
  .preview-wrap { padding: 20px; }
</style>
</head>
<body class="${bodyClass}">
<div class="preview-wrap">${inner}</div>
</body>
</html>`;
}

export class Preview {
  /**
   * @param {string} bodyClass  iframe の body に付けるクラス
   * @param {number} delayMs    入力からの遅延
   */
  constructor(bodyClass = "", delayMs = 200) {
    this.bodyClass = bodyClass;
    this.frame = document.createElement("iframe");
    this.frame.className = "preview-frame";
    this.frame.setAttribute("title", "プレビュー");
    // 公開ページのCSSと画像を読むだけ。スクリプトは動かさない。
    this.frame.setAttribute("sandbox", "allow-same-origin");
    this.update = debounce((html) => this.render(html), delayMs);
  }

  get element() {
    return this.frame;
  }

  /** 遅延せずにすぐ描き直す。 */
  render(html) {
    // srcdoc を使うと、スクロール位置は毎回先頭に戻る。
    // 編集中の記事は短いので、位置の保存までは行わない。
    this.frame.srcdoc = shell(this.bodyClass, html);
  }
}
