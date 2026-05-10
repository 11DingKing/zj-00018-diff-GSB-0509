import { describe, it, expect } from "vitest";
import {
  computeLineDiff,
  computeCharDiff,
  groupIntoHunks,
  formatUnifiedDiff,
} from "../lib/diff";

describe("diff: two empty strings", () => {
  it("returns empty result for both empty strings", () => {
    const result = computeLineDiff("", "");
    expect(result).toEqual([]);
  });

  it("returns empty hunks for both empty strings", () => {
    const hunks = groupIntoHunks(computeLineDiff("", ""));
    expect(hunks).toEqual([]);
  });

  it("returns empty unified diff for both empty strings", () => {
    const output = formatUnifiedDiff("", "");
    expect(output).toBe("");
  });
});

describe("diff: identical content", () => {
  it("returns only context lines", () => {
    const text = "line1\nline2\nline3";
    const result = computeLineDiff(text, text);
    expect(result.every((l) => l.type === "context")).toBe(true);
    expect(result.length).toBe(3);
    expect(result[0].content).toBe("line1");
    expect(result[1].content).toBe("line2");
    expect(result[2].content).toBe("line3");
  });

  it("returns empty unified diff for identical content", () => {
    const text = "line1\nline2\nline3";
    const output = formatUnifiedDiff(text, text);
    expect(output).toBe("");
  });
});

describe("diff: pure addition", () => {
  it("marks all new lines as added", () => {
    const result = computeLineDiff("", "a\nb\nc");
    expect(result.length).toBe(3);
    expect(result.every((l) => l.type === "added")).toBe(true);
    expect(result[0].content).toBe("a");
    expect(result[1].content).toBe("b");
    expect(result[2].content).toBe("c");
  });

  it("produces correct unified diff for pure addition", () => {
    const output = formatUnifiedDiff("", "hello\nworld", "a/old", "b/new");
    expect(output).toContain("+++ b/new");
    expect(output).toContain("+hello");
    expect(output).toContain("+world");
  });
});

describe("diff: pure deletion", () => {
  it("marks all old lines as removed", () => {
    const result = computeLineDiff("x\ny\nz", "");
    expect(result.length).toBe(3);
    expect(result.every((l) => l.type === "removed")).toBe(true);
    expect(result[0].content).toBe("x");
    expect(result[1].content).toBe("y");
    expect(result[2].content).toBe("z");
  });

  it("produces correct unified diff for pure deletion", () => {
    const output = formatUnifiedDiff("foo\nbar", "", "a/old", "b/new");
    expect(output).toContain("--- a/old");
    expect(output).toContain("-foo");
    expect(output).toContain("-bar");
  });
});

describe("diff: mixed additions and deletions", () => {
  it("correctly identifies added and removed lines", () => {
    const oldText = "line1\nline2\nline3";
    const newText = "line1\nmodified\nline3\nline4";
    const result = computeLineDiff(oldText, newText);

    const removed = result.filter((l) => l.type === "removed");
    const added = result.filter((l) => l.type === "added");
    const context = result.filter((l) => l.type === "context");

    expect(removed.length).toBe(1);
    expect(removed[0].content).toBe("line2");
    expect(added.length).toBe(2);
    expect(added[0].content).toBe("modified");
    expect(added[1].content).toBe("line4");
    expect(context.length).toBe(2);
    expect(context[0].content).toBe("line1");
    expect(context[1].content).toBe("line3");
  });

  it("produces unified diff with correct hunk header", () => {
    const output = formatUnifiedDiff("a\nb\nc", "a\nd\nc\ne");
    expect(output).toContain("@@");
    expect(output).toContain("-b");
    expect(output).toContain("+d");
    expect(output).toContain("+e");
  });
});

describe("diff: Chinese content", () => {
  it("correctly diffs Chinese text", () => {
    const oldText = "你好世界\n第二行";
    const newText = "你好宇宙\n第二行";
    const result = computeLineDiff(oldText, newText);

    const removed = result.filter((l) => l.type === "removed");
    const added = result.filter((l) => l.type === "added");
    const context = result.filter((l) => l.type === "context");

    expect(removed.length).toBe(1);
    expect(removed[0].content).toBe("你好世界");
    expect(added.length).toBe(1);
    expect(added[0].content).toBe("你好宇宙");
    expect(context.length).toBe(1);
    expect(context[0].content).toBe("第二行");
  });

  it("char diff works with Chinese characters", () => {
    const result = computeCharDiff("你好世界", "你好宇宙");
    expect(result).toEqual([
      { type: "equal", value: "你好" },
      { type: "removed", value: "世界" },
      { type: "added", value: "宇宙" },
    ]);
  });
});

