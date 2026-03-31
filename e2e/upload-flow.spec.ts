import { test, expect } from "@playwright/test";

function uniqueTitle(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
}

async function createDocumentViaApi(
  request: import("@playwright/test").APIRequestContext,
  title: string,
  content: string
) {
  const response = await request.post("/api/documents", {
    data: {
      title,
      content,
      groupId: null,
    },
  });

  expect(response.ok()).toBeTruthy();
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

  test("can delete a document", async ({ page, request }) => {
    const displayTitle = uniqueTitle("delete me").replaceAll("-", " ");

    await createDocumentViaApi(request, displayTitle, "This will be deleted.");

    await page.goto("/library");

    await expect(
      page.getByRole("heading", { name: displayTitle }).first()
    ).toBeVisible({ timeout: 10000 });

    const card = page.locator(`[data-document-title="${displayTitle}"]`).first();
    await card.getByLabel(/options/i).click();
    await page.getByRole("button", { name: /delete/i }).click();
    await page.getByRole("button", { name: /^delete$/i }).click();

    // Document should be gone
    await expect(
      page.getByRole("heading", { name: displayTitle })
    ).toHaveCount(0);
  });

  test("can search documents", async ({ page, request }) => {
    const alphaTitle = uniqueTitle("alpha book").replaceAll("-", " ");
    const betaTitle = uniqueTitle("beta book").replaceAll("-", " ");

    await createDocumentViaApi(request, alphaTitle, `Content of ${alphaTitle}`);
    await createDocumentViaApi(request, betaTitle, `Content of ${betaTitle}`);

    await page.goto("/library");
    await expect(page.getByRole("heading", { name: alphaTitle }).first()).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole("heading", { name: betaTitle }).first()).toBeVisible({ timeout: 10000 });

    await page.getByPlaceholder(/search/i).fill("alpha");

    // Only alpha should be visible
    await expect(page.getByRole("heading", { name: alphaTitle }).first()).toBeVisible();
    await expect(page.getByRole("heading", { name: betaTitle })).toHaveCount(0);
  });
});
