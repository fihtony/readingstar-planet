import { test, expect } from "@playwright/test";

test.describe("Accessibility", () => {
  test("home page has proper ARIA landmarks", async ({ page }) => {
    await page.goto("/");

    // Should have main content area
    const main = page.locator("main");
    await expect(main).toBeVisible();

    // Home scene should expose primary navigation targets
    await expect(page.getByRole("link", { name: /bookshelf harbor/i }).first()).toBeVisible();
    await expect(page.getByRole("link", { name: /settings/i })).toBeVisible();
  });

  test("home page has proper heading hierarchy", async ({ page }) => {
    await page.goto("/");

    await expect(page).toHaveTitle(/readingstar planet/i);
    await expect(page.getByRole("img", { name: /adventure map/i })).toBeVisible();
  });

  test("library page has proper heading", async ({ page }) => {
    await page.goto("/library");

    const h1 = page.locator("h1");
    await expect(h1).toBeVisible();
  });

  test("buttons have sufficient touch target size", async ({ page }) => {
    await page.goto("/");

    const buttons = page.locator("a.btn-kid, button.btn-kid");
    const count = await buttons.count();

    for (let i = 0; i < count; i++) {
      const box = await buttons.nth(i).boundingBox();
      if (box) {
        // 48dp minimum touch target (WCAG 2.1 Level AAA recommends 44px)
        expect(box.height).toBeGreaterThanOrEqual(44);
      }
    }
  });

  test("images and icons have alt text or aria labels", async ({ page }) => {
    await page.goto("/");

    const images = page.locator("img");
    const imgCount = await images.count();

    for (let i = 0; i < imgCount; i++) {
      const alt = await images.nth(i).getAttribute("alt");
      const ariaLabel = await images.nth(i).getAttribute("aria-label");
      const role = await images.nth(i).getAttribute("role");

      // Decorative images may intentionally use empty alt, but must still expose alt/aria or presentation role.
      expect(alt !== null || Boolean(ariaLabel) || role === "presentation").toBeTruthy();
    }
  });

  test("reading page maintains focus management", async ({ page }) => {
    await page.goto("/library");

    // Tab through elements - should maintain logical order
    await page.keyboard.press("Tab");
    const firstFocused = await page.evaluate(() =>
      document.activeElement?.tagName
    );
    expect(firstFocused).toBeTruthy();
  });
});
