import { describe, it, expect } from 'vitest';
import {
  computeLineDiff,
  computeCharDiff,
  mergeHunks,
  formatPatch,
  parsePatch,
} from './diff';

describe('diff', () => {
  describe('computeLineDiff - 两段空字符串 diff', () => {
    it('should return empty array for two empty strings', () => {
      const result = computeLineDiff('', '');
      expect(result).toEqual([]);
    });
  });

  describe('computeLineDiff - 完全相同 diff', () => {
    it('should return equal lines for identical content', () => {
      const text = 'line1\nline2\nline3';
      const result = computeLineDiff(text, text);

      expect(result.length).toBe(3);
      expect(result.every((d) => d.type === 'equal')).toBe(true);
      expect(result[0].content).toBe('line1');
      expect(result[1].content).toBe('line2');
      expect(result[2].content).toBe('line3');
    });
  });

  describe('computeLineDiff - 纯新增', () => {
    it('should detect only inserted lines', () => {
      const oldText = 'line1\nline2';
      const newText = 'line1\nline2\nline3\nline4';

      const result = computeLineDiff(oldText, newText);

      const inserts = result.filter((d) => d.type === 'insert');
      const deletes = result.filter((d) => d.type === 'delete');

      expect(inserts.some((d) => d.content === 'line3')).toBe(true);
      expect(inserts.some((d) => d.content === 'line4')).toBe(true);
    });
  });

  describe('computeLineDiff - 纯删除', () => {
    it('should detect only deleted lines', () => {
      const oldText = 'line1\nline2\nline3\nline4';
      const newText = 'line1\nline2';

      const result = computeLineDiff(oldText, newText);

      const deletes = result.filter((d) => d.type === 'delete');

      expect(deletes.some((d) => d.content === 'line3')).toBe(true);
      expect(deletes.some((d) => d.content === 'line4')).toBe(true);
    });
  });

  describe('computeLineDiff - 前后都有修改', () => {
    it('should detect both insertions and deletions', () => {
      const oldText = 'a\nb\nc\nd';
      const newText = 'a\nx\nc\ny';

      const result = computeLineDiff(oldText, newText);

      const inserts = result.filter((d) => d.type === 'insert');
      const deletes = result.filter((d) => d.type === 'delete');
      const equals = result.filter((d) => d.type === 'equal');

      expect(deletes.length).toBe(2);
      expect(inserts.length).toBe(2);
      expect(equals.length).toBe(2);
    });
  });

  describe('computeLineDiff - 含中文内容', () => {
    it('should handle Chinese characters correctly', () => {
      const oldText = '第一行\n第二行\n第三行';
      const newText = '第一行\n修改后的第二行\n第三行\n新增的第四行';

      const result = computeLineDiff(oldText, newText);

      const inserts = result.filter((d) => d.type === 'insert');
      const deletes = result.filter((d) => d.type === 'delete');

      expect(deletes.some((d) => d.content === '第二行')).toBe(true);
      expect(inserts.some((d) => d.content === '修改后的第二行')).toBe(true);
      expect(inserts.some((d) => d.content === '新增的第四行')).toBe(true);
    });
  });

  describe('computeLineDiff - LF/CRLF 换行混用', () => {
    it('should normalize CRLF to LF and compute diff correctly', () => {
      const oldText = 'line1\r\nline2\r\nline3';
      const newText = 'line1\nline2\nmodified';

      const result = computeLineDiff(oldText, newText);

      const deletes = result.filter((d) => d.type === 'delete');
      const inserts = result.filter((d) => d.type === 'insert');

      expect(deletes.some((d) => d.content === 'line3')).toBe(true);
      expect(inserts.some((d) => d.content === 'modified')).toBe(true);
    });
  });

  describe('computeLineDiff - 超长文件（10000 行）', () => {
    it('should handle large files efficiently', () => {
      const oldLines = Array.from({ length: 10000 }, (_, i) => `line ${i + 1}`);
      const newLines = [...oldLines];
      newLines[5000] = 'modified line 5001';
      newLines.splice(7500, 0, 'inserted line');

      const oldText = oldLines.join('\n');
      const newText = newLines.join('\n');

      const startTime = Date.now();
      const result = computeLineDiff(oldText, newText);
      const endTime = Date.now();

      expect(result.length).toBeGreaterThan(0);
      expect(endTime - startTime).toBeLessThan(5000);

      const hasModification = result.some(
        (d) => d.type === 'insert' && d.content === 'modified line 5001'
      );
      const hasInsertion = result.some(
        (d) => d.type === 'insert' && d.content === 'inserted line'
      );

      expect(hasModification).toBe(true);
      expect(hasInsertion).toBe(true);
    });
  });

  describe('computeCharDiff', () => {
    it('should compute character level diff', () => {
      const oldText = 'hello world';
      const newText = 'hello beautiful world';

      const result = computeCharDiff(oldText, newText);

      const inserts = result.filter((d) => d.type === 'insert');
      expect(inserts.length).toBeGreaterThan(0);
      expect(inserts.some((d) => d.content.includes('beautiful'))).toBe(true);
    });

    it('should handle empty strings', () => {
      const result = computeCharDiff('', '');
      expect(result).toEqual([]);
    });
  });

  describe('mergeHunks', () => {
    it('should return empty array for empty diffs', () => {
      const result = mergeHunks([]);
      expect(result).toEqual([]);
    });

    it('should merge nearby changes into single hunk', () => {
      const lineDiffs = computeLineDiff(
        'a\nb\nc\nd\ne\nf\ng\nh',
        'a\nmodified1\nd\ne\nmodified2\ng\nh'
      );

      const hunks = mergeHunks(lineDiffs, 3);
      expect(hunks.length).toBe(1);
    });

    it('should create separate hunks for distant changes', () => {
      const oldLines = Array.from({ length: 50 }, (_, i) => `line ${i + 1}`);
      const newLines = [...oldLines];
      newLines[5] = 'modified 1';
      newLines[40] = 'modified 2';

      const lineDiffs = computeLineDiff(oldLines.join('\n'), newLines.join('\n'));
      const hunks = mergeHunks(lineDiffs, 3);

      expect(hunks.length).toBe(2);
    });
  });

  describe('formatPatch and parsePatch', () => {
    it('should format hunks to patch string', () => {
      const lineDiffs = computeLineDiff('a\nb\nc', 'a\nmodified\nc');
      const hunks = mergeHunks(lineDiffs);
      const patch = formatPatch(hunks);

      expect(patch).toContain('@@');
      expect(patch).toContain('-b');
      expect(patch).toContain('+modified');
    });

    it('should parse patch string back to hunks', () => {
      const patch = `@@ -1,3 +1,3 @@
 a
-b
+modified
 c`;

      const hunks = parsePatch(patch);
      expect(hunks.length).toBe(1);
      expect(hunks[0].oldStart).toBe(1);
      expect(hunks[0].newStart).toBe(1);
      expect(hunks[0].lines.some((l) => l.type === 'delete' && l.content === 'b')).toBe(true);
      expect(hunks[0].lines.some((l) => l.type === 'insert' && l.content === 'modified')).toBe(true);
      expect(hunks[0].lines.some((l) => l.type === 'equal' && l.content === 'a')).toBe(true);
      expect(hunks[0].lines.some((l) => l.type === 'equal' && l.content === 'c')).toBe(true);
    });

    it('should round-trip format and parse', () => {
      const oldText = 'line1\nline2\nline3\nline4\nline5';
      const newText = 'line1\nchanged\nline3\nline4\nadded';

      const lineDiffs = computeLineDiff(oldText, newText);
      const hunks = mergeHunks(lineDiffs);
      const patch = formatPatch(hunks);
      const parsedHunks = parsePatch(patch);

      expect(parsedHunks.length).toBe(hunks.length);
    });
  });
});
