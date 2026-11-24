import { expect, test } from "../support/fixtures";
import { addProjectFlow } from "../support/helpers/add-project-flow";
import { gotoAppShell } from "../support/helpers/app";
import {
  chooseFooterOverflowAction,
  expectFooterLine,
  expectFooterMenusInsideViewport,
  expectFooterNeverClipped,
  expectFooterOverflowActions,
  openFooterOverflow,
  seedDockedSidebarWidth,
  watchFooterClipping,
} from "../support/helpers/sidebar-footer-overflow";
import { addOfflineHostsAndReload } from "../support/helpers/hosts";
import { openCompactSidebar } from "../support/helpers/sidebar";

const TOUCH_CONTROL = 44;
const MIN_SIDEBAR_WIDTH = 200;
// Four 44pt buttons and the row's padding need 192pt, so the minimum sidebar width holds them all.
const ALL_INLINE = [
  "sidebar-add-project",
  "sidebar-hosts-trigger",
  "sidebar-help",
  "sidebar-settings",
];

test.describe("Sidebar footer on a touch screen", () => {
  test.use({ viewport: { width: 1280, height: 800 }, hasTouch: true });

  test("a minimum-width docked sidebar keeps all four actions inline", async ({ page }) => {
    await seedDockedSidebarWidth(page, MIN_SIDEBAR_WIDTH);
    await watchFooterClipping(page);
    await gotoAppShell(page);
    await expectFooterLine(page, { testIDs: ALL_INLINE, controlSize: TOUCH_CONTROL });
    await expectFooterNeverClipped(page);

    await test.step("Add project and Settings shortcuts still work", async () => {
      await page.keyboard.press("Control+o");
      await expect(addProjectFlow(page)).toBeVisible();
      await page.keyboard.press("Escape");
      await expect(addProjectFlow(page)).toBeHidden();
      await page.keyboard.press("Control+,");
      await expect(page).toHaveURL(/\/settings\/general$/);
    });
  });

  test("the default sidebar width keeps all four actions inline", async ({ page }) => {
    await gotoAppShell(page);
    await expectFooterLine(page, { testIDs: ALL_INLINE, controlSize: TOUCH_CONTROL });
  });
});

test.describe("Sidebar footer in a compact overlay narrower than the footer", () => {
  test.use({ viewport: { width: 220, height: 800 }, hasTouch: true });

  test("the four actions still fit inline", async ({ page }) => {
    await watchFooterClipping(page);
    await gotoAppShell(page);
    await openCompactSidebar(page);
    await expectFooterLine(page, { testIDs: ALL_INLINE, controlSize: TOUCH_CONTROL });
    await expectFooterNeverClipped(page);
  });
});

test.describe("Sidebar footer on a short, narrow phone", () => {
  // 164pt for buttons holds Settings, Add project and the caret, so Hosts moves behind it.
  test.use({ viewport: { width: 180, height: 360 }, hasTouch: true });

  test("the overflow Hosts page scrolls to its last host", async ({ page }) => {
    await gotoAppShell(page);
    await addOfflineHostsAndReload(
      page,
      Array.from({ length: 10 }, (_, index) => ({
        serverId: `overflow-host-${index}`,
        label: `Overflow host ${index}`,
      })),
    );
    await openCompactSidebar(page);
    await expectFooterLine(page, {
      testIDs: ["sidebar-add-project", "sidebar-footer-overflow", "sidebar-settings"],
      controlSize: TOUCH_CONTROL,
    });
    await openFooterOverflow(page);
    await expectFooterOverflowActions(page, ["Hosts", "Help and support"]);
    await expectFooterMenusInsideViewport(page);
    await chooseFooterOverflowAction(page, "Hosts");
    await expectFooterMenusInsideViewport(page);
    const lastHost = page.getByRole("menuitem", { name: "Overflow host 9" });
    await lastHost.scrollIntoViewIfNeeded();
    await expect(lastHost).toBeInViewport();
  });
});
