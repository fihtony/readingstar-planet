import { test, expect } from "@playwright/test";
import { loginApiAs, loginPageAsAdmin, uniqueTitle } from "./helpers/auth";

test.describe("Admin User Management", () => {
  test("admin can create, suspend, restore, and force logout a user", async ({ page, request }) => {
    const userEmail = `${uniqueTitle("managed-user")}@example.com`;

    await loginPageAsAdmin(page, {
      email: "admin-manage.e2e@example.com",
      name: "Admin Manager",
      nickname: "Admin Manager",
    });
    await page.goto("/admin/users");

    await page.getByRole("button", { name: /add user/i }).click();
    const addUserDialog = page.getByRole("heading", { name: /add user/i }).locator("..");
    await page.getByPlaceholder("user@example.com").fill(userEmail);
    await addUserDialog.locator("textarea").fill("Needs close reading support");
    await page.getByRole("button", { name: /create user/i }).click();

    const row = page.locator("tr", { has: page.getByText(userEmail) }).first();
    await expect(row).toBeVisible();
    await expect(row.getByText(/pending_verification/i)).toBeVisible();

    await loginApiAs(request, {
      email: userEmail,
      role: "user",
      status: "active",
      name: "Managed User",
      nickname: "Managed User",
    });
    await expect((await request.get("/api/auth/me")).ok()).toBeTruthy();

    await page.reload();
    await expect(row.getByText(/active/i)).toBeVisible();

    await row.getByRole("button", { name: /suspend/i }).click();
    await page.getByRole("button", { name: /^confirm$/i }).click();
    await expect(row.getByText(/inactive/i)).toBeVisible();

    const suspendedAuth = await request.get("/api/auth/me");
    const suspendedBody = await suspendedAuth.json();
    expect(suspendedBody.user).toBeNull();

    await row.getByRole("button", { name: /restore/i }).click();
    await page.getByRole("button", { name: /^confirm$/i }).click();
    await expect(row.getByText(/active/i)).toBeVisible();

    await loginApiAs(request, {
      email: userEmail,
      role: "user",
      status: "active",
      name: "Managed User",
      nickname: "Managed User",
    });
    const restoredAuth = await request.get("/api/auth/me");
    const restoredBody = await restoredAuth.json();
    expect(restoredBody.user?.email).toBe(userEmail);

    await row.getByRole("button", { name: /^logout$/i }).click();
    await page.getByRole("button", { name: /^confirm$/i }).click();

    const loggedOutAuth = await request.get("/api/auth/me");
    const loggedOutBody = await loggedOutAuth.json();
    expect(loggedOutBody.user).toBeNull();
  });
});