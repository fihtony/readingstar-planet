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
  const payload = await response.json();
  return payload.document as { id: string; title: string };
}

async function openDocumentByTitle(
  page: import("@playwright/test").Page,
  title: string
) {
  const card = page.locator(`[data-document-title="${title}"]`).first();

  await expect(card.getByRole("heading", { name: title })).toBeVisible();
  await card.getByRole("button", { name: /read now/i }).click();
}

test.describe("Reading Flow", () => {
  test.beforeEach(async ({ page, request }) => {
    await resetDocuments(request);
    await page.goto("/");
  });

  test("home page loads with planet map", async ({ page }) => {
    await expect(page).toHaveTitle(/readingstar planet/i);
    await expect(
      page.getByRole("link", { name: /bookshelf harbor/i }).first()
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
  test.beforeEach(async ({ request }) => {
    await resetDocuments(request);
  });

  test("can upload a text file and read it", async ({ page, request }) => {
    const displayTitle = uniqueTitle("test story").replaceAll("-", " ");

    await createDocumentViaApi(
      request,
      displayTitle,
      "The quick brown fox jumps over the lazy dog.\nBad dogs chase balls all day."
    );

    await page.goto("/library");
    await expect(
      page.getByRole("heading", { name: displayTitle }).first()
    ).toBeVisible({ timeout: 10000 });

    await openDocumentByTitle(page, displayTitle);
    await expect(page).toHaveURL(/\/read\//);

    // The reading content should be visible
    await expect(page.locator('[data-line-index="0"]').first()).toContainText(
      "The quick brown fox jumps over the lazy dog.",
      { timeout: 10000 }
    );
  });

  test("counts one read on click, ignores early refresh, and counts refresh after the cooldown", async ({ page, request }) => {
    const displayTitle = uniqueTitle("read count").replaceAll("-", " ");

    await createDocumentViaApi(
      request,
      displayTitle,
      "Short story for read counting."
    );

    await page.goto("/library");
    const card = page.locator(`[data-document-title="${displayTitle}"]`).first();
    await expect(card.getByText(/0 reads/i)).toBeVisible({ timeout: 10000 });

    await card.getByRole("button", { name: /read now/i }).click();
    await expect(page).toHaveURL(/\/read\//);

    await page.goBack();
    await expect(page).toHaveURL(/\/library/);
    await expect(card.getByText(/1 reads/i)).toBeVisible({ timeout: 10000 });

    await card.getByRole("button", { name: /read now/i }).click();
    await expect(page).toHaveURL(/\/read\//);
    await page.reload();
    await page.waitForTimeout(300);
    await page.goto("/library");
    await expect(page).toHaveURL(/\/library/);
    await expect(card.getByText(/2 reads/i)).toBeVisible({ timeout: 10000 });

    await card.getByRole("button", { name: /read now/i }).click();
    await expect(page).toHaveURL(/\/read\//);
    const documentId = page.url().split("/").pop();
    await page.evaluate((id) => {
      if (!id) {
        return;
      }
      window.localStorage.setItem(
        `document-read-counted-at:${id}`,
        String(Date.now() - 31 * 60 * 1000)
      );
    }, documentId);
    const incrementResponse = page.waitForResponse((response) => {
      return response.url().includes("/api/documents")
        && response.request().method() === "PATCH"
        && response.request().postData()?.includes("increment-read-count")
        && response.status() === 200;
    });
    await page.reload();
    await incrementResponse;
    await page.goto("/library");
    await expect(page).toHaveURL(/\/library/);
    await expect(card.getByText(/4 reads/i)).toBeVisible({ timeout: 10000 });
  });
});

test.describe("Reading Controls", () => {
  test.beforeEach(async ({ request }) => {
    await resetDocuments(request);
  });

  test("keyboard navigation works on read page", async ({ page, request }) => {
    const displayTitle = uniqueTitle("nav test").replaceAll("-", " ");

    await createDocumentViaApi(
      request,
      displayTitle,
      "Line one of the story.\nLine two of the story.\nLine three of the story."
    );

    await page.goto("/library");
    await expect(
      page.getByRole("heading", { name: displayTitle }).first()
    ).toBeVisible({ timeout: 10000 });
    await openDocumentByTitle(page, displayTitle);

    await expect(page.locator('[data-line-index="0"]').first()).toBeVisible({
      timeout: 10000,
    });

    // Press down arrow to advance line
    await page.keyboard.press("ArrowDown");

    // Line counter should update (2 / 3)
    await expect(
      page.locator('div[role="status"]').filter({ hasText: /2\s*\/\s*3/ })
    ).toContainText(/2\s*\/\s*3/);
  });
});
