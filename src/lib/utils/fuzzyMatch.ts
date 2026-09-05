/**
 * Utility functions for normalized string comparison and fuzzy name matching.
 */

export function normalizeName(name: string): string {
  if (!name) return "";
  return name.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function levenshteinDistance(a: string, b: string): number {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  const matrix: number[][] = [];

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          Math.min(
            matrix[i][j - 1] + 1, // insertion
            matrix[i - 1][j] + 1 // deletion
          )
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

export function isFuzzyNameMatch(name1: string, name2: string): boolean {
  const norm1 = normalizeName(name1);
  const norm2 = normalizeName(name2);

  if (!norm1 || !norm2) return false;
  if (norm1 === norm2) return true;

  // Substring / nickname match (e.g. "Pea (Megan)" vs "Megan" or "Christopher" vs "Chris")
  if (norm1.length >= 3 && norm2.length >= 3) {
    if (norm1.includes(norm2) || norm2.includes(norm1)) return true;
  }

  const maxLen = Math.max(norm1.length, norm2.length);
  if (maxLen === 0) return true;

  const dist = levenshteinDistance(norm1, norm2);
  if (maxLen <= 4) return dist <= 1;
  if (maxLen <= 8) return dist <= 2;
  return dist <= 3;
}
