import { describe, it, expect } from 'vitest';
import {
  lineDiff,
  charDiff,
  groupIntoHunks,
  hunkToUnified,
  diffToUnified,
  getDiffStats,
  LineDiff,
} from '../lib/diff';

describe('diff library', () => {
  describe('lineDiff', () => {
    it('两段空字符串 diff', () => {
      const result = lineDiff('', '');
      expect(result).toEqual([]);
    });

    it('完全相同 diff', () => {
      const oldStr = 'line1\nline2\nline3';
      const newStr = 'line1\nline2\nline3';
      const result = lineDiff(oldStr, newStr);

      expect(result.length).toBe(3);
      expect(result.every((d) => d.operation === 'equal')).toBe(true);
      expect(result[0].oldLineNumber).toBe(1);
      expect(result[0].newLineNumber).toBe(1);
      expect(result[2].oldLineNumber).toBe(3);
      expect(result[2].newLineNumber).toBe(3);
    });

    it('纯新增', () => {
      const oldStr = 'line1\nline2';
      const newStr = 'line1\nline2\nline3\nline4';
      const result = lineDiff(oldStr, newStr);

      expect(result.length).toBe(4);
      expect(result[0].operation).toBe('equal');
      expect(result[1].operation).toBe('equal');
      expect(result[2].operation).toBe('insert');
      expect(result[2].content).toBe('line3');
      expect(result[3].operation).toBe('insert');
      expect(result[3].content).toBe('line4');
    });

    it('纯删除', () => {
      const oldStr = 'line1\nline2\nline3\nline4';
      const newStr = 'line1\nline2';
      const result = lineDiff(oldStr, newStr);

      expect(result.length).toBe(4);
      expect(result[0].operation).toBe('equal');
      expect(result[1].operation).toBe('equal');
      expect(result[2].operation).toBe('delete');
      expect(result[2].content).toBe('line3');
      expect(result[3].operation).toBe('delete');
      expect(result[3].content).toBe('line4');
    });

    it('前后都有修改', () => {
      const oldStr = 'line1\nline2\nline3\nline4\nline5';
      const newStr = 'line1\nmodified\nline3\nchanged\nline5';
      const result = lineDiff(oldStr, newStr);

      const operations = result.map((d) => d.operation);
      expect(operations).toContain('equal');
      expect(operations).toContain('insert');
      expect(operations).toContain('delete');

      const stats = getDiffStats(result);
      expect(stats.insertions).toBeGreaterThan(0);
      expect(stats.deletions).toBeGreaterThan(0);
    });

    it('含中文内容', () => {
      const oldStr = '第一行\n第二行\n第三行';
      const newStr = '第一行\n修改后的第二行\n第三行\n新增第四行';
      const result = lineDiff(oldStr, newStr);

      const operations = result.map((d) => d.operation);
      expect(operations).toEqual(['equal', 'delete', 'insert', 'equal', 'insert']);

      const deleteLine = result.find((d) => d.operation === 'delete');
      expect(deleteLine?.content).toBe('第二行');

      const insertLines = result.filter((d) => d.operation === 'insert');
      expect(insertLines[0].content).toBe('修改后的第二行');
      expect(insertLines[1].content).toBe('新增第四行');
    });

    it('LF/CRLF 换行混用', () => {
      const oldStr = 'line1\r\nline2\r\nline3';
      const newStr = 'line1\nline2\nmodified\nline3';
      const result = lineDiff(oldStr, newStr);

      const operations = result.map((d) => d.operation);
      expect(operations).toContain('insert');
      expect(result.some((d) => d.content === 'modified')).toBe(true);
    });

    it('超长文件（10000 行）', () => {
      const oldLines = Array.from({ length: 10000 }, (_, i) => `line${i + 1}`);
      const newLines = [...oldLines];
      newLines[5000] = 'modified line 5001';
      newLines.splice(8000, 0, 'inserted at 8001');
      newLines.splice(2000, 1);

      const oldStr = oldLines.join('\n');
      const newStr = newLines.join('\n');

      const start = Date.now();
      const result = lineDiff(oldStr, newStr);
      const duration = Date.now() - start;

      expect(result.length).toBeGreaterThan(0);
      expect(duration).toBeLessThan(5000);

      const stats = getDiffStats(result);
      expect(stats.insertions).toBeGreaterThanOrEqual(1);
      expect(stats.deletions).toBeGreaterThanOrEqual(1);
    });
  });

  describe('charDiff', () => {
    it('should compute character-level diff', () => {
      const result = charDiff('hello', 'hallo');
      const operations = result.map((d) => d.operation);

      expect(operations).toContain('delete');
      expect(operations).toContain('insert');
      expect(result.filter((d) => d.operation === 'equal').length).toBeGreaterThan(0);
    });

    it('empty strings', () => {
      const result = charDiff('', '');
      expect(result).toEqual([]);
    });

    it('identical strings', () => {
      const result = charDiff('test', 'test');
      expect(result.length).toBe(4);
      expect(result.every((d) => d.operation === 'equal')).toBe(true);
    });
  });

  describe('groupIntoHunks', () => {
    it('should return empty array for no changes', () => {
      const diffs: LineDiff[] = [
        { operation: 'equal', content: 'a', oldLineNumber: 1, newLineNumber: 1 },
        { operation: 'equal', content: 'b', oldLineNumber: 2, newLineNumber: 2 },
      ];
      const result = groupIntoHunks(diffs);
      expect(result).toEqual([]);
    });

    it('should group single change with context', () => {
      const diffs: LineDiff[] = [
        { operation: 'equal', content: '1', oldLineNumber: 1, newLineNumber: 1 },
        { operation: 'equal', content: '2', oldLineNumber: 2, newLineNumber: 2 },
        { operation: 'equal', content: '3', oldLineNumber: 3, newLineNumber: 3 },
        { operation: 'delete', content: 'x', oldLineNumber: 4, newLineNumber: null },
        { operation: 'equal', content: '5', oldLineNumber: 5, newLineNumber: 4 },
        { operation: 'equal', content: '6', oldLineNumber: 6, newLineNumber: 5 },
        { operation: 'equal', content: '7', oldLineNumber: 7, newLineNumber: 6 },
      ];
      const result = groupIntoHunks(diffs, 2);
      expect(result.length).toBe(1);
      expect(result[0].lines.some((l) => l.operation === 'delete')).toBe(true);
    });

    it('should merge nearby changes into single hunk', () => {
      const diffs: LineDiff[] = [];
      for (let i = 1; i <= 10; i++) {
        diffs.push({ operation: 'equal', content: `l${i}`, oldLineNumber: i, newLineNumber: i });
      }
      diffs[3] = { operation: 'delete', content: 'del1', oldLineNumber: 4, newLineNumber: null };
      diffs[6] = { operation: 'insert', content: 'ins1', oldLineNumber: null, newLineNumber: 7 };

      const result = groupIntoHunks(diffs, 2);
      expect(result.length).toBe(1);
    });

    it('should separate distant changes into multiple hunks', () => {
      const diffs: LineDiff[] = [];
      for (let i = 1; i <= 20; i++) {
        diffs.push({ operation: 'equal', content: `l${i}`, oldLineNumber: i, newLineNumber: i });
      }
      diffs[2] = { operation: 'delete', content: 'del1', oldLineNumber: 3, newLineNumber: null };
      diffs[17] = { operation: 'insert', content: 'ins1', oldLineNumber: null, newLineNumber: 18 };

      const result = groupIntoHunks(diffs, 2);
      expect(result.length).toBe(2);
    });

    it('empty diffs array', () => {
      const result = groupIntoHunks([]);
      expect(result).toEqual([]);
    });
  });

  describe('hunkToUnified', () => {
    it('should format hunk as unified diff', () => {
      const hunk = {
        oldStart: 1,
        oldLines: 3,
        newStart: 1,
        newLines: 4,
        lines: [
          { operation: 'equal', content: 'line1', oldLineNumber: 1, newLineNumber: 1 },
          { operation: 'delete', content: 'old', oldLineNumber: 2, newLineNumber: null },
          { operation: 'insert', content: 'new1', oldLineNumber: null, newLineNumber: 2 },
          { operation: 'insert', content: 'new2', oldLineNumber: null, newLineNumber: 3 },
          { operation: 'equal', content: 'line3', oldLineNumber: 3, newLineNumber: 4 },
        ],
      };
      const result = hunkToUnified(hunk);
      expect(result).toContain('@@ -1,3 +1,4 @@');
      expect(result).toContain(' line1');
      expect(result).toContain('-old');
      expect(result).toContain('+new1');
      expect(result).toContain('+new2');
      expect(result).toContain(' line3');
    });
  });

  describe('diffToUnified', () => {
    it('should produce unified diff for changes', () => {
      const oldStr = 'line1\nline2\nline3';
      const newStr = 'line1\nmodified\nline3\nline4';
      const result = diffToUnified(oldStr, newStr);

      expect(result).toContain('@@');
      expect(result).toContain('+modified');
      expect(result).toContain('-line2');
      expect(result).toContain('+line4');
    });

    it('should return empty string for identical content', () => {
      const oldStr = 'line1\nline2';
      const newStr = 'line1\nline2';
      const result = diffToUnified(oldStr, newStr);
      expect(result).toBe('');
    });
  });

  describe('getDiffStats', () => {
    it('should count insertions and deletions', () => {
      const diffs: LineDiff[] = [
        { operation: 'equal', content: 'a', oldLineNumber: 1, newLineNumber: 1 },
        { operation: 'insert', content: 'b', oldLineNumber: null, newLineNumber: 2 },
        { operation: 'insert', content: 'c', oldLineNumber: null, newLineNumber: 3 },
        { operation: 'delete', content: 'd', oldLineNumber: 2, newLineNumber: null },
      ];
      const stats = getDiffStats(diffs);
      expect(stats.insertions).toBe(2);
      expect(stats.deletions).toBe(1);
    });

    it('should return zeros for empty diffs', () => {
      const stats = getDiffStats([]);
      expect(stats).toEqual({ insertions: 0, deletions: 0 });
    });
  });
});