describe("diff: LF/CRLF mixed line endings", () => {
  it("handles LF endings correctly", () => {
    const oldText = "line1\nline2\nline3";
    const newText = "line1\nline2\nline4";
    const result = computeLineDiff(oldText, newText);
    const removed = result.filter((l) => l.type === "removed");
    const added = result.filter((l) => l.type === "added");
    expect(removed[0].content).toBe("line3");
    expect(added[0].content).toBe("line4");
  });

  it("handles CRLF endings correctly", () => {
    const oldText = "line1\r\nline2\r\nline3";
    const newText = "line1\r\nline2\r\nline4";
    const result = computeLineDiff(oldText, newText);
    const removed = result.filter((l) => l.type === "removed");
    const added = result.filter((l) => l.type === "added");
    expect(removed[0].content).toBe("line3");
    expect(added[0].content).toBe("line4");
  });

  it("handles mixed LF and CRLF", () => {
    const oldText = "line1\r\nline2\nline3";
    const newText = "line1\r\nline2\nline4";
    const result = computeLineDiff(oldText, newText);
    const removed = result.filter((l) => l.type === "removed");
    const added = result.filter((l) => l.type === "added");
    expect(removed[0].content).toBe("line3");
    expect(added[0].content).toBe("line4");
  });
});

describe("diff: large file (10000 lines)", () => {
  it("handles 10000 line files", () => {
    const oldLines = Array.from({ length: 10000 }, (_, i) => `line ${i}`);
    const newLines = oldLines.slice();
    newLines[5000] = "modified line 5000";
    newLines.push("new line 10000");

    const oldText = oldLines.join("\n");
    const newText = newLines.join("\n");

    const result = computeLineDiff(oldText, newText);
    const removed = result.filter((l) => l.type === "removed");
    const added = result.filter((l) => l.type === "added");
    const context = result.filter((l) => l.type === "context");

    expect(removed.length).toBe(1);
    expect(removed[0].content).toBe("line 5000");
    expect(added.length).toBe(2);
    expect(added[0].content).toBe("modified line 5000");
    expect(added[1].content).toBe("new line 10000");
    expect(context.length).toBe(9999);
  });

  it("groups 10000 line diff into hunks", () => {
    const oldLines = Array.from({ length: 10000 }, (_, i) => `line ${i}`);
    const newLines = oldLines.slice();
    newLines[100] = "changed";
    newLines[9000] = "changed2";

    const result = computeLineDiff(oldLines.join("\n"), newLines.join("\n"));
    const hunks = groupIntoHunks(result);

    expect(hunks.length).toBe(2);
  });
});

describe("computeCharDiff", () => {
  it("returns empty for identical strings", () => {
    const result = computeCharDiff("abc", "abc");
    expect(result).toEqual([{ type: "equal", value: "abc" }]);
  });

  it("detects character-level additions", () => {
    const result = computeCharDiff("abc", "abcde");
    expect(result).toContainEqual({ type: "added", value: "de" });
  });

  it("detects character-level deletions", () => {
    const result = computeCharDiff("abcde", "abc");
    expect(result).toContainEqual({ type: "removed", value: "de" });
  });

  it("handles completely different strings", () => {
    const result = computeCharDiff("abc", "xyz");
    expect(result.some((d) => d.type === "removed")).toBe(true);
    expect(result.some((d) => d.type === "added")).toBe(true);
  });
});

describe("groupIntoHunks", () => {
  it("returns empty for no changes", () => {
    const lines = [
      { type: "context" as const, content: "a", oldLineNo: 1, newLineNo: 1 },
      { type: "context" as const, content: "b", oldLineNo: 2, newLineNo: 2 },
    ];
    const hunks = groupIntoHunks(lines);
    expect(hunks).toEqual([]);
  });

  it("merges close changes into a single hunk", () => {
    const lines = [
      { type: "context" as const, content: "a", oldLineNo: 1, newLineNo: 1 },
      { type: "removed" as const, content: "b", oldLineNo: 2 },
      { type: "added" as const, content: "B", newLineNo: 2 },
      { type: "context" as const, content: "c", oldLineNo: 3, newLineNo: 3 },
      { type: "removed" as const, content: "d", oldLineNo: 4 },
      { type: "added" as const, content: "D", newLineNo: 4 },
      { type: "context" as const, content: "e", oldLineNo: 5, newLineNo: 5 },
    ];
    const hunks = groupIntoHunks(lines, 3);
    expect(hunks.length).toBe(1);
  });

  it("separates distant changes into different hunks", () => {
    const lines: Array<{
      type: "context" | "added" | "removed";
      content: string;
      oldLineNo?: number;
      newLineNo?: number;
    }> = [];
    for (let i = 1; i <= 20; i++) {
      lines.push({
        type: "context",
        content: `line${i}`,
        oldLineNo: i,
        newLineNo: i,
      });
    }
    lines[2] = { type: "removed", content: "line3", oldLineNo: 3 };
    lines.splice(3, 0, { type: "added", content: "LINE3", newLineNo: 3 });
    lines[18] = { type: "removed", content: "line17", oldLineNo: 17 };
    lines.splice(19, 0, { type: "added", content: "LINE17", newLineNo: 17 });

    const hunks = groupIntoHunks(lines, 3);
    expect(hunks.length).toBe(2);
  });
});
