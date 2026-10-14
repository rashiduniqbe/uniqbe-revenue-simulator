import ExcelJS from "exceljs";
import { expect, test } from "./fixtures";

// Opt-in: needs the admin password, and (because production login refuses to run
// without a shared rate-limit store) Upstash credentials, e.g. from .env.local.
// Each run spends one login attempt per project against the 10-per-15-minute limit,
// so wrong-password behaviour is covered by unit tests, not here.
const PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? "";
const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
// Far-future date so the upload is always newer than the committed price list.
const FILE_NAME = "Uniqbe Reseller Quotation 29991231.xlsx";

async function workbookBuffer(): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Pricelist");
  sheet.addRow(["ProductCode", "Brand", "Product Name", "Category", "USD", "HKD"]);
  sheet.addRow(["ZZ99901", "E2E", "E2E Test Tablet 128GB", "Tablet", 150, 1170]);
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

test.describe("admin price list upload", () => {
  test.skip(PASSWORD === "", "set E2E_ADMIN_PASSWORD to run the admin flow");
  test.describe.configure({ mode: "serial" });

  test("guards /admin, previews an upload, and signs out", async ({ page }) => {
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/admin\/login$/);

    await page.getByLabel("Admin password").fill(PASSWORD);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.getByRole("heading", { name: "Price list upload" })).toBeVisible();

    await page.getByLabel("Reseller price list (.xlsx)").setInputFiles({
      name: "prices.xlsx",
      mimeType: XLSX_MIME,
      buffer: await workbookBuffer(),
    });
    await page.getByRole("button", { name: "Preview changes" }).click();
    // Next's route announcer also has role="alert", so scope to the error box by its content.
    await expect(page.getByRole("alert").filter({ hasText: "can’t be used" })).toContainText(
      "Uniqbe Reseller Quotation YYYYMMDD.xlsx",
    );

    await page.getByLabel("Reseller price list (.xlsx)").setInputFiles({
      name: FILE_NAME,
      mimeType: XLSX_MIME,
      buffer: await workbookBuffer(),
    });
    await page.getByRole("button", { name: "Preview changes" }).click();
    await expect(page.getByText("2999-12-31")).toBeVisible();
    await expect(page.getByText(/1 added/)).toBeVisible();

    await page.getByRole("button", { name: "Sign out" }).click();
    await expect(page).toHaveURL(/\/admin\/login$/);
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/admin\/login$/);
  });
});
