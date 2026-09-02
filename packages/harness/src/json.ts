export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function deepEquals(left: unknown, right: unknown): boolean {
  if (left === right) return true;
  if (Array.isArray(left) && Array.isArray(right)) return elementsEqual(left, right);
  if (isRecord(left) && isRecord(right)) return membersEqual(left, right);
  return false;
}

function elementsEqual(left: unknown[], right: unknown[]): boolean {
  if (left.length !== right.length) return false;
  return left.every((item, index) => deepEquals(item, right[index]));
}

function membersEqual(left: Record<string, unknown>, right: Record<string, unknown>): boolean {
  const keys = Object.keys(left);
  if (keys.length !== Object.keys(right).length) return false;
  return keys.every((key) => key in right && deepEquals(left[key], right[key]));
}
