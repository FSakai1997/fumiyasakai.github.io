/**
 * 画像ファイル名の整形とサイズ表記の検証。
 *
 * 日本語のファイル名をそのまま使うと、URLで長いエンコード文字列になり、
 * 記事のHTMLから読み取れなくなる。ここで英数字に整える。
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import { safeFileName, formatSize } from "../../admin/media.js";

test("英数字のファイル名はそのまま通る", () => {
  assert.equal(safeFileName("profile.jpg"), "profile.jpg");
  assert.equal(safeFileName("SP_award_cut.JPG"), "SP_award_cut.jpg");
});

test("空白や記号はハイフンにまとめる", () => {
  assert.equal(safeFileName("my photo (1).png"), "my-photo-1.png");
  assert.equal(safeFileName("a   b.png"), "a-b.png");
});

test("日本語のファイル名でも拡張子を保った名前になる", () => {
  const name = safeFileName("実験装置の写真.jpg");
  assert.match(name, /\.jpg$/);
  assert.doesNotMatch(name, /[^\x20-\x7e]/, "英数字以外が残っている");
});

test("名前が全部落ちても image という名前になる", () => {
  assert.equal(safeFileName("　　.png"), "image.png");
});

test("先頭と末尾のハイフンは残さない", () => {
  assert.equal(safeFileName("--x--.jpg"), "x.jpg");
});

test("拡張子は小文字にそろえる", () => {
  assert.equal(safeFileName("PHOTO.JPEG"), "PHOTO.jpeg");
});

test("拡張子がなくても落ちない", () => {
  assert.equal(safeFileName("readme"), "readme");
});

test("サイズは読みやすい単位で出す", () => {
  assert.equal(formatSize(512), "512 B");
  assert.equal(formatSize(2048), "2 KB");
  assert.equal(formatSize(5 * 1024 * 1024), "5.0 MB");
});
