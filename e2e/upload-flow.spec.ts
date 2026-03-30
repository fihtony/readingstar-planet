import { test, expect } from "@playwright/test";

function uniqueTitle(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
}

test.describe("Document Upload Flow", () => {
  test("shows error for unsupported file types", async ({ page }) => {
    await page.goto("/library");
    await page.click("text=Upload a Book");

    const fileChooser = page.waitForEvent("filechooser");
    await page.getByLabel(/upload|choose|file/i).click();
    const chooser = await fileChooser;
    await chooser.setFiles({
      name: "bad-file.exe",
      mimeType: "application/octet-stream",
      buffer: Buffer.from("not a real document"),
    });

    // Should show an error message
    await expect(
      page.locator('div[role="alert"]').filter({ hasText: /unsupported|allowed/i })
    ).toContainText(/unsupported|allowed/i, {
      timeout: 5000,
    });
  });

  test("shows empty state with mascot when no documents", async ({ page, request }) => {
    await page.goto("/library");

    const response = await request.get("/api/documents");
    const payload = await response.json();

    for (const document of payload.documents as Array<{ id: string }>) {
      await request.delete(`/api/documents?id=${document.id}`);
    }

    await page.reload();
    await expect(page.locator('[data-document-card="true"]')).toHaveCount(0);

    // Lumi's encouraging message
    await expect(page.locator('div[role="status"]').first()).toBeVisible();
  });

  test("can delete a document", async ({ page }) => {
    const fileBase = uniqueTitle("delete-me");
    const displayTitle = fileBase.replaceAll("-", " ");

    await page.goto("/library");
    await page.click("text=Upload a Book");

    // Upload a file first
    const fileChooser = page.waitForEvent("filechooser");
    await page.getByLabel(/upload|choose|file/i).click();
    const chooser = await fileChooser;
    await chooser.setFiles({
      name: `${fileBase}.txt`,
      mimeType: "text/plain",
      buffer: Buffer.from("This will be deleted."),
    });

    await expect(
      page.getByRole("heading", { name: displayTitle }).first()
    ).toBeVisible({ timeout: 10000 });

    // Click delete
    await page.getByLabel(new RegExp(`remove ${displayTitle}`, "i")).click();

    // Document should be gone
    await expect(
      page.getByRole("heading", { name: displayTitle })
    ).toHaveCount(0);
  });

  test("can search documents", async ({ page }) => {
    const alphaBase = uniqueTitle("alpha-book");
    const betaBase = uniqueTitle("beta-book");
    const alphaTitle = alphaBase.replaceAll("-", " ");
    const betaTitle = betaBase.replaceAll("-", " ");

    await page.goto("/library");
    await page.click("text=Upload a Book");

    // Upload two files
    for (const name of [`${alphaBase}.txt`, `${betaBase}.txt`]) {
      const fileChooser = page.waitForEvent("filechooser");
      await page.getByLabel(/upload|choose|file/i).click();
      const chooser = await fileChooser;
      await chooser.setFiles({
        name,
        mimeType: "text/plain",
        buffer: Buffer.from(`Content of ${name}`),
      });
      await expect(
        page.getByRole("heading", {
          name: name.replace(".txt", "").replaceAll("-", " "),
        }).first()
      ).toBeVisible({ timeout: 10000 });
    }

    // Close upload and search
    await page.click("text=Close");
    await page.getByPlaceholder(/search/i).fill("alpha");

    // Only alpha should be visible
    await expect(page.getByRole("heading", { name: alphaTitle }).first()).toBeVisible();
    await expect(page.getByRole("heading", { name: betaTitle })).toHaveCount(0);
  });
});
