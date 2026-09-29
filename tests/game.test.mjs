import test from "node:test";
import assert from "node:assert/strict";
import { readFile, access } from "node:fs/promises";
import { createHash } from "node:crypto";
import {
  normalizeProgress,
  readProgress,
  levelFromHash,
  validateAnswer,
} from "../src/lib/progress.mjs";

const levels = JSON.parse(
  await readFile(new URL("../src/data/levels.json", import.meta.url), "utf8"),
);
const manifest = JSON.parse(
  await readFile(new URL("../src/data/manifest.json", import.meta.url), "utf8"),
);
const root = new URL("../", import.meta.url);

test("all 99 levels are present in their original order with inspectable clues", () => {
  assert.deepEqual(
    levels.map((l) => l.id),
    Array.from({ length: 99 }, (_, i) => i + 1),
  );
  assert.ok(levels.every((l) => l.source && l.originalFile && l.promptHtml));
  assert.match(levels[0].source, /<!--\s*过关密码是：开始玩游戏/);
  assert.match(levels[6].source, /unescape/);
  assert.match(levels[93].source, /\$str = exe注册码/);
});

test("all resource bytes match the extracted CHM and recorded SHA-256", async () => {
  assert.equal(manifest.resourceCount, 45);
  let bytes = 0;
  for (const resource of manifest.resources) {
    const copied = await readFile(new URL(`public${resource.path}`, root));
    assert.equal(copied.length, resource.size, resource.name);
    assert.equal(
      createHash("sha256").update(copied).digest("hex"),
      resource.sha256,
      resource.name,
    );
    const originalPath = new URL(`.archive/chm/${resource.originalPath}`, root);
    // A checkout includes generated data and original bytes, but the ignored extraction may be absent.
    try {
      await access(originalPath);
      assert.deepEqual(copied, await readFile(originalPath));
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
    bytes += copied.length;
  }
  assert.equal(bytes, manifest.totalBytes);
});

test("displayed HTML cannot execute legacy scripts or request old services", () => {
  for (const level of levels) {
    assert.doesNotMatch(
      level.promptHtml,
      /<(?:script|iframe|object|embed|form|input|style)\b/i,
    );
    assert.doesNotMatch(level.promptHtml, /\s(?:on\w+|style)\s*=/i);
    assert.doesNotMatch(
      level.promptHtml,
      /(?:src|href)="(?:https?:|javascript:)/i,
    );
  }
  assert.equal(levels.filter((l) => l.kind === "flash").length, 2);
  assert.equal(levels.filter((l) => l.kind === "image").length, 3);
});

test("restored web puzzles validate actual original answers, preserve case and reject errors", async () => {
  const answers = [
    "开始玩游戏",
    "726456",
    "56968",
    "840888",
    "5050",
    "0o0",
    "路路",
    ".....",
  ];
  for (let index = 0; index < answers.length; index++) {
    assert.equal(
      await validateAnswer(levels[index], answers[index], "探索者"),
      "correct",
    );
    assert.equal(
      await validateAnswer(levels[index], "wrong", "探索者"),
      "incorrect",
    );
  }
  assert.equal(
    await validateAnswer(levels[10], "361300100", "探索者"),
    "correct",
  );
  assert.equal(await validateAnswer(levels[25], "song", "探索者"), "incorrect");
  assert.equal(await validateAnswer(levels[25], " Song ", "探索者"), "correct");
  assert.equal(await validateAnswer(levels[0], "  ", "探索者"), "empty");
});

test("local username adaptation works and unknown answers never falsely pass", async () => {
  assert.equal(await validateAnswer(levels[8], "新玩家", "新玩家"), "correct");
  assert.equal(
    await validateAnswer(levels[8], "探索者", "新玩家"),
    "incorrect",
  );
  for (const level of levels.filter((l) => l.validation === "manual")) {
    assert.equal(
      await validateAnswer(level, "arbitrary answer", "探索者"),
      "unavailable",
    );
    assert.equal(level.answerHash, null);
  }
});

test("large integer puzzle uses full precision and standard operator precedence", async () => {
  const sum =
    11223344556677889900n +
    22334455667788990011n +
    33445566778899001122n +
    44556677889900112233n +
    55667788990011223344n +
    66778899001122334455n +
    77889900112233445566n +
    88990011223344556677n;
  const answer =
    sum + 99001122334455667788n * 88888888888888888888n * 99999999999999999999n;
  assert.equal(
    await validateAnswer(levels[43], answer.toString(), ""),
    "correct",
  );
});

test("storage recovers from malformed data and validates every imported field", () => {
  assert.equal(readProgress({ getItem: () => "{broken" }).lastLevel, 1);
  assert.equal(
    readProgress({
      getItem: () => {
        throw new Error("storage denied");
      },
    }).lastLevel,
    1,
  );
  const clean = normalizeProgress({
    version: 1,
    lastLevel: 200,
    username: "  Alice  ",
    completed: { 1: "verified", 2: "manual", 3: "hacked", 100: "verified" },
    notes: { 2: "thought", 3: { bad: true } },
    answers: { 1: "开始玩游戏" },
  });
  assert.equal(clean.lastLevel, 1);
  assert.equal(clean.username, "Alice");
  assert.deepEqual(clean.completed, { 1: "verified", 2: "manual" });
  assert.deepEqual(clean.notes, { 2: "thought" });
  assert.deepEqual(clean.answers, { 1: "开始玩游戏" });
  assert.equal(normalizeProgress({ version: 2, lastLevel: 20 }).lastLevel, 1);
});

test("level routing supports deep links and rejects invalid routes", () => {
  assert.equal(levelFromHash("#/level/99"), 99);
  assert.equal(levelFromHash("", 14), 14);
  for (const hash of [
    "#/level/0",
    "#/level/100",
    "#/level/NaN",
    "#/level/-1",
    "#/level/2oops",
  ])
    assert.equal(levelFromHash(hash), 1);
});
