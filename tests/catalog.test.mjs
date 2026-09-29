import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { playableLevels, resolvePlayableId } from "../src/lib/catalog.mjs";
import { levelFromHash, normalizeProgress, validateAnswer } from "../src/lib/progress.mjs";
import { load } from "cheerio";

const archive = JSON.parse(await readFile(new URL("../src/data/levels.json", import.meta.url), "utf8"));
const levels = playableLevels(archive);

test("catalog removes unsolved and answer-in-prompt levels while retaining real puzzles", () => {
  assert.equal(levels.length, 40);
  const unverified = [13, 15, 18, 19, 20, 21, 48, 49, 50, 53, 56, 59, 63, 64, 65, 66, 67, 68, 69, 71, 72, 73, 74, 75, 76, 77, 82, 87, 88, 90, 96, 97, 98, 99];
  const directAnswers = [6, 8, 9, 10, 17, 22, 23, 24, 26, 27, 28, 29, 30, 32, 33, 36, 37, 38, 39, 42, 43, 47, 83, 84, 95];
  const excluded = [...unverified, ...directAnswers].sort((a, b) => a - b);
  assert.deepEqual(archive.filter((level) => level.excludedReason === "answer-in-prompt").map((level) => level.id), directAnswers);
  assert.deepEqual(archive.filter((level) => !levels.includes(level)).map((level) => level.id), excluded);
  assert.deepEqual(levels.slice(-3).map((level) => level.id), [92, 93, 94]);
  for (const id of [1, 2, 3, 4, 5, 7, 11, 44, 51, 52]) {
    assert.ok(levels.some((level) => level.id === id), `Keep actual clues and file puzzles: ${id}`);
  }
  assert.equal(levels[levels.findIndex((level) => level.id === 12) + 1].id, 14);
  assert.equal(levels[levels.findIndex((level) => level.id === 5) + 1].id, 7);
  assert.equal(levels[levels.findIndex((level) => level.id === 7) + 1].id, 11);
});

test("removed deep links and saved locations resolve to a playable level without destroying saves", () => {
  for (const level of archive) {
    const resolved = resolvePlayableId(levelFromHash(`#/level/${level.id}`), levels);
    assert.ok(levels.some((item) => item.id === resolved));
    if (levels.includes(level)) assert.equal(resolved, level.id);
  }
  assert.equal(resolvePlayableId(13, levels), 14);
  assert.equal(resolvePlayableId(9, levels), 11);
  assert.equal(resolvePlayableId(95, levels), 94);
  assert.equal(resolvePlayableId(96, levels), 94);
  const progress = normalizeProgress({ version: 1, lastLevel: 96, notes: { 96: "以前的研究" }, completed: { 1: "verified" } });
  assert.equal(resolvePlayableId(levelFromHash("", progress.lastLevel), levels), 94);
  assert.equal(progress.notes[96], "以前的研究");
  assert.equal(progress.completed[1], "verified");
});

test("all playable levels have individual hints and source-only puzzles retain usable clues", () => {
  assert.equal(new Set(levels.map((level) => level.hint)).size, 40);
  for (const level of levels) {
    assert.ok(level.hint.trim().length >= 20, `Missing hint for level ${level.id}`);
    assert.doesNotMatch(level.hint, /试试「查看源码」/);
  }
  assert.equal(levels[0].puzzlePath, "/puzzles/1.html");
  assert.match(levels.find((level) => level.id === 2).promptText, /726.*456/);
  assert.match(levels.find((level) => level.id === 7).promptText, /%u8DEF%u8DEF/);
  assert.match(levels.find((level) => level.id === 94).promptText, /ASCII/);
});

test("level 1 can be solved from the original HTTP document without running JavaScript", async () => {
  const level = levels[0];
  const html = await readFile(new URL(`../public${level.puzzlePath}`, import.meta.url), "utf8");
  const $ = load(html);
  const clue = html.match(/<!--\s*过关密码是：(.+?)\s*-->/)?.[1];
  assert.ok(clue, "View Source needs the real clue in the response HTML");
  assert.equal(await validateAnswer(level, clue, ""), "correct");
  assert.equal($("script").length, 0);
  assert.ok(html.trim().split("\n").length <= 25, "Keep the first puzzle small enough to inspect");
  assert.doesNotMatch($("body").text(), new RegExp(clue), "The answer should remain hidden in an HTML comment");
  assert.match($("#puzzle p").html(), /<!--/, "Inspecting the sentence should immediately include its clue");
  assert.equal($("a").attr("href"), "/#/level/1");
});
