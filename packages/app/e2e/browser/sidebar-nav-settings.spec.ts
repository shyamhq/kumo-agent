import { expect, test } from "../support/fixtures";
import type { Page } from "@playwright/test";
import { openAddProjectFlow, addProjectFlow } from "../support/helpers/add-project-flow";
import { openCompactSidebar, expectCompactSidebarOpen } from "../support/helpers/sidebar";
import { gotoAppShell } from "../support/helpers/app";
import { SHOWCASE_PLUGIN_ID, installSidebarPlugins } from "../support/helpers/plugin-sidebar-items";
import {
  expectFooterIconRow,
  expectFooterSeparator,
  hoverFooterAddProject,
  footerScreenshot,
  expectFooterItemHidden,
  expectFooterOrder,
  expectFooterSettingsKeys,
  expectSidebarItemHidden,
  expectSidebarNavSettingsOrder,
  expectSidebarNavSettingsRow,
  expectSidebarOrder,
  expectStoredSidebarNav,
  leaveSettings,
  moveFooterItemUp,
  moveSidebarNavItemUp,
  openSidebarNavSettings,
  seedSidebarFooterPreferences,
  seedSidebarNavPreferences,
  setFooterItemVisible,
  setSidebarNavItemVisible,
} from "../support/helpers/sidebar-nav-settings";

async function showDeveloperToast(page: Page): Promise<void> {
  await page.evaluate(() => {
    document.getElementById("error-toast")?.remove();
    const toast = document.createElement("div");
    toast.id = "error-toast";
    toast.style.cssText = "position:fixed;inset:0;z-index:2147483647;background:white";
    // Expo renders its unnamed dismiss button in an open shadow root.
    const button = document.createElement("button");
    button.style.cssText = "width:24px;height:24px";
    button.addEventListener("click", () => toast.remove());
    toast.attachShadow({ mode: "open" }).appendChild(button);
    document.body.appendChild(toast);
  });
}

test("developer toasts leave concurrent sidebar layout checks uninterrupted", async ({ page }) => {
  await gotoAppShell(page);
  await showDeveloperToast(page);
  await expectSidebarOrder(page, ["new-workspace", "history", "search", "schedules"]);
  await expect(page.locator("#error-toast")).toBeHidden();
});

test("fixed footer line keeps its four icons, Help and Settings at the end", async ({ page }) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  await gotoAppShell(page);
  await expectFooterIconRow(page);
  await expectFooterSeparator(page, false);
  await footerScreenshot(page, "footer-desktop-without-rows");
  await hoverFooterAddProject(page);
  await footerScreenshot(page, "footer-desktop-add-project-tooltip");
  await openAddProjectFlow(page);
  await page.keyboard.press("Escape");
  await expect(addProjectFlow(page)).toBeHidden();
  // With no plugin footer rows there is nothing to arrange, so Settings shows no Footer card.
  await openSidebarNavSettings(page);
  await expect(page.getByTestId("sidebar-nav-section-footer")).toHaveCount(0);
  await leaveSettings(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await openCompactSidebar(page);
  await expectFooterSeparator(page, false);
  await expectFooterIconRow(page);
  await footerScreenshot(page, "footer-compact-without-rows");
  await page.locator('[data-testid="sidebar-add-project"]:visible').hover();
  await expect(page.getByTestId("sidebar-add-project-tooltip")).toHaveCount(0);
  await footerScreenshot(page, "footer-compact-add-project-hover");
  await openAddProjectFlow(page);
  await page.keyboard.press("Escape");
  await expect(addProjectFlow(page)).toBeHidden();
  await expectCompactSidebarOpen(page);
});

