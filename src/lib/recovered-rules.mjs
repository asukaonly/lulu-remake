import grids from "../data/recovered-grids.json" with { type: "json" };

// The original page submits decimal ASCII codes for level 94, without separators.
function decodeAscii(answer, count) {
  if (!/^\d+$/.test(answer) || answer.length > count * 3) return null;
  let decoded = "";
  for (let offset = 0; offset < answer.length;) {
    const width = answer[offset] === "1" ? 3 : 2;
    const token = answer.slice(offset, offset + width);
    const code = Number(token);
    if (token.length !== width || code < 33 || code > 126) return null;
    decoded += String.fromCharCode(code);
    offset += width;
  }
  return decoded.length === count ? decoded : null;
}

export function validateRecoveredRule(rule, answer) {
  if (rule === "consecutive-squares") {
    if (!/^\d{14}$/.test(answer)) return false;
    const x = BigInt(answer.slice(0, 7)) + 466326n;
    const y = BigInt(answer.slice(7)) + 466326n;
    return x >= 1n && y >= 1n && x * x + (x + 1n) ** 2n === (2n * y + 1n) ** 2n;
  }

  const id = rule?.startsWith("grid-") ? rule.slice(5) : "";
  const grid = grids[id];
  if (!grid) return false;
  const serial = id === "94" ? decodeAscii(answer, grid.count) : answer;
  if (!serial || serial.length !== grid.count || !/^[!-~]+$/.test(serial)) return false;
  const values = Array.from(serial, (char, index) => {
    let code = char.charCodeAt(0);
    if (id === "94" && code >= 117 && code <= 122) code -= 26;
    return code - grid.user.charCodeAt(index % 10) - (id === "94" ? 16 : 14);
  });
  if (new Set(values).size !== grid.count) return false;
  // The binaries test distinctness and sums; they do not restrict values to 1..N.
  const sums = grid.rows.map((row) => row.reduce((sum, index) => sum + values[index - 1], 0));
  const expected = id === "91" ? 38 : id === "94" ? 147 : sums[0];
  return sums.every((sum) => sum === expected);
}
