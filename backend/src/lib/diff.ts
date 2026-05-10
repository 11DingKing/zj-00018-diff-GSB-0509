export interface DiffLine {
  type: "added" | "removed" | "context";
  content: string;
  oldLineNo?: number;
  newLineNo?: number;
}

export interface DiffHunk {
  oldStart: number;
  oldCount: number;
  newStart: number;
  newCount: number;
  lines: DiffLine[];
}

export interface CharDiff {
  type: "added" | "removed" | "equal";
  value: string;
}

function splitLines(text: string): string[] {
  if (text === "") return [];
  const lines: string[] = [];
  let remaining = text;
  while (remaining.length > 0) {
    const lfIdx = remaining.indexOf("\n");
    if (lfIdx === -1) {
      lines.push(remaining);
      break;
    }
    if (lfIdx > 0 && remaining[lfIdx - 1] === "\r") {
      lines.push(remaining.slice(0, lfIdx - 1));
    } else {
      lines.push(remaining.slice(0, lfIdx));
    }
    remaining = remaining.slice(lfIdx + 1);
  }
  return lines;
}

function computeLCS(a: string[], b: string[]): number[][] {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () =>
    Array(n + 1).fill(0),
  );

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }
  return dp;
}

function backtrackLCS(
  dp: number[][],
  a: string[],
  b: string[],
): [number, number][] {
  const result: [number, number][] = [];
  let i = a.length;
  let j = b.length;

  while (i > 0 && j > 0) {
    if (a[i - 1] === b[j - 1]) {
      result.unshift([i - 1, j - 1]);
      i--;
      j--;
    } else if (dp[i - 1][j] >= dp[i][j - 1]) {
      i--;
    } else {
      j--;
    }
  }
  return result;
}

export function computeLineDiff(oldText: string, newText: string): DiffLine[] {
  const oldLines = splitLines(oldText);
  const newLines = splitLines(newText);

  if (oldLines.length === 0 && newLines.length === 0) return [];

  const dp = computeLCS(oldLines, newLines);
  const lcs = backtrackLCS(dp, oldLines, newLines);

  const result: DiffLine[] = [];
  let oi = 0;
  let ni = 0;
  let oldLineNo = 1;
  let newLineNo = 1;

  for (const [matchOi, matchNi] of lcs) {
    while (oi < matchOi) {
      result.push({
        type: "removed",
        content: oldLines[oi],
        oldLineNo: oldLineNo++,
      });
      oi++;
    }
    while (ni < matchNi) {
      result.push({
        type: "added",
        content: newLines[ni],
        newLineNo: newLineNo++,
      });
      ni++;
    }
    result.push({
      type: "context",
      content: oldLines[matchOi],
      oldLineNo: oldLineNo++,
      newLineNo: newLineNo++,
    });
    oi = matchOi + 1;
    ni = matchNi + 1;
  }

  while (oi < oldLines.length) {
    result.push({
      type: "removed",
      content: oldLines[oi],
      oldLineNo: oldLineNo++,
    });
    oi++;
  }
  while (ni < newLines.length) {
    result.push({
      type: "added",
      content: newLines[ni],
      newLineNo: newLineNo++,
    });
    ni++;
  }

  return result;
}

export function groupIntoHunks(
  lines: DiffLine[],
  contextLines: number = 3,
): DiffHunk[] {
  if (lines.length === 0) return [];

  const changeIndices: number[] = [];
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].type !== "context") {
      changeIndices.push(i);
    }
  }

  if (changeIndices.length === 0) return [];

  const groups: number[][] = [[changeIndices[0]]];
  for (let i = 1; i < changeIndices.length; i++) {
    const prevGroup = groups[groups.length - 1];
    const lastChangeInGroup = prevGroup[prevGroup.length - 1];
    if (changeIndices[i] - lastChangeInGroup <= contextLines * 2) {
      prevGroup.push(changeIndices[i]);
    } else {
      groups.push([changeIndices[i]]);
    }
  }

  const hunks: DiffHunk[] = [];

  for (const group of groups) {
    const firstChange = group[0];
    const lastChange = group[group.length - 1];

    const startIdx = Math.max(0, firstChange - contextLines);
    const endIdx = Math.min(lines.length - 1, lastChange + contextLines);

    const hunkLines = lines.slice(startIdx, endIdx + 1);

    const oldStart = hunkLines[0].oldLineNo ?? 1;
    const newStart = hunkLines[0].newLineNo ?? 1;
    const oldCount = hunkLines.filter(
      (l) => l.type === "removed" || l.type === "context",
    ).length;
    const newCount = hunkLines.filter(
      (l) => l.type === "added" || l.type === "context",
    ).length;

    hunks.push({
      oldStart,
      oldCount,
      newStart,
      newCount,
      lines: hunkLines,
    });
  }

  return hunks;
}

export function formatUnifiedDiff(
  oldText: string,
  newText: string,
  oldPath: string = "a/file",
  newPath: string = "b/file",
): string {
  const diffLines = computeLineDiff(oldText, newText);
  const hunks = groupIntoHunks(diffLines);

  if (hunks.length === 0) return "";

  const parts: string[] = [];
  parts.push(`--- ${oldPath}`);
  parts.push(`+++ ${newPath}`);

  for (const hunk of hunks) {
    parts.push(
      `@@ -${hunk.oldStart},${hunk.oldCount} +${hunk.newStart},${hunk.newCount} @@`,
    );
    for (const line of hunk.lines) {
      switch (line.type) {
        case "added":
          parts.push(`+${line.content}`);
          break;
        case "removed":
          parts.push(`-${line.content}`);
          break;
        case "context":
          parts.push(` ${line.content}`);
          break;
      }
    }
  }

  return parts.join("\n");
}

export function computeCharDiff(oldStr: string, newStr: string): CharDiff[] {
  const a = Array.from(oldStr);
  const b = Array.from(newStr);

  const dp = computeLCS(a, b);
  const lcs = backtrackLCS(dp, a, b);

  const result: CharDiff[] = [];
  let oi = 0;
  let ni = 0;

  for (const [matchOi, matchNi] of lcs) {
    if (oi < matchOi) {
      result.push({ type: "removed", value: a.slice(oi, matchOi).join("") });
    }
    if (ni < matchNi) {
      result.push({ type: "added", value: b.slice(ni, matchNi).join("") });
    }
    result.push({ type: "equal", value: a[matchOi] });
    oi = matchOi + 1;
    ni = matchNi + 1;
  }

  if (oi < a.length) {
    result.push({ type: "removed", value: a.slice(oi).join("") });
  }
  if (ni < b.length) {
    result.push({ type: "added", value: b.slice(ni).join("") });
  }

  return mergeCharDiffRuns(result);
}

function mergeCharDiffRuns(diffs: CharDiff[]): CharDiff[] {
  if (diffs.length === 0) return diffs;
  const result: CharDiff[] = [diffs[0]];
  for (let i = 1; i < diffs.length; i++) {
    const last = result[result.length - 1];
    if (last.type === diffs[i].type) {
      last.value += diffs[i].value;
    } else {
      result.push(diffs[i]);
    }
  }
  return result;
}
