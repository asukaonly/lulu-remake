/** @template {{ id: number, validation: string, answerHash: string | null, validationRule: string | null, excludedReason?: string }} T
 * @param {T[]} levels
 * @returns {T[]}
 */
export function playableLevels(levels) {
  return levels.filter((level) => !level.excludedReason && (
    level.validation === "username" ||
    (level.validation === "known" && Boolean(level.answerHash)) ||
    (level.validation === "algorithm" && Boolean(level.validationRule))),
  );
}

/** Removed deep links continue at the next available original level number.
 * @param {number} requested
 * @param {{ id: number }[]} levels
 */
export function resolvePlayableId(requested, levels) {
  return (levels.find((level) => level.id >= requested) ?? levels.at(-1))?.id ?? 1;
}
