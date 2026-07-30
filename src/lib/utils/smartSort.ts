/**
 * Smart sort comparator for values that may be numeric strings.
 * When both values are numeric, sorts them as numbers (3 < 10 < 22).
 * Otherwise falls back to string comparison.
 * Nulls/blanks are always sorted to the end.
 */
export function smartCompare(a: any, b: any, direction: "asc" | "desc" = "asc"): number {
  const aStr = a == null ? "" : String(a).trim();
  const bStr = b == null ? "" : String(b).trim();

  // Push blanks/nulls to the end regardless of direction
  if (!aStr && !bStr) return 0;
  if (!aStr) return 1;
  if (!bStr) return -1;

  const aNum = Number(aStr);
  const bNum = Number(bStr);
  const aIsNum = !isNaN(aNum) && aStr !== "";
  const bIsNum = !isNaN(bNum) && bStr !== "";

  let result: number;

  if (aIsNum && bIsNum) {
    // Both are numeric — sort numerically
    result = aNum - bNum;
  } else {
    // Fallback to string comparison
    result = aStr.localeCompare(bStr, undefined, { numeric: true, sensitivity: "base" });
  }

  return direction === "desc" ? -result : result;
}
