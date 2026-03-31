import { test, expect } from "@playwright/test";
import { loginPageAs, loginPageAsAdmin } from "./helpers/auth";

test.describe("Auth Flow", () => {
  test("guest header shows the Google sign-in entry point", async ({ page }) => {
    await page.goto("/library");

    await expect(
      page.getByRole("button", { name: /sign in with google/i })
    ).toBeVisible();
    await expect(page.getByText(/offline mode/i)).toHaveCount(0);
  });

  test("regular user login updates the header and logout returns to guest mode", async ({ page }) => {
    await loginPageAs(page, {
      email: "reader.e2e@example.com",
      role: "user",
      status: "active",
      name: "Reader User",
      nickname: "Reader",
    });

    await page.goto("/library");
    await expect(page.getByRole("button", { name: /account menu/i })).toBeVisible();
    await expect(
      page.getByRole("button", { name: /account menu/i })
    ).not.toContainText(/admin/i);

    await page.getByRole("button", { name: /account menu/i }).click();
    await expect(page.getByText(/user management/i)).toHaveCount(0);
    await page.getByRole("button", { name: /logout/i }).click();

    await expect(
      page.getByRole("button", { name: /sign in with google/i })
    ).toBeVisible();
  });

  test("admin login shows the admin badge and user management entry", async ({ page }) => {
    await loginPageAsAdmin(page, {
      email: "admin-header.e2e@example.com",
      name: "Admin Header",
      nickname: "Admin Header",
    });

    await page.goto("/library");
    const accountMenu = page.getByRole("button", { name: /account menu/i });
    await expect(accountMenu).toBeVisible();
    await expect(accountMenu).toContainText(/admin/i);
    await accountMenu.click();
    await expect(page.getByText(/user management/i)).toBeVisible();
  });
});