import { test } from "node:test";
import assert from "node:assert/strict";
import {
  formatDotted,
  formatJapanese,
  archiveDate,
  recentDate,
  yearOf,
  groupByYear,
} from "../../js/format.js";

test("formatDotted はゼロ埋めしたドット区切りを返す", () => {
  assert.equal(formatDotted("2026-09-16"), "2026.09.16");
  assert.equal(formatDotted("2026-06-22"), "2026.06.22");
});

test("formatJapanese はゼロ埋めしない和式を返す", () => {
  assert.equal(formatJapanese("2026-09-16"), "2026年9月16日");
  assert.equal(formatJapanese("2026-06-22"), "2026年6月22日");
  assert.equal(formatJapanese("2025-10-03"), "2025年10月3日");
});

test("不正な日付はそのまま返す（描画を止めないため）", () => {
  assert.equal(formatDotted("おかしな値"), "おかしな値");
  assert.equal(formatJapanese(""), "");
  assert.equal(formatDotted(undefined), "");
  assert.equal(yearOf("おかしな値"), 0);
});

test("archiveDate は dateLabel があればそれを優先する", () => {
  // 学会参加などの記事は "2023.12.11-15" のような期間表記を使う。
  assert.equal(
    archiveDate({ date: "2023-12-11", dateLabel: "2023.12.11-15" }),
    "2023.12.11-15",
  );
  assert.equal(archiveDate({ date: "2026-09-16", dateLabel: "" }), "2026.09.16");
  assert.equal(archiveDate({ date: "2026-09-16" }), "2026.09.16");
});

test("recentDate も dateLabel があればそれを優先する", () => {
  assert.equal(
    recentDate({ date: "2024-09-01", dateLabel: "2024.09-12" }),
    "2024.09-12",
  );
  assert.equal(recentDate({ date: "2026-09-16", dateLabel: "" }), "2026年9月16日");
});

test("groupByYear は年ごとにまとめ、新しい順に並べる", () => {
  const items = [
    { date: "2026-09-16" },
    { date: "2026-01-02" },
    { date: "2024-05-01" },
  ];
  const groups = groupByYear(items, 2022);
  assert.deepEqual(
    groups.map((g) => g.label),
    ["2026年", "2024年"],
  );
  assert.equal(groups[0].items.length, 2);
  assert.equal(groups[0].id, "year-2026");
});

test("groupByYear は指定年以前をひとつにまとめる", () => {
  const items = [
    { date: "2023-01-01" },
    { date: "2022-06-01" },
    { date: "2021-03-01" },
    { date: "2019-12-01" },
  ];
  const groups = groupByYear(items, 2022);
  assert.deepEqual(
    groups.map((g) => g.label),
    ["2023年", "2022年以前"],
  );
  assert.equal(groups[1].items.length, 3);
  assert.equal(groups[1].id, "year-2022");
});

test("groupByYear は元の並び順をグループ内で保つ", () => {
  const items = [
    { date: "2026-09-16", id: "a" },
    { date: "2026-01-02", id: "b" },
  ];
  const groups = groupByYear(items, 2022);
  assert.deepEqual(
    groups[0].items.map((i) => i.id),
    ["a", "b"],
  );
});

test("groupByYear は空配列を受け取っても落ちない", () => {
  assert.deepEqual(groupByYear([], 2022), []);
});
