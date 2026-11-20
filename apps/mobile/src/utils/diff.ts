export interface DiffSegment {
  type: 'equal' | 'insert' | 'delete';
  value: string;
}

/**
 * Tokenizes text into words and whitespace so word-level diffs preserve natural spacing.
 */
function tokenizeWords(text: string): string[] {
  return text.match(/\S+|\s+/g) || [];
}

/**
 * Computes a word-level Longest Common Subsequence (LCS) diff between originalText and revisedText.
 */
export function computeWordDiff(originalText: string, revisedText: string): DiffSegment[] {
  if (originalText === revisedText) {
    return [{ type: 'equal', value: revisedText }];
  }

  const a = tokenizeWords(originalText);
  const b = tokenizeWords(revisedText);
  const n = a.length;
  const m = b.length;

  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));

  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      if (a[i] === b[j]) {
        dp[i][j] = 1 + dp[i + 1][j + 1];
      } else {
        dp[i][j] = Math.max(dp[i + 1][j], dp[i][j + 1]);
      }
    }
  }

  const raw: DiffSegment[] = [];
  let i = 0;
  let j = 0;

  while (i < n && j < m) {
    if (a[i] === b[j]) {
      raw.push({ type: 'equal', value: a[i] });
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      raw.push({ type: 'delete', value: a[i] });
      i++;
    } else {
      raw.push({ type: 'insert', value: b[j] });
      j++;
    }
  }

  while (i < n) {
    raw.push({ type: 'delete', value: a[i++] });
  }
  while (j < m) {
    raw.push({ type: 'insert', value: b[j++] });
  }

  // Merge consecutive segments of the same type for optimal DOM rendering
  const merged: DiffSegment[] = [];
  for (const seg of raw) {
    if (merged.length > 0 && merged[merged.length - 1].type === seg.type) {
      merged[merged.length - 1].value += seg.value;
    } else {
      merged.push({ ...seg });
    }
  }

  return merged;
}
