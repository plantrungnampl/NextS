import type { Locator, Page } from "@playwright/test";

function centerPoint(box: { height: number; width: number; x: number; y: number }) {
  return {
    x: box.x + box.width / 2,
    y: box.y + box.height / 2,
  };
}

export async function dragHandleToTarget(
  page: Page,
  sourceHandle: Locator,
  dropTarget: Locator,
) {
  await sourceHandle.scrollIntoViewIfNeeded();
  await dropTarget.scrollIntoViewIfNeeded();

  const sourceBox = await sourceHandle.boundingBox();
  const targetBox = await dropTarget.boundingBox();

  if (!sourceBox || !targetBox) {
    throw new Error("Could not resolve drag coordinates for DnD interaction.");
  }

  const sourcePoint = centerPoint(sourceBox);
  const targetPoint = centerPoint(targetBox);

  await page.mouse.move(sourcePoint.x, sourcePoint.y);
  await page.mouse.down();
  await page.mouse.move(sourcePoint.x + 18, sourcePoint.y + 18, { steps: 6 });
  await page.mouse.move(targetPoint.x, targetPoint.y, { steps: 16 });
  await page.mouse.up();
}
