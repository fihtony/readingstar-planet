import { test, expect } from "@playwright/test";

function uniqueTitle(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
}

async function openDocumentByTitle(
  page: import("@playwright/test").Page,
  title: string
) {
  const card = page.locator(`[data-document-title="${title}"]`).first();

  await expect(card.getByRole("heading", { name: title })).toBeVisible();
  await card.getByRole("link", { name: /read now/i }).click();
}

test.describe("Reading Flow", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("home page loads with planet map", async ({ page }) => {
    await expect(
      page.getByRole("link", { name: /readingstar planet/i })
    ).toBeVisible();
    await expect(
      page.locator('a[href="/library"]').filter({ hasText: "Bookshelf Harbor" }).last()
    ).toBeVisible();
    await expect(page.getByText("Spotlight Island")).toBeVisible();
    await expect(page.getByText("Echo Valley")).toBeVisible();
  });

  test("navigate to library from home", async ({ page }) => {
    await page.getByRole("link", { name: /bookshelf harbor/i }).first().click();
    await expect(page).toHaveURL(/\/library/);
    await expect(
      page.getByRole("heading", { name: /bookshelf harbor/i })
    ).toBeVisible();
  });

  test("library shows upload button", async ({ page }) => {
    await page.goto("/library");
    await expect(
      page.getByRole("button", { name: /upload a book/i })
    ).toBeVisible();
  });

  test("upload zone appears when clicking upload", async ({ page }) => {
    await page.goto("/library");
    await page.click("text=Upload a Book");
    await expect(page.getByText(/choose a file/i).first()).toBeVisible();
  });
});

test.describe("Upload and Read Flow", () => {
  test("can upload a text file and read it", async ({ page }) => {
    const fileBase = uniqueTitle("test-story");
    const displayTitle = fileBase.replaceAll("-", " ");

    await page.goto("/library");
    await page.click("text=Upload a Book");

    // Create a mock text file via fileChooser
    const fileChooser = page.waitForEvent("filechooser");
    await page.getByLabel(/upload|choose|file/i).click();
    const chooser = await fileChooser;
    await chooser.setFiles({
      name: `${fileBase}.txt`,
      mimeType: "text/plain",
      buffer: Buffer.from(
        "The quick brown fox jumps over the lazy dog.\nBad dogs chase balls all day."
      ),
    });

    // Wait for the upload to succeed and document card to appear
    await expect(
      page.getByRole("heading", { name: displayTitle }).first()
    ).toBeVisible({ timeout: 10000 });

    // Navigate to the uploaded book specifically
    await openDocumentByTitle(page, displayTitle);
    await expect(page).toHaveURL(/\/read\//);

    // The reading content should be visible
    await expect(page.locator('[data-line-index="0"]').first()).toContainText(
      "The quick brown fox jumps over the lazy dog.",
      { timeout: 10000 }
    );
  });
});

test.describe("Reading Controls", () => {
  test("keyboard navigation works on read page", async ({ page }) => {
    const fileBase = uniqueTitle("nav-test");
    const displayTitle = fileBase.replaceAll("-", " ");

    // This requires a document to exist — we'll upload one first
    await page.goto("/library");
    await page.click("text=Upload a Book");

    const fileChooser = page.waitForEvent("filechooser");
    await page.getByLabel(/upload|choose|file/i).click();
    const chooser = await fileChooser;
    await chooser.setFiles({
      name: `${fileBase}.txt`,
      mimeType: "text/plain",
      buffer: Buffer.from(
        "Line one of the story.\nLine two of the story.\nLine three of the story."
      ),
    });

    await expect(
      page.getByRole("heading", { name: displayTitle }).first()
    ).toBeVisible({ timeout: 10000 });
    await openDocumentByTitle(page, displayTitle);

    await expect(page.locator('[data-line-index="0"]').first()).toBeVisible({
      timeout: 10000,
    });
    await page.locator('[data-line-index="0"]').first().click();

    // Press down arrow to advance line
    await page.keyboard.press("ArrowDown");

    // Line counter should update (2 / 3)
    await expect(
      page.locator('div[role="status"]').filter({ hasText: /2\s*\/\s*3/ })
    ).toContainText(/2\s*\/\s*3/);
  });
});
