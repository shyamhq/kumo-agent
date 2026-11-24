import type { Locator } from "@playwright/test";
import { expect, test as base } from "../support/fixtures";
import {
  composerLocator,
  expectComposerVisible,
  submitMessageWithButton,
} from "../support/helpers/composer";
import {
  contextWindowDetails,
  hoverContextWindowMeter,
  leaveContextWindowMeter,
  type MockAgentSession,
  openAgent,
  pressContextWindowMeter,
  qaScreenshot,
  seedAgentWithContextWindow,
} from "../support/helpers/context-window";
import { openAgentRoute, seedMockAgentWorkspace } from "../support/helpers/mock-agent";

const test = base.extend<{ agent: MockAgentSession }>({
  agent: async ({ page: _page }, provide) => {
    const agent = await seedAgentWithContextWindow();
    try {
      await provide(agent);
    } finally {
      await agent.cleanup();
    }
  },
});

// The outer meter owns the accessible label; its SVG is decorative.
async function expectDecorativeContextRing(meter: Locator): Promise<void> {
  const ring = meter.locator("svg");
  await expect(ring).toHaveAttribute("aria-hidden", "true");
  await expect(ring).not.toHaveAttribute("accessibilityElementsHidden");
  await expect(ring).not.toHaveAttribute("importantForAccessibility");
}

// Where the progress arc is painted, as its centroid relative to the ring's centre in pixels.
// Reads the rendered pixels, so any rotation that does not reach the screen counts as none.
async function progressArcCentroid(meter: Locator): Promise<{ x: number; y: number }> {
  const ring = meter.locator("svg");
  const progressColor = await ring
    .locator("circle")
    .last()
    .evaluate((circle) => getComputedStyle(circle).stroke);
  const screenshot = await ring.screenshot();
  return ring.evaluate(
    async (_svg, { png, color }) => {
      const image = await createImageBitmap(
        await (await fetch(`data:image/png;base64,${png}`)).blob(),
      );
      const canvas = new OffscreenCanvas(image.width, image.height);
      const context = canvas.getContext("2d")!;
      context.drawImage(image, 0, 0);
      const { data } = context.getImageData(0, 0, image.width, image.height);
      const [r, g, b] = color.match(/\d+/g)!.map(Number);
      let sumX = 0;
      let sumY = 0;
      let count = 0;
      for (let y = 0; y < image.height; y += 1) {
        for (let x = 0; x < image.width; x += 1) {
          const i = (y * image.width + x) * 4;
          const distance =
            Math.abs(data[i] - r) + Math.abs(data[i + 1] - g) + Math.abs(data[i + 2] - b);
          if (distance < 40) {
            sumX += x;
            sumY += y;
            count += 1;
          }
        }
      }
      if (count === 0) {
        throw new Error(`No pixels painted in the progress colour ${color}`);
      }
      return { x: sumX / count - image.width / 2, y: sumY / count - image.height / 2 };
    },
    { png: screenshot.toString("base64"), color: progressColor },
  );
}

test.describe("context window meter", () => {
  test("draws the used share clockwise from twelve o'clock", async ({ page }) => {
    test.setTimeout(180_000);
    // 32,000 of the mock's 128,000-token window: a quarter, from twelve to three o'clock.
    const session = await seedMockAgentWorkspace({
      repoPrefix: "context-window-meter-",
      title: "Context window meter e2e",
      initialPrompt: "emit 32000 byte file agent stream payload",
    });
    try {
      await openAgentRoute(page, session);
      await expectComposerVisible(page);
      const meter = page.getByTestId("context-window-meter");
      await expect(meter).toHaveAccessibleName(/25%/, { timeout: 30_000 });

      await expectDecorativeContextRing(meter);
      const centroid = await progressArcCentroid(meter);
      expect(centroid.x).toBeGreaterThan(1);
      expect(centroid.y).toBeLessThan(-1);
    } finally {
      await session.cleanup();
    }
  });
});

const DESKTOP = { width: 1440, height: 900 };

test("context details support keyboard entry and dismiss when the viewport moves", async ({
  page,
  agent,
}) => {
  await page.setViewportSize(DESKTOP);
  await openAgent(page, agent);
  await submitMessageWithButton(page, "withhold synthetic user message until interrupted");
  const stop = page.getByRole("button", { name: /stop|cancel/i }).first();
  await expect(stop).toBeVisible();
  const meter = page.getByTestId("context-window-meter");
  const trigger = page.getByRole("button", {
    name: (await meter.getAttribute("aria-label"))!,
    exact: true,
  });
  await expect(trigger).toHaveAttribute("tabindex", "0");
  await trigger.focus();
  const details = contextWindowDetails(page);
  await expect(details).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(details).toHaveCount(0);
  await expect(stop).toBeVisible();
  await expect(trigger).toBeFocused();
  for (const key of ["Enter", " "]) {
    await trigger.press(key);
    await expect(details).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(details).toHaveCount(0);
    await expect(stop).toBeVisible();
    await expect(trigger).toBeFocused();
  }
  await trigger.press("ArrowDown");
  await expect(details).toBeVisible();
  await page.setViewportSize({ width: 1280, height: 850 });
  await expect(details).toHaveCount(0);
});

test("context details stay open while the chat streams", async ({ page }) => {
  test.setTimeout(120_000);
  await page.setViewportSize(DESKTOP);
  const session = await seedMockAgentWorkspace({
    repoPrefix: "context-window-streaming-",
    title: "Context details while streaming",
    model: "ten-second-stream",
  });
  try {
    await openAgentRoute(page, session);
    await expectComposerVisible(page);
    await submitMessageWithButton(page, "Stream while the context details are open.");
    const stop = page.getByRole("button", { name: /stop|cancel/i }).first();
    await expect(stop).toBeVisible();
    const details = await pressContextWindowMeter(page, /^Context window/);
    await expect(stop).toBeVisible();
    await qaScreenshot(page, "context-details-while-streaming");

    await expect(stop).toHaveCount(0, { timeout: 30_000 });
    await expect(details).toBeVisible();
    await qaScreenshot(page, "context-details-after-streaming");
  } finally {
    await session.cleanup();
  }
});

test("pointer hovering context details preserves composer focus", async ({ page, agent }) => {
  await page.setViewportSize(DESKTOP);
  await openAgent(page, agent);
  const input = composerLocator(page);
  await input.focus();
  await hoverContextWindowMeter(page);
  await expect(input).toBeFocused();
  await leaveContextWindowMeter(page);
  await expect(input).toBeFocused();
});

test("Find remains available after dismissing context details", async ({ page, agent }) => {
  await page.setViewportSize(DESKTOP);
  await openAgent(page, agent);
  const meter = page.getByTestId("context-window-meter");
  const trigger = page.getByRole("button", {
    name: (await meter.getAttribute("aria-label"))!,
    exact: true,
  });
  await trigger.focus();
  await expect(contextWindowDetails(page)).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(contextWindowDetails(page)).toHaveCount(0);
  await expect(trigger).toBeFocused();
  await page.keyboard.press("ControlOrMeta+f");
  await expect(page.getByRole("textbox", { name: "Find in pane", exact: true })).toBeFocused();
});
