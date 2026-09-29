import { validateRecoveredRule } from "./recovered-rules.mjs";

export const STORAGE_KEY = "lulu-remake-progress-v1";
export const emptyProgress = () => ({
  version: 1,
  lastLevel: 1,
  username: "探索者",
  completed: {},
  notes: {},
  answers: {},
});

export function normalizeProgress(value) {
  const clean = emptyProgress();
  if (!value || typeof value !== "object" || value.version !== 1) return clean;
  if (
    Number.isInteger(value.lastLevel) &&
    value.lastLevel >= 1 &&
    value.lastLevel <= 99
  )
    clean.lastLevel = value.lastLevel;
  if (typeof value.username === "string" && value.username.trim())
    clean.username = value.username.trim().slice(0, 40);
  for (let id = 1; id <= 99; id++) {
    if (["verified", "manual"].includes(value.completed?.[id]))
      clean.completed[id] = value.completed[id];
    for (const field of ["notes", "answers"]) {
      if (typeof value[field]?.[id] === "string")
        clean[field][id] = value[field][id].slice(0, 20000);
    }
  }
  return clean;
}

export function readProgress(storage) {
  try {
    return normalizeProgress(
      JSON.parse(storage.getItem(STORAGE_KEY) || "null"),
    );
  } catch {
    return emptyProgress();
  }
}

export function levelFromHash(hash, fallback = 1) {
  const match = /^#\/level\/(\d+)$/.exec(hash);
  const id = match ? Number(match[1]) : fallback;
  return Number.isInteger(id) && id >= 1 && id <= 99 ? id : 1;
}

export async function validateAnswer(
  level,
  answer,
  username,
  cryptoProvider = globalThis.crypto,
) {
  const normalized = answer.trim();
  if (!normalized) return "empty";
  if (level.validation === "manual") return "unavailable";
  if (level.validation === "username")
    return normalized === username.trim() ? "correct" : "incorrect";
  if (level.validation === "algorithm")
    return validateRecoveredRule(level.validationRule, normalized)
      ? "correct"
      : "incorrect";
  const digest = await cryptoProvider.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(normalized),
  );
  const hash = Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
  return hash === level.answerHash ? "correct" : "incorrect";
}
