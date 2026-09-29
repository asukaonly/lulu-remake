export type Resource = {
  name: string;
  path: string;
  originalPath: string;
  extension: string;
  size: number;
  sha256: string;
};
export type Level = {
  id: number;
  title: string;
  originalTitle: string;
  originalFile: string;
  kind: "web" | "flash" | "image" | "binary" | "logic";
  promptHtml: string;
  promptText: string;
  puzzlePath?: string;
  excludedReason?: "answer-in-prompt";
  source: string;
  resources: Resource[];
  validation: "known" | "username" | "algorithm" | "manual";
  validationRule: string | null;
  answerHash: string | null;
  incomplete: boolean;
  hasInteraction: boolean;
  hint: string;
};
export type Progress = {
  version: number;
  lastLevel: number;
  username: string;
  completed: Record<number, "verified" | "manual">;
  notes: Record<number, string>;
  answers: Record<number, string>;
};
