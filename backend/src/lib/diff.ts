import { diff_match_patch } from 'diff-match-patch';

const dmp = new diff_match_patch();

export interface LineDiff {
  type: 'equal' | 'insert' | 'delete';
  content: string;
  oldLineNumber?: number;
  newLineNumber?: number;
}

export interface CharDiff {
  type: 'equal' | 'insert' | 'delete';
  content: string;
}

export interface Hunk {
  oldStart: number;
  oldLines: number;
  newStart: number;
  newLines: number;
  lines: LineDiff[];
}

const splitLines = (text: string): string[] => {
  const normalized = text.replace(/\r\n/g, '\n');
  if (normalized === '') return [];
  const lines = normalized.split('\n');
  if (lines[lines.length - 1] === '') {
    lines.pop();
  }
  return lines;
};

export const computeLineDiff = (oldText: string, newText: string): LineDiff[] => {
  const oldLines = splitLines(oldText);
  const newLines = splitLines(newText);

  const a = dmp.diff_linesToChars_(oldText, newText);
  const lineText1 = a.chars1;
  const lineText2 = a.chars2;
  const lineArray = a.lineArray;

  const diffs = dmp.diff_main(lineText1, lineText2, false);
  dmp.diff_charsToLines_(diffs, lineArray);

  const result: LineDiff[] = [];
  let oldLineNum = 1;
  let newLineNum = 1;

  for (const diff of diffs) {
    const type = diff[0] === 0 ? 'equal' : diff[0] === 1 ? 'insert' : 'delete';
    const lines = splitLines(diff[1]);

    for (const line of lines) {
      const lineDiff: LineDiff = {
        type,
        content: line,
      };

      if (type === 'equal' || type === 'delete') {
        lineDiff.oldLineNumber = oldLineNum++;
      }
      if (type === 'equal' || type === 'insert') {
        lineDiff.newLineNumber = newLineNum++;
      }

      result.push(lineDiff);
    }
  }

  return result;
};

export const computeCharDiff = (oldText: string, newText: string): CharDiff[] => {
  const diffs = dmp.diff_main(oldText, newText);
  dmp.diff_cleanupSemantic(diffs);

  return diffs.map((diff) => ({
    type: diff[0] === 0 ? 'equal' : diff[0] === 1 ? 'insert' : 'delete',
    content: diff[1],
  }));
};

export const mergeHunks = (lineDiffs: LineDiff[], contextLines: number = 3): Hunk[] => {
  if (lineDiffs.length === 0) {
    return [];
  }

  const hunks: Hunk[] = [];
  let currentHunk: Hunk | null = null;
  let equalBuffer: LineDiff[] = [];

  const flushEqualBuffer = () => {
    if (!currentHunk) return;

    const toAdd = equalBuffer.slice(0, contextLines);
    currentHunk.lines.push(...toAdd);
    currentHunk.newLines += toAdd.filter((l) => l.type === 'equal').length;
    currentHunk.oldLines += toAdd.filter((l) => l.type === 'equal').length;
    equalBuffer = [];
  };

  const finalizeHunk = () => {
    if (!currentHunk) return;

    if (equalBuffer.length > 0) {
      flushEqualBuffer();
    }

    const firstLine = currentHunk.lines.find((l) => l.oldLineNumber !== undefined || l.newLineNumber !== undefined);
    if (firstLine) {
      currentHunk.oldStart = firstLine.oldLineNumber ?? 1;
      currentHunk.newStart = firstLine.newLineNumber ?? 1;
    }

    hunks.push(currentHunk);
    currentHunk = null;
    equalBuffer = [];
  };

  for (const lineDiff of lineDiffs) {
    if (lineDiff.type === 'equal') {
      if (currentHunk) {
        equalBuffer.push(lineDiff);

        if (equalBuffer.length > contextLines * 2) {
          flushEqualBuffer();
          finalizeHunk();
        }
      }
    } else {
      if (!currentHunk) {
        currentHunk = {
          oldStart: 1,
          oldLines: 0,
          newStart: 1,
          newLines: 0,
          lines: [],
        };

        const startIdx = lineDiffs.indexOf(lineDiff);
        const beforeContext: LineDiff[] = [];
        for (let i = startIdx - 1; i >= 0 && beforeContext.length < contextLines; i--) {
          if (lineDiffs[i].type === 'equal') {
            beforeContext.unshift(lineDiffs[i]);
          } else {
            break;
          }
        }

        currentHunk.lines.push(...beforeContext);
        currentHunk.oldLines += beforeContext.length;
        currentHunk.newLines += beforeContext.length;
      }

      if (equalBuffer.length > 0) {
        flushEqualBuffer();
      }

      currentHunk.lines.push(lineDiff);
      if (lineDiff.type === 'delete') {
        currentHunk.oldLines++;
      } else if (lineDiff.type === 'insert') {
        currentHunk.newLines++;
      }
    }
  }

  if (currentHunk) {
    finalizeHunk();
  }

  return hunks;
};

export const formatPatch = (hunks: Hunk[]): string => {
  const lines: string[] = [];

  for (const hunk of hunks) {
    lines.push(`@@ -${hunk.oldStart},${hunk.oldLines} +${hunk.newStart},${hunk.newLines} @@`);

    for (const line of hunk.lines) {
      const prefix = line.type === 'insert' ? '+' : line.type === 'delete' ? '-' : ' ';
      lines.push(`${prefix}${line.content}`);
    }
  }

  return lines.join('\n');
};

export const parsePatch = (patchText: string): Hunk[] => {
  const lines = patchText.split('\n');
  const hunks: Hunk[] = [];
  let currentHunk: Hunk | null = null;

  const hunkHeaderRegex = /^@@ -(\d+),(\d+) \+(\d+),(\d+) @@/;

  for (const line of lines) {
    const match = line.match(hunkHeaderRegex);
    if (match) {
      if (currentHunk) {
        hunks.push(currentHunk);
      }
      currentHunk = {
        oldStart: parseInt(match[1], 10),
        oldLines: parseInt(match[2], 10),
        newStart: parseInt(match[3], 10),
        newLines: parseInt(match[4], 10),
        lines: [],
      };
    } else if (currentHunk) {
      if (line.startsWith('+')) {
        currentHunk.lines.push({
          type: 'insert',
          content: line.slice(1),
          newLineNumber: currentHunk.newStart + currentHunk.lines.filter((l) => l.type !== 'delete').length,
        });
      } else if (line.startsWith('-')) {
        currentHunk.lines.push({
          type: 'delete',
          content: line.slice(1),
          oldLineNumber: currentHunk.oldStart + currentHunk.lines.filter((l) => l.type !== 'insert').length,
        });
      } else if (line.startsWith(' ')) {
        const idx = currentHunk.lines.length;
        currentHunk.lines.push({
          type: 'equal',
          content: line.slice(1),
          oldLineNumber: currentHunk.oldStart + idx,
          newLineNumber: currentHunk.newStart + idx,
        });
      }
    }
  }

  if (currentHunk) {
    hunks.push(currentHunk);
  }

  return hunks;
};
