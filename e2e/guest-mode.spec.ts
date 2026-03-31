import { test, expect } from "@playwright/test";
import { createDocumentViaApi, resetDocuments, uniqueTitle } from "./helpers/auth";

test.describe("Guest Mode", () => {
  test.beforeEach(async ({ request }) => {
    await resetDocuments(request);
  });

  test("guest users can read documents but cannot access upload controls", async ({ page, request }) => {
    const title = uniqueTitle("guest read book").replaceAll("-", " ");

    await createDocumentViaApi(
      request,
      title,
      "Guests can still read this story.\nReading should remain accessible."
    );

    await page.goto("/library");
    await expect(
      page.getByRole("button", { name: /upload a book/i })
    ).toHaveCount(0);
    await expect(
      page.getByRole("heading", { name: title }).first()
    ).toBeVisible({ timeout: 10000 });

    const card = page.locator(`[data-document-title="${title}"]`).first();
    await card.getByRole("button", { name: /read now/i }).click();

    await expect(page).toHaveURL(/\/read\//);
    await expect(page.locator('[data-line-index="0"]').first()).toContainText(
      "Guests can still read this story.",
      { timeout: 10000 }
    );
  });

  test("guest settings stay within the current tab only", async ({ page }) => {
    await page.goto("/settings");

    await expect(
      page.getByText(/guest changes are stored for this tab only/i)
    ).toBeVisible();
    await expect(page.getByText(/text size: 20px/i)).toBeVisible();

    await page.getByRole("button", { name: /^32$/ }).click();
    await expect(page.getByText(/text size: 32px/i)).toBeVisible();

    await page.goto("/library");
    await page.goto("/settings");
    await expect(page.getByText(/text size: 32px/i)).toBeVisible();

    const secondTab = await page.context().newPage();
    await secondTab.goto("/settings");
    await expect(secondTab.getByText(/text size: 20px/i)).toBeVisible();
    await secondTab.close();
  });
});