test.describe("Sidebar items in Appearance settings", () => {
  test("owner reorders and hides top-level sidebar items", async ({ page }) => {
    await gotoAppShell(page);

    await test.step("the sidebar starts in the default order", async () => {
      await expectSidebarOrder(page, ["new-workspace", "history", "search", "schedules"]);
      await expect(page.locator('[data-testid="sidebar-nav-separator"]:visible')).toHaveCount(1);
    });

    await test.step("the Sidebar section lists every item in the same order", async () => {
      await openSidebarNavSettings(page);
      // The section explains itself through the header's info tooltip, not a paragraph.
      await expect(page.getByTestId("sidebar-nav-section-header-info")).toHaveAccessibleName(
        "About Header",
      );
      await expectSidebarNavSettingsOrder(page, [
        "new-workspace",
        "history",
        "search",
        "schedules",
      ]);
      await expectSidebarNavSettingsRow(page, {
        key: "history",
        label: "History",
        visible: true,
      });
      // Items with a keyboard shortcut badge it next to their name. Chords render
      // with Ctrl off macOS, which is what the browser project runs on.
      await expect(
        page.getByTestId("sidebar-nav-item-new-workspace").getByText("Ctrl+N", { exact: true }),
      ).toBeVisible();
    });

    await test.step("moving Schedules up twice lifts it above History", async () => {
      await moveSidebarNavItemUp(page, "schedules");
      await expectSidebarNavSettingsOrder(page, [
        "new-workspace",
        "history",
        "schedules",
        "search",
      ]);
      await moveSidebarNavItemUp(page, "schedules");
      await expectSidebarNavSettingsOrder(page, [
        "new-workspace",
        "schedules",
        "history",
        "search",
      ]);

      await leaveSettings(page);
      await expectSidebarOrder(page, ["new-workspace", "schedules", "history", "search"]);
    });

    await test.step("turning History off removes it from the sidebar", async () => {
      await openSidebarNavSettings(page);
      await setSidebarNavItemVisible(page, "history", false);
      await expectStoredSidebarNav(page, [
        { key: "new-workspace", visible: true },
        { key: "schedules", visible: true },
        { key: "history", visible: false },
        { key: "search", visible: true },
      ]);

      await leaveSettings(page);
      await expectSidebarItemHidden(page, "history");
      await expectSidebarOrder(page, ["new-workspace", "schedules", "search"]);
    });

    await test.step("the sidebar keeps that shape across a reload", async () => {
      await page.reload();
      await expectSidebarItemHidden(page, "history");
      await expectSidebarOrder(page, ["new-workspace", "schedules", "search"]);
    });
  });

  test("renders no top-level items when every one is turned off", async ({ page }) => {
    await seedSidebarNavPreferences(page, [
      { key: "new-workspace", visible: false },
      { key: "history", visible: false },
      { key: "search", visible: false },
      { key: "schedules", visible: false },
    ]);
    await gotoAppShell(page);

    // The sidebar itself still renders; only its top-level nav items are gone.
    await expect(page.locator('[data-testid="sidebar-settings"]:visible')).toBeVisible({
      timeout: 30_000,
    });
    await expectSidebarItemHidden(page, "new-workspace");
    await expectSidebarItemHidden(page, "history");
    await expectSidebarItemHidden(page, "search");
    await expectSidebarItemHidden(page, "schedules");
    // Nothing is left above the Workspaces section: no drag strip, no empty divider.
    await expect(page.locator('[data-testid="sidebar-nav-drag-strip"]:visible')).toHaveCount(0);
    await expect(page.locator('[data-testid="sidebar-nav-separator"]:visible')).toHaveCount(0);
  });
});

test.describe("Sidebar footer rows in Appearance settings", () => {
  const syncKey = `plugin:${SHOWCASE_PLUGIN_ID}:sync`;
  const brokenKey = `plugin:${SHOWCASE_PLUGIN_ID}:broken`;
  let cleanup: () => Promise<void>;

  test.beforeEach(async () => {
    ({ cleanup } = await installSidebarPlugins());
  });

  test.afterEach(async () => {
    await cleanup();
  });

  test("owner reorders and hides footer rows; the icon row stays fixed", async ({ page }) => {
    test.setTimeout(120_000);
    // Keys for the fixed footer icon buttons, and the retired Usage item, are ignored.
    await seedSidebarFooterPreferences(page, [
      { key: "usage", visible: true },
      { key: "help", visible: false },
      { key: "hosts", visible: false },
      { key: "import", visible: false },
    ]);
    await gotoAppShell(page);

    await test.step("the Footer card lists only the footer rows", async () => {
      await openSidebarNavSettings(page);
      await expect(page.getByTestId("sidebar-nav-section-footer-info")).toHaveAccessibleName(
        "About Footer",
      );
      await expectFooterSettingsKeys(page, [syncKey, brokenKey]);
      await leaveSettings(page);
      await expectFooterOrder(page, [syncKey]);
      await expectFooterIconRow(page);
      await expectFooterSeparator(page, true);
    });

    await test.step("moving Broken up and hiding Sync changes the rows", async () => {
      await openSidebarNavSettings(page);
      await moveFooterItemUp(page, brokenKey);
      await setFooterItemVisible(page, syncKey, false);
      await expectFooterSettingsKeys(page, [brokenKey, syncKey]);
      await leaveSettings(page);
      await expectFooterItemHidden(page, syncKey);
      await expectFooterIconRow(page);
      await expectFooterSeparator(page, false);
    });

    await test.step("the rows keep that shape across a reload", async () => {
      await page.reload();
      await expectFooterIconRow(page);
      await expectFooterItemHidden(page, syncKey);
      await expectFooterSeparator(page, false);
      await openSidebarNavSettings(page);
      await expectFooterSettingsKeys(page, [brokenKey, syncKey]);
    });
  });
});
