import { inflateSync } from 'node:zlib';

import { expect, test, type Locator, type Page } from '@playwright/test';

const SMOKE_SEED = 12648430;
const MOUNT_TIMEOUT_MS = 20_000;
const PNG_SIGNATURE_BYTES = 8;
const PNG_CHUNK_FRAME_BYTES = 12;
const MIN_DISTINCT_SCANLINE_BYTES = 16;
const MAX_DIFF_PIXEL_RATIO = 0.01;

const SURFACES = [
  { scene: 'port', surface: 'the iso port scene' },
  { scene: 'deck', surface: 'the ship deck' },
  { scene: 'puzzle', surface: 'the bilging puzzle board' },
  { scene: 'battle', surface: 'the battle grid' },
] as const;

function inflatedScanlinesOf(png: Buffer): Buffer {
  const compressed: Buffer[] = [];
  let offset = PNG_SIGNATURE_BYTES;
  while (offset + PNG_SIGNATURE_BYTES <= png.length) {
    const length = png.readUInt32BE(offset);
    const chunk = png.toString('ascii', offset + 4, offset + 8);
    if (chunk === 'IDAT') compressed.push(png.subarray(offset + 8, offset + 8 + length));
    offset += length + PNG_CHUNK_FRAME_BYTES;
  }
  return inflateSync(Buffer.concat(compressed));
}

function distinctByteCount(data: Buffer): number {
  const seen = new Set<number>();
  for (const value of data) seen.add(value);
  return seen.size;
}

async function openScene(page: Page, scene: string): Promise<Locator> {
  const root = page.locator('html');
  const settled = page.locator('html[data-render-ready], html[data-render-error]');
  await page.goto(`/?seed=${SMOKE_SEED}&scene=${scene}`);

  await expect(
    settled,
    `the app never signalled render:ready nor a render error for ?scene=${scene}`,
  ).toBeAttached({ timeout: MOUNT_TIMEOUT_MS });

  const failure = await root.getAttribute('data-render-error');
  if (failure !== null) throw new Error(`the app failed to mount ?scene=${scene}: ${failure}`);

  await expect(
    root,
    `the view did not honour ?scene=${scene}; data-render-scene names what it presented instead`,
  ).toHaveAttribute('data-render-scene', scene);

  return page.locator('#stage canvas').first();
}

for (const { scene, surface } of SURFACES) {
  test(`${surface} draws on seed ${SMOKE_SEED}`, async ({ page }) => {
    const canvas = await openScene(page, scene);

    await expect(canvas, `${surface} rendered no canvas`).toBeVisible();

    const box = await canvas.boundingBox();
    if (box === null) throw new Error(`${surface} rendered a canvas with no layout box`);
    expect(box.width, `${surface} rendered a zero-width canvas`).toBeGreaterThan(0);
    expect(box.height, `${surface} rendered a zero-height canvas`).toBeGreaterThan(0);

    const painted = await canvas.screenshot();
    expect(
      distinctByteCount(inflatedScanlinesOf(painted)),
      `${surface} rendered a flat, featureless canvas`,
    ).toBeGreaterThan(MIN_DISTINCT_SCANLINE_BYTES);

    await expect(page).toHaveScreenshot(`${scene}.png`, {
      maxDiffPixelRatio: MAX_DIFF_PIXEL_RATIO,
    });
  });
}
