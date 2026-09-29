import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { validateAnswer } from "../src/lib/progress.mjs";
import { validateRecoveredRule } from "../src/lib/recovered-rules.mjs";

const readJson = async (path) => JSON.parse(await readFile(new URL(path, import.meta.url), "utf8"));
const levels = await readJson("../src/data/levels.json");
const recovered = await readJson("../scripts/recovered-answers.json");
const proof = await readJson("./fixtures/recovered-proof.json");

test("all 32 proven recoveries survive CHM import and reject incorrect answers", async () => {
  assert.equal(Object.keys(recovered).length, 32);
  assert.equal(levels.filter((level) => level.validation !== "manual").length, 65);
  for (const [id, entry] of Object.entries(recovered)) {
    const level = levels[Number(id) - 1];
    for (const answer of entry.examples ?? [entry.answer]) {
      assert.equal(await validateAnswer(level, answer, "探索者"), "correct", `level ${id}`);
    }
    assert.equal(await validateAnswer(level, "definitely-wrong", "探索者"), "incorrect", `level ${id}`);
    assert.equal(await validateAnswer(level, " ", "探索者"), "empty");
  }
});

test("binary-verified grid solutions and punctuation aliases pass the restored rules", async () => {
  for (const [id, grid] of Object.entries(proof.grids)) {
    const level = levels[Number(id) - 1];
    for (const example of grid.examples) {
      assert.deepEqual(example.native, [1]);
      assert.equal(await validateAnswer(level, example.answer, ""), "correct", `level ${id}: ${example.serial}`);
    }
    const invalid = id === "94" ? "65".repeat(grid.count) : "A".repeat(grid.count);
    assert.deepEqual(grid.examples[0].negative, [0]);
    assert.equal(await validateAnswer(level, invalid, ""), "incorrect");
    assert.equal(await validateAnswer(level, grid.examples[0].answer + "A", ""), "incorrect");
  }
  // Level 94's page asks for decimal ASCII, not the raw serial shown in the EXE.
  assert.equal(await validateAnswer(levels[93], proof.grids[94].examples[0].serial, ""), "incorrect");
  for (const malformed of ["1", "032".repeat(33), "128".repeat(33), "119 ".repeat(33), "0".repeat(10000)]) {
    assert.equal(validateRecoveredRule("grid-94", malformed), false);
  }
  assert.equal(validateRecoveredRule("missing-rule", "anything"), false);
});

test("level 79 accepts both native-verified solutions, preserving leading zeros", async () => {
  assert.deepEqual(proof.nativeArithmetic[79], [["pass"], ["pass"], ["fail"]]);
  for (const serial of ["03374340102018", "42183332846228"]) {
    assert.equal(await validateAnswer(levels[78], serial, ""), "correct");
  }
  for (const wrong of ["3374340102018", "03374340102019", "42183332846229"]) {
    assert.equal(await validateAnswer(levels[78], wrong, ""), "incorrect");
  }
});

test("arithmetic passwords match independently derived constraints and actual displayed outputs", () => {
  assert.equal(recovered[60].answer, (56789n * 12345n * 98765n).toString());
  assert.equal(recovered[78].answer, (300007n * 300017n / 2n).toString());
  assert.deepEqual(proof.nativeArithmetic[78], [["pass"], ["fail"]]);
  assert.equal(recovered[81].answer, proof.nativeArithmetic[81].serial);
  assert.deepEqual(proof.nativeArithmetic[81].checks, [["pass"], ["fail"]]);
  assert.equal((466326 * 2) ^ Number(recovered[81].answer), 0xddf22);
  assert.deepEqual(proof.nativeArithmetic[85], [["pass"], ["fail"]]);
  const blocks = recovered[85].answer.match(/\d{4}/g).map(Number);
  assert.deepEqual(blocks.map((block, index) => (block + [24, 96, 63, 26][index]) ^ [24, 96, 63, 26][index]), [2389, 2389, 2389, 2389]);
  const record = proof.kaprekar92[0];
  assert.equal((BigInt(record.x) ** 5n).toString(), record.power);
  assert.equal(record.parts.reduce((a, b) => a + b, 0), record.x);
  assert.equal(24966326 ^ record.serial, record.x);
  assert.equal(recovered[92].answer, String(24966326 + record.serial));
  assert.equal(recovered[89].answer, String(6326 * ((6326 ** 2) ^ 42981200)));
});

test("symbol passwords and Chinese punctuation remain exact", async () => {
  for (const [id, answer, wrong] of [
    [54, "?@ABCDEFGHIJKLMN", "?@abcdefghijklmn"],
    [55, "lulu<=>?@ABCDEF", "lulu<=>?@abcdef"],
    [57, "@@@@@@@@@@@@", "@@@@@@@@@@@"],
    [58, "<=>?@ABCDEFGHIJKL", "<=>?@ABCDEFGHIJKLM"],
    [62, "你知道密码吗？", "你知道密码吗?"],
  ]) {
    assert.equal(await validateAnswer(levels[id - 1], answer, ""), "correct");
    assert.equal(await validateAnswer(levels[id - 1], wrong, ""), "incorrect");
  }
});

test("candidates and intermediate archive passwords are never reported as verified", async () => {
  for (const [id, candidate] of [
    [13, "是"], [15, "999888361300100"], [18, "954.6"],
    [19, "123456"], [20, "路路361300100是"], [48, "123456"],
    [73, "871301258443658055105763356124"], [96, "arbitrary"],
  ]) {
    assert.equal(await validateAnswer(levels[id - 1], candidate, ""), "unavailable");
  }
});
