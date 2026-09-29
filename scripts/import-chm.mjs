import { readFile, writeFile, mkdir, copyFile, access } from "node:fs/promises";
import { existsSync } from "node:fs";
import { resolve, join, basename, extname } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { load } from "cheerio";
import { playableLevels } from "../src/lib/catalog.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));
const archive = join(root, ".archive/chm");
const source = resolve(root, process.argv[2] || "路路解密破解游戏(离线版).chm");
if (!existsSync(join(archive, "Index60c2.html"))) {
  const sevenZip =
    process.env.SEVEN_ZIP ||
    (process.platform === "win32" ? "C:\\Program Files\\7-Zip\\7z.exe" : "7z");
  execFileSync(sevenZip, ["x", source, `-o${archive}`, "-y", "-bso0"], {
    stdio: "inherit",
  });
}
const $index = load(await readFile(join(archive, "Index60c2.html"), "utf8"));
const links = $index("#gamebar a").toArray();
if (links.length !== 99)
  throw new Error(`Expected 99 levels, found ${links.length}`);
await mkdir(join(root, "src/data"), { recursive: true });
await mkdir(join(root, "public/original"), { recursive: true });
const hash = (value) => createHash("sha256").update(value).digest("hex");
const recovered = JSON.parse(
  await readFile(join(root, "scripts/recovered-answers.json"), "utf8"),
);
const levelCopy = JSON.parse(
  await readFile(join(root, "scripts/level-copy.json"), "utf8"),
);
const confirmed = {
  1: "开始玩游戏",
  2: "726456",
  3: "56968",
  4: "840888",
  5: "5050",
  6: "0o0",
  7: "路路",
  8: ".....",
  10: "www.666666666666.com",
  11: "361300100",
  17: "原来的asp注入不能玩了",
  22: "过关密码",
  23: "24966326+3966326",
  24: "●●●●●●●●●●●●●●",
  26: "Song",
  27: "123",
  28: "726",
  29: "6326",
  30: "56326",
  32: "过关密码",
  33: "24966326",
  36: "3966326",
  37: "466326",
  38: "本关已经关闭",
  39: "88888888888888888888888888",
  42: "123",
  43: "123",
  47: "123456",
  83: "123456",
  84: "过关密码",
  95: "Song",
  ...Object.fromEntries(
    Object.entries(recovered)
      .filter(([, entry]) => typeof entry.answer === "string")
      .map(([id, entry]) => [id, entry.answer]),
  ),
};
const names = {
  1: "藏在页面里的秘密",
  2: "数字，还是字符串？",
  3: "跟着变量走",
  4: "加法的另一面",
  5: "循环里的答案",
  6: "仔细看，再仔细一点",
  7: "被编码的秘密",
  8: "看似普通的符号",
  9: "你是谁？",
  10: "熟悉的网址",
  11: "变量接力",
  12: "Flash 猜密码",
  13: "一个小问题",
  14: "Flash 里的机关",
  15: "文件的另一张名片",
  16: "数据库的锁",
  18: "字符串的另一种语言",
  19: "两个密码，一个答案",
  20: "回忆，重新组合",
  31: "从文件开始",
  34: "消失的密码文件",
  35: "注册表里的线索",
  40: "图片会说话",
  41: "壳里面的秘密",
  44: "超越精度的运算",
  45: "灰色的按钮",
  46: "多出来的字节",
  48: "不止是一张图片",
  51: "文件里的密码",
  52: "六位与十位",
  54: "继续向内探索",
  55: "创建，寻找，解密",
  57: "调试器的对手",
  58: "十五秒的挑战",
  60: "三个输入框",
  61: "移不开的窗口",
  62: "七个字符的组合",
  68: "寻找注册码",
  70: "再进一步",
  73: "一个新的 CrackMe",
  78: "远程服务器",
  79: "十四位数字",
  80: "十八位数字",
  81: "回到 DOS",
  82: "Windows 的旧时光",
  85: "识别码的秘密",
  86: "另一种算法",
  87: "大数计算器",
  88: "固定的识别码",
  89: "藏在宏里的秘密",
  91: "十位识别码",
  92: "下一段算法",
  93: "不唯一的答案",
  94: "字符与数字",
  96: "编码后的注册码",
  97: "最后的挑战 · I",
  98: "最后的挑战 · II",
  99: "终章，未完的探索",
};
const levels = [];
const assets = new Map();
for (const element of links) {
  const id = Number($index(element).text().match(/\d+/)[0]);
  const filename = $index(element).attr("href");
  const html = await readFile(join(archive, filename), "utf8");
  const $ = load(html);
  const original = $(".content").html().trim();
  const $content = load(original, {}, false);
  const resources = [];
  const referenced = new Set();
  $content('[src], [href], param[name="movie"]').each((_, node) => {
    for (const attr of ["src", "href", "value"]) {
      const value = $content(node).attr(attr);
      if (value?.startsWith("file/")) referenced.add(value);
    }
  });
  for (const path of referenced) {
    const input = resolve(archive, path);
    if (
      !input.startsWith(
        resolve(archive) + (process.platform === "win32" ? "\\" : "/"),
      )
    )
      throw new Error("Invalid resource path");
    await access(input);
    const bytes = await readFile(input);
    const name = basename(path);
    const extension = extname(name).slice(1);
    const destination = join(root, "public/original", path);
    await mkdir(resolve(destination, ".."), { recursive: true });
    await copyFile(input, destination);
    const item = {
      name,
      path: `/original/${path}`,
      originalPath: path,
      extension,
      size: bytes.length,
      sha256: hash(bytes),
    };
    resources.push(item);
    assets.set(path, item);
  }
  const hasFlash = resources.some((r) => r.extension === "swf");
  const isWeb = id <= 8 || id === 11;
  const hasImage = resources.some((r) => /^(jpg|gif|png)$/.test(r.extension));
  const rawText = $content.text().replace(/\s+/g, " ").trim();
  if (id === 44) {
    const numbers = rawText.match(/\d{20}/g).map(BigInt);
    confirmed[44] = (
      numbers.slice(0, 8).reduce((a, b) => a + b, 0n) +
      numbers[8] * numbers[9] * numbers[10]
    ).toString();
  }
  // Keep original scripts in the archive data; the game displays only static content.
  $content(
    "script, style, input, form, object, embed, iframe, link, meta",
  ).remove();
  $content(".file").each((_, node) => {
    if (!$content(node).find("img").length) $content(node).remove();
  });
  $content("b")
    .first()
    .filter((_, node) => $content(node).text() === "关卡说明：")
    .remove();
  const allowed = new Set([
    "p",
    "br",
    "b",
    "strong",
    "i",
    "em",
    "u",
    "span",
    "div",
    "h3",
    "img",
    "a",
    "font",
    "pre",
    "code",
  ]);
  $content("*").each((_, node) => {
    if (!allowed.has(node.tagName)) {
      $content(node).replaceWith($content(node).text());
      return;
    }
    for (const attr of Object.keys(node.attribs || {})) {
      if (!["src", "href", "alt"].includes(attr))
        $content(node).removeAttr(attr);
    }
    for (const attr of ["src", "href"]) {
      const value = $content(node).attr(attr);
      if (!value) continue;
      if (value.startsWith("file/"))
        $content(node).attr(attr, `/original/${value}`);
      else $content(node).removeAttr(attr);
    }
    if (node.tagName === "img")
      $content(node).attr("alt", `第 ${id} 关原始图片线索`);
  });
  // The game shell displays instructions; source-inspection puzzles use small static pages.
  const promptHtml = levelCopy[id]?.promptHtml ?? $content
    .html()
    .replace(/<!--[\s\S]*?-->/g, "")
    .trim();
  const promptText = load(promptHtml).text().replace(/\s+/g, " ").trim();
  const incomplete = promptText === "过关密码" || [21, 82].includes(id);
  const kind = isWeb
    ? "web"
    : hasFlash
      ? "flash"
      : hasImage
        ? "image"
        : resources.length
          ? "binary"
          : "logic";
  const validation =
    id === 9 ? "username" : recovered[id]?.rule ? "algorithm" : confirmed[id] !== undefined ? "known" : "manual";
  if (validation !== "manual" && !levelCopy[id]?.excludedReason && !levelCopy[id]?.hint?.trim())
    throw new Error(`Playable level ${id} needs an authored hint`);
  const heading = $("h2")
    .toArray()
    .map((e) => $(e).text())
    .find((t) => /^第\d+关/.test(t));
  const puzzleHtml = levelCopy[id]?.puzzleHtml;
  const puzzlePath = puzzleHtml ? `/puzzles/${id}.html` : undefined;
  if (puzzleHtml) {
    await mkdir(join(root, "public/puzzles"), { recursive: true });
    // Kept outside Vite's HTML entry points: browser View Source must show the actual clue.
    await writeFile(join(root, "public", puzzlePath), `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>第 ${id} 关 · 题目页</title>
  <link rel="stylesheet" href="/puzzles/puzzle.css">
</head>
<body>
<main id="puzzle">
  <h1>第 ${id} 关</h1>
${puzzleHtml}
  <a href="/#/level/${id}">返回答题</a>
</main>
</body>
</html>
`);
  }
  levels.push({
    id,
    title:
      names[id] ||
      (incomplete
        ? "留在旧时光的关卡"
        : validation === "known"
          ? "原作者的特别通行证"
          : "继续解密"),
    originalTitle: heading,
    originalFile: filename,
    kind,
    promptHtml,
    promptText,
    ...(puzzlePath ? { puzzlePath } : {}),
    ...(levelCopy[id]?.excludedReason ? { excludedReason: levelCopy[id].excludedReason } : {}),
    source: original,
    resources,
    validation,
    validationRule: recovered[id]?.rule ?? null,
    answerHash: confirmed[id] !== undefined ? hash(confirmed[id]) : null,
    incomplete,
    hasInteraction: (id >= 2 && id <= 8) || id === 11,
    hint: levelCopy[id]?.hint ?? "",
  });
}
const manifest = {
  title: "路路解密破解游戏第一部（技术）",
  origin: basename(source),
  levelCount: levels.length,
  resourceCount: assets.size,
  totalBytes: [...assets.values()].reduce((sum, a) => sum + a.size, 0),
  verifiedCount: levels.filter((l) => l.validation !== "manual").length,
  playableCount: playableLevels(levels).length,
  resources: [...assets.values()],
};
await writeFile(
  join(root, "src/data/levels.json"),
  JSON.stringify(levels, null, 2) + "\n",
);
await writeFile(
  join(root, "src/data/manifest.json"),
  JSON.stringify(manifest, null, 2) + "\n",
);
await writeFile(
  join(root, "public/original/manifest.json"),
  JSON.stringify(manifest, null, 2) + "\n",
);
console.log(
  `Imported ${levels.length} levels, ${assets.size} unchanged assets; ${manifest.verifiedCount} local validators, ${manifest.playableCount} playable levels.`,
);
