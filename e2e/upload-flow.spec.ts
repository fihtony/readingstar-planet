import { test, expect } from "@playwright/test";

function uniqueTitle(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
}

async function resetDocuments(
  request: import("@playwright/test").APIRequestContext
) {
  const response = await request.get("/api/documents");
  expect(response.ok()).toBeTruthy();

  const payload = await response.json();
  for (const document of payload.documents as Array<{ id: string }>) {
    const deleteResponse = await request.delete(`/api/documents?id=${document.id}`);
    expect(deleteResponse.ok()).toBeTruthy();
  }
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
  test.beforeEach(async ({ request }) => {
    await resetDocuments(request);
  });

  test("file picker restricts accepted file types", async ({ page }) => {
    await page.goto("/library");
    await page.getByRole("button", { name: /upload a book/i }).click();

    await expect(page.locator('input[type="file"]')).toHaveAttribute(
      "accept",
      ".pdf,.txt"
    );
    await expect(page.getByText(/supported: pdf, txt/i)).toBeVisible();
  });

  test("shows empty state with mascot when no documents", async ({ page }) => {
    await page.goto("/library");
    await expect(page.locator('[data-document-card="true"]')).toHaveCount(0);

    // Lumi's encouraging message
    await expect(page.locator('div[role="status"]').first()).toBeVisible();
  });

  test("can import pasted text with preview, edits, and group selection", async ({ page, request }) => {
    const groupName = uniqueTitle("science club").replaceAll("-", " ");
    const finalTitle = uniqueTitle("matter notes").replaceAll("-", " ");

    const groupResponse = await request.post("/api/document-groups", {
      data: { name: groupName },
    });
    expect(groupResponse.ok()).toBeTruthy();

    await page.goto("/library");
    await page.getByRole("button", { name: /upload a book/i }).click();
    await page.getByRole("button", { name: /paste text/i }).click();

    await page.getByLabel(/title/i).fill("Draft title");
    await page.getByLabel(/^content$/i).fill("Matter is anything that has mass and takes up space.");
    await page.getByRole("button", { name: /preview & edit/i }).click();

    await expect(page.getByRole("heading", { name: /preview & edit before import/i })).toBeVisible();
    await page.getByLabel(/title/i).fill(finalTitle);
    await page.getByLabel(/add to group/i).selectOption({ label: groupName });
    await page.getByRole("button", { name: /import book/i }).click();

    const groupSection = page.locator("section", {
      has: page.getByRole("heading", { name: groupName }),
    });

    await expect(
      groupSection.getByRole("heading", { name: finalTitle }).first()
    ).toBeVisible({ timeout: 10000 });
  });

  test("can import a txt file through the preview flow", async ({ page }) => {
    const fileBase = uniqueTitle("preview file");
    const displayTitle = fileBase.replaceAll("-", " ");

    await page.goto("/library");
    await page.getByRole("button", { name: /upload a book/i }).click();

    await page.locator('input[type="file"]').setInputFiles({
      name: `${fileBase}.txt`,
      mimeType: "text/plain",
      buffer: Buffer.from("Preview upload flow text file."),
    });

    await expect(page.getByRole("heading", { name: /preview & edit before import/i })).toBeVisible({
      timeout: 10000,
    });
    await expect(page.getByLabel(/title/i)).toHaveValue(displayTitle);

    await page.getByRole("button", { name: /import book/i }).click();
    await expect(
      page.getByRole("heading", { name: displayTitle }).first()
    ).toBeVisible({ timeout: 10000 });
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
