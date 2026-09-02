import { readdirSync, readFileSync } from 'node:fs';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';

const SOURCE_ROOT = process.argv[2] ?? 'packages/sim/src';
const BOUNDARY = resolve(SOURCE_ROOT);
const SPECIFIER = /(?:from|import)\s*\(?\s*['"]([^'"]+)['"]/g;

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return entry.name.endsWith('.ts') ? [path] : [];
  });
}

function specifiers(file: string): string[] {
  return [...readFileSync(file, 'utf8').matchAll(SPECIFIER)].map((match) => match[1] as string);
}

function violations(file: string): string[] {
  return specifiers(file).flatMap((specifier) => {
    if (!specifier.startsWith('.')) {
      return [`${file} imports the bare specifier "${specifier}"`];
    }
    const target = relative(BOUNDARY, resolve(dirname(file), specifier));
    if (target.startsWith('..') || isAbsolute(target)) {
      return [`${file} imports "${specifier}", which escapes ${SOURCE_ROOT}`];
    }
    return [];
  });
}

const problems = sourceFiles(SOURCE_ROOT).flatMap(violations);

if (problems.length > 0) {
  for (const problem of problems) console.error(problem);
  console.error('The simulation core imports nothing outside itself.');
  process.exit(1);
}

console.log(`${SOURCE_ROOT} imports nothing outside itself.`);
