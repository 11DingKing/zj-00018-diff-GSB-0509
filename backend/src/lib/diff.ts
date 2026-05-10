export type DiffOperation = "equal" | "insert" | "delete";

export interface LineDiff {
  operation: DiffOperation;
  content: string;
  oldLineNumber: number | null;
  newLineNumber: number | null;
}

export interface CharDiff {
  operation: DiffOperation;
  content: string;
}

export interface Hunk {
  oldStart: number;
  oldLines: number;
  newStart: number;
  newLines: number;
  lines: LineDiff[];
}

const normalizeNewlines = (str: string): string => {
  return str.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
};

const splitLines = (str: string): string[] => {
  if (str === "") return [];
  const normalized = normalizeNewlines(str);
  const lines = normalized.split("\n");
  return lines;
};

export const lineDiff = (oldStr: string, newStr: string): LineDiff[] => {
  const oldLines = splitLines(oldStr);
  const newLines = splitLines(newStr);

  const m = oldLines.length;
  const n = newLines.length;

  const dp: number[][] = Array(m + 1)
    .fill(null)
    .map(() => Array(n + 1).fill(0));

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (oldLines[i - 1] === newLines[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  const result: LineDiff[] = [];
  let i = m;
  let j = n;

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && oldLines[i - 1] === newLines[j - 1]) {
      result.unshift({
        operation: "equal",
        content: oldLines[i - 1],
        oldLineNumber: i,
        newLineNumber: j,
      });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      result.unshift({
        operation: "insert",
        content: newLines[j - 1],
        oldLineNumber: null,
        newLineNumber: j,
      });
      j--;
    } else {
      result.unshift({
        operation: "delete",
        content: oldLines[i - 1],
        oldLineNumber: i,
        newLineNumber: null,
      });
      i--;
    }
  }

  return result;
};

export const charDiff = (oldStr: string, newStr: string): CharDiff[] => {
  const oldChars = Array.from(oldStr);
  const newChars = Array.from(newStr);

  const m = oldChars.length;
  const n = newChars.length;

  const dp: number[][] = Array(m + 1)
    .fill(null)
    .map(() => Array(n + 1).fill(0));

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (oldChars[i - 1] === newChars[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  const result: CharDiff[] = [];
  let i = m;
  let j = n;

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && oldChars[i - 1] === newChars[j - 1]) {
      result.unshift({
        operation: "equal",
        content: oldChars[i - 1],
      });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      result.unshift({
        operation: "insert",
        content: newChars[j - 1],
      });
      j--;
    } else {
      result.unshift({
        operation: "delete",
        content: oldChars[i - 1],
      });
      i--;
    }
  }

  return result;
};

const DEFAULT_CONTEXT = 3;

export const groupIntoHunks = (
  diffs: LineDiff[],
  context: number = DEFAULT_CONTEXT,
): Hunk[] => {
  if (diffs.length === 0) return [];

  const hunks: Hunk[] = [];
  const changeIndices: number[] = [];

  for (let idx = 0; idx < diffs.length; idx++) {
    if (diffs[idx].operation !== "equal") {
      changeIndices.push(idx);
    }
  }

  if (changeIndices.length === 0) return [];

  let hunkStart = Math.max(0, changeIndices[0] - context);
  let hunkEnd = Math.min(diffs.length - 1, changeIndices[0] + context);

  for (let i = 1; i < changeIndices.length; i++) {
    const currentChange = changeIndices[i];
    const prevChange = changeIndices[i - 1];

    if (currentChange - prevChange <= context * 2 + 1) {
      hunkEnd = Math.min(diffs.length - 1, currentChange + context);
    } else {
      hunks.push(createHunk(diffs, hunkStart, hunkEnd));
      hunkStart = Math.max(0, currentChange - context);
      hunkEnd = Math.min(diffs.length - 1, currentChange + context);
    }
  }

  hunks.push(createHunk(diffs, hunkStart, hunkEnd));

  return hunks;
};

const createHunk = (diffs: LineDiff[], start: number, end: number): Hunk => {
  const lines = diffs.slice(start, end + 1);

  let firstOldLine: number | null = null;
  let firstNewLine: number | null = null;
  let oldCount = 0;
  let newCount = 0;

  for (const line of lines) {
    if (line.oldLineNumber !== null) {
      if (firstOldLine === null) firstOldLine = line.oldLineNumber;
      oldCount++;
    }
    if (line.newLineNumber !== null) {
      if (firstNewLine === null) firstNewLine = line.newLineNumber;
      newCount++;
    }
  }

  return {
    oldStart: firstOldLine ?? 0,
    oldLines: oldCount,
    newStart: firstNewLine ?? 0,
    newLines: newCount,
    lines,
  };
};

export const hunkToUnified = (hunk: Hunk): string => {
  const header = `@@ -${hunk.oldStart},${hunk.oldLines} +${hunk.newStart},${hunk.newLines} @@`;
  const lines = hunk.lines.map((line) => {
    switch (line.operation) {
      case "insert":
        return `+${line.content}`;
      case "delete":
        return `-${line.content}`;
      default:
        return ` ${line.content}`;
    }
  });
  return [header, ...lines].join("\n");
};

export const diffToUnified = (
  oldStr: string,
  newStr: string,
  context: number = DEFAULT_CONTEXT,
): string => {
  const diffs = lineDiff(oldStr, newStr);
  const hunks = groupIntoHunks(diffs, context);
  return hunks.map(hunkToUnified).join("\n");
};

export const getDiffStats = (
  diffs: LineDiff[],
): { insertions: number; deletions: number } => {
  let insertions = 0;
  let deletions = 0;

  for (const diff of diffs) {
    if (diff.operation === "insert") insertions++;
    if (diff.operation === "delete") deletions++;
  }

  return { insertions, deletions };
};
