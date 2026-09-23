/**
 * 保存処理の検証。
 *
 * ここを間違えると記事が失われる。特に「競合時に黙って上書きしない」ことは
 * 実際の事故を防ぐ最後の砦なので、偽のAPIを使って固定しておく。
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import { JsonStore, ConflictError, commitMessage } from "../../admin/store.js";

/** GitHub API の代役。呼ばれた内容を記録する。 */
function fakeApi(initial, { conflictOnPut = false } = {}) {
  return {
    calls: [],
    async getFile(path) {
      this.calls.push(["get", path]);
      return { text: JSON.stringify(initial), sha: "sha-1" };
    },
    async putFile(path, text, sha, message) {
      this.calls.push(["put", path, sha, message]);
      if (conflictOnPut) throw new ConflictError(path);
      return { sha: "sha-2", commitUrl: "https://github.com/x/y/commit/abc" };
    },
  };
}

const sample = { items: [{ id: "a" }, { id: "b" }, { id: "c" }] };
const countItems = (data) => data.items.length;

test("load は内容と sha を取り込み、未保存フラグを下ろす", async () => {
  const api = fakeApi(sample);
  const store = new JsonStore(api, "data/news.json", countItems);
  await store.load();

  assert.equal(store.data.items.length, 3);
  assert.equal(store.sha, "sha-1");
  assert.equal(store.dirty, false);
  assert.equal(store.savedCount, 3);
});

test("保存時には読み込み時の sha を必ず添える", async () => {
  const api = fakeApi(sample);
  const store = new JsonStore(api, "data/news.json", countItems);
  await store.load();
  await store.save("test");

  const put = api.calls.find((c) => c[0] === "put");
  assert.equal(put[2], "sha-1", "保存時に sha を送っていない");
});

test("保存に成功すると sha が更新され、次の保存に引き継がれる", async () => {
  const api = fakeApi(sample);
  const store = new JsonStore(api, "data/news.json", countItems);
  await store.load();
  await store.save("one");
  await store.save("two");

  const puts = api.calls.filter((c) => c[0] === "put");
  assert.deepEqual(puts.map((c) => c[2]), ["sha-1", "sha-2"]);
});

test("競合したら ConflictError を投げ、sha を進めない", async () => {
  const api = fakeApi(sample, { conflictOnPut: true });
  const store = new JsonStore(api, "data/news.json", countItems);
  await store.load();
  store.setDirty(true);

  await assert.rejects(() => store.save("test"), ConflictError);
  assert.equal(store.sha, "sha-1", "競合後に sha が進んでいる");
  assert.equal(store.dirty, true, "競合後に未保存フラグが消えている");
});

test("件数の変化を保存前に数えられる", async () => {
  const api = fakeApi(sample);
  const store = new JsonStore(api, "data/news.json", countItems);
  await store.load();

  store.data.items.push({ id: "d" });
  assert.deepEqual(store.countChange(), { before: 3, after: 4, delta: 1 });

  store.data.items.splice(0, 3);
  assert.deepEqual(store.countChange(), { before: 3, after: 1, delta: -2 });
});

test("保存すると件数の基準が更新される", async () => {
  const api = fakeApi(sample);
  const store = new JsonStore(api, "data/news.json", countItems);
  await store.load();

  store.data.items.push({ id: "d" });
  await store.save("test");
  assert.deepEqual(store.countChange(), { before: 4, after: 4, delta: 0 });
});

test("保存される中身は読みやすい整形JSONで、末尾に改行が付く", async () => {
  const api = fakeApi(sample);
  const store = new JsonStore(api, "data/news.json", countItems);
  await store.load();

  const text = store.serialize();
  assert.ok(text.endsWith("\n"));
  assert.deepEqual(JSON.parse(text), sample);
  assert.ok(text.includes("\n  "), "インデントされていない");
});

test("日本語がエスケープされずに保存される（差分を読めるようにするため）", async () => {
  const api = fakeApi({ items: [{ ja: { title: "火星コアの構造解明" } }] });
  const store = new JsonStore(api, "data/news.json", countItems);
  await store.load();

  assert.ok(store.serialize().includes("火星コアの構造解明"));
});

test("ファイルが無ければ、黙って新規作成せずに失敗する", async () => {
  const api = { async getFile() { return { text: null, sha: null }; } };
  const store = new JsonStore(api, "data/news.json", countItems);
  await assert.rejects(() => store.load(), /見つかりません/);
});

test("コミットメッセージに対象と日時が入る", () => {
  const message = commitMessage("news");
  assert.match(message, /^content: update news \(\d{4}-\d{2}-\d{2} \d{2}:\d{2}\)$/);
});
