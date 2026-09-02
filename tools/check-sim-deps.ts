import { readFileSync } from 'node:fs';

const MANIFEST = process.argv[2] ?? 'packages/sim/package.json';
const FORBIDDEN_FIELDS = [
  'dependencies',
  'devDependencies',
  'peerDependencies',
  'optionalDependencies',
] as const;

function violations(manifest: Record<string, unknown>): string[] {
  return FORBIDDEN_FIELDS.flatMap((field) => {
    const value = manifest[field];
    if (field === 'dependencies' && value === undefined) {
      return [`${MANIFEST} must declare an empty "dependencies" object`];
    }
    if (value === undefined) return [];
    const names = Object.keys(value as Record<string, unknown>);
    if (names.length === 0) return [];
    return [`${MANIFEST} declares "${field}": ${names.join(', ')}`];
  });
}

const manifest = JSON.parse(readFileSync(MANIFEST, 'utf8')) as Record<string, unknown>;
const problems = violations(manifest);

if (problems.length > 0) {
  for (const problem of problems) console.error(problem);
  console.error('The simulation core must stay dependency-free.');
  process.exit(1);
}

console.log(`${MANIFEST} is dependency-free.`);
