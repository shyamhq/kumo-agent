import path from "node:path";
import { expect, type Locator, type Page } from "@playwright/test";
import { expectComposerVisible } from "./composer";
import { openAgentRoute, seedMockAgentWorkspace } from "./mock-agent";

// 32,000 of the mock's 128,000-token window.
const METER_NAME = "Context window 25% used";

export type MockAgentSession = Awaited<ReturnType<typeof seedMockAgentWorkspace>>;

/** An agent a quarter into its context window. */
export function seedAgentWithContextWindow(): Promise<MockAgentSession> {
  return seedMockAgentWorkspace({
    repoPrefix: "context-window-",
    title: "Context window e2e",
    initialPrompt: "emit 32000 byte file agent stream payload",
  });
}

export async function openAgent(page: Page, session: MockAgentSession): Promise<void> {
  await openAgentRoute(page, session);
  await expectComposerVisible(page);
}

/** Wide screens show the meter's details in a hover card while the pointer is on it. */
export async function hoverContextWindowMeter(page: Page, name = METER_NAME): Promise<Locator> {
  await page.getByRole("img", { name, exact: true }).hover({ timeout: 30_000 });
  const card = contextWindowDetails(page);
  await expect(card).toBeVisible();
  await expect(card).toBeInViewport({ ratio: 1 });
  return card;
}

export async function leaveContextWindowMeter(page: Page): Promise<void> {
  await page.mouse.move(0, 0);
  await expect(contextWindowDetails(page)).toHaveCount(0);
}

/** Clicking the meter opens its details in the active layout. */
export async function pressContextWindowMeter(
  page: Page,
  name: string | RegExp = METER_NAME,
): Promise<Locator> {
  await page.getByRole("button", { name, exact: true }).click({ timeout: 30_000 });
  const details = contextWindowDetails(page);
  await expect(details).toBeVisible();
  return details;
}

/** The hover card on wide screens and the sheet on compact ones are both this dialog. */
export function contextWindowDetails(page: Page): Locator {
  return page.getByRole("dialog", { name: "Context window" });
}

/** Set PASEO_QA_SCREENSHOT_DIR to keep a QA screenshot. */
export async function qaScreenshot(page: Page, name: string): Promise<void> {
  const directory = process.env.PASEO_QA_SCREENSHOT_DIR;
  if (!directory) return;
  // Let the sheet and hover card animations settle.
  await page.waitForTimeout(600);
  await page.addStyleTag({ content: ".__expo_fast_refresh { display: none !important; }" });
  await page.screenshot({ path: path.join(directory, `${name}.png`) });
}
