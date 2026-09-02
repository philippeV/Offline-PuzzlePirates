import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';

const VIEW_ROOT = process.argv[2] ?? 'packages/view/src';
const UPSTREAM_ROOTS = (process.argv[3] ?? 'packages/sim/src,packages/harness/src').split(',');

const SIM_PACKAGE = '@opp/sim';
const VIEW_PACKAGES = ['@opp/view', '@opp/app'];
const FACADE_DIRECTORY = 'client';
const SPECIFIER = /(?:from|import)\s*\(?\s*['"]([^'"]+)['"]/g;

function sourceFiles(directory: string): string[] {
  if (!existsSync(directory)) return [];
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return entry.name.endsWith('.ts') ? [path] : [];
  });
}

function specifiers(file: string): string[] {
  return [...readFileSync(file, 'utf8').matchAll(SPECIFIER)].map((match) => match[1] as string);
}

function insideFacade(file: string): boolean {
  return relative(resolve(VIEW_ROOT), resolve(file)).split(sep).includes(FACADE_DIRECTORY);
}

function facadeViolations(file: string): string[] {
  if (insideFacade(file)) return [];
  return specifiers(file)
    .filter((specifier) => specifier === SIM_PACKAGE || specifier.startsWith(`${SIM_PACKAGE}/`))
    .map((specifier) => `${file} reaches past the client facade to "${specifier}"`);
}

function upstreamViolations(file: string): string[] {
  return specifiers(file)
    .filter((specifier) => VIEW_PACKAGES.some((name) => specifier.startsWith(name)))
    .map((specifier) => `${file} imports the view as "${specifier}"`);
}

const problems = [
  ...sourceFiles(VIEW_ROOT).flatMap(facadeViolations),
  ...UPSTREAM_ROOTS.flatMap((root) => sourceFiles(root).flatMap(upstreamViolations)),
];

if (problems.length > 0) {
  for (const problem of problems) console.error(problem);
  console.error('The view reaches the simulation only through its client facade.');
  process.exit(1);
}

console.log(`${VIEW_ROOT} reaches the simulation only through its client facade.`);
