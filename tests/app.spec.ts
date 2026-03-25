import { test, expect } from "@playwright/test";
import fs from "fs";
import os from "os";
import path from "path";

test.describe.serial("Chambers Valley Tracker - E2E", () => {
  test("all requested end-to-end flows", async ({ page, context, request }) => {
    // This E2E flow is intentionally long and depends on async client hydration.
    // Raise the timeout above Playwright's default 30s.
    test.setTimeout(180000);
    page.setDefaultTimeout(15000);
    // Ensure DB schema/enums exist before the dashboard (protected Server Components) renders.
    const setupRes = await request.get("/api/setup");
    expect(setupRes.status(), "Expected /api/setup to succeed").toBe(200);
    const setupJson = await setupRes.json().catch(() => null);
    expect(setupJson?.ok).toBe(true);

    const APP_PASSWORD = process.env.APP_PASSWORD;
    expect(APP_PASSWORD, "APP_PASSWORD must be set").toBeTruthy();

    const now = new Date();
    const toISODateLocal = (d: Date) => {
      const pad = (n: number) => String(n).padStart(2, "0");
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    };
    const formatDDMMYYYY = (d: Date) => {
      const pad = (n: number) => String(n).padStart(2, "0");
      return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
    };

    const runId = String(Date.now()).slice(-7);
    const customer1 = {
      name: `E2E Customer ${runId}`,
      phone: "07123 456 789",
      email: `e2e${runId}@example.com`,
      address: `E2E Address ${runId}`,
    };
    const customer2 = {
      name: `E2E Customer 2 ${runId}`,
      phone: "07123 111 222",
      email: `e2e2${runId}@example.com`,
      address: `E2E Address 2 ${runId}`,
    };

    const jobA = {
      jobType: "Hedge Trim",
      description: `Job A description ${runId}`,
      statusLabel: "Completed",
      quote1: "150",
      quote2: "200",
      dateDone: toISODateLocal(now),
    };
    const jobB = {
      jobType: "Garden Clearance",
      description: `Job B description ${runId}`,
      statusLabel: "Quoted",
      quoteAmount: "120",
      dateDone: toISODateLocal(now),
    };

    const followUpDate1 = new Date(now);
    const followUpDate2 = new Date(now);
    followUpDate2.setDate(followUpDate2.getDate() + 7);

    const followUpNote = `Follow-up note ${runId}`;
    const followUpDate1Str = formatDDMMYYYY(followUpDate1);
    const followUpDate2Str = formatDDMMYYYY(followUpDate2);

    const dashboardNote = `Dashboard note ${runId}`;
    const quoteJobDescription = `Quote job description ${runId}`;

    function createTempPng(filename: string, base64: string) {
      const dir = fs.mkdtempSync(path.join(os.tmpdir(), "cvt-playwright-"));
      const p = path.join(dir, filename);
      fs.writeFileSync(p, base64, { encoding: "base64" });
      return p;
    }

    // Tiny 1x1 PNGs. Any image works; we only need Cloudinary + thumbnails + lightbox.
    const pngBase64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+X1lYAAAAASUVORK5CYII=";
    const beforePhotoPath = createTempPng("before.png", pngBase64);
    const afterPhotoPath = createTempPng("after.png", pngBase64);

    async function login() {
      await page.goto("/");
      await expect(page).toHaveURL(/\/login/);

      await page.getByPlaceholder("••••••••").fill(APP_PASSWORD as string);
      await page.getByRole("button", { name: "Sign in" }).click();

      // Cookie is set server-side; verify we're on the dashboard (follow-ups card may be hidden when empty).
      await expect(page.getByRole("link", { name: "Add Job" })).toBeVisible();
      const authCookie = (await context.cookies()).find((c) => c.name === "garden-auth");
      expect(authCookie, "Expected garden-auth cookie").toBeTruthy();
      expect(authCookie?.value).toBe("1");
      await expect(page).toHaveURL(/\/(\?.*)?$/);

    }

    async function goToCustomers() {
      await page.getByRole("button", { name: "Customers" }).click();
      await expect(page.getByText("Customers")).toBeVisible();
    }

    async function addCustomer(c: typeof customer1) {
      await page.getByRole("link", { name: "Add Customer" }).click();
      await expect(page.getByRole("heading", { name: "Add Customer" })).toBeVisible();

      await page.getByLabel("Name").fill(c.name);
      await page.getByLabel("Phone (UK format)").fill(c.phone);
      await page.getByLabel("Email").fill(c.email);
      await page.getByLabel("Address").fill(c.address);

      await page.getByRole("button", { name: "Add Customer" }).click();

      await expect(page.getByRole("heading", { name: c.name })).toBeVisible();
    }

    async function openCustomerDetail(cName: string) {
      const card = page.getByRole("link", { name: `Open customer ${cName}` });
      await expect(card).toBeVisible();
      await card.click();
      await expect(page.getByRole("heading", { name: cName })).toBeVisible();
    }

    async function openAddJob() {
      await page.getByRole("button", { name: "Add Job" }).first().click();
      await expect(page.getByRole("dialog", { name: /Add Job/ })).toBeVisible();
    }

    async function fillJobSheet({
      jobType,
      description,
      statusLabel,
      quoteAmount,
      paid,
      dateDone,
      photos,
    }: {
      jobType: string;
      description: string;
      statusLabel: string;
      quoteAmount: string;
      paid: boolean;
      dateDone: string;
      photos?: { before: string; after: string };
    }) {
      const dialog = page.getByRole("dialog").first();

      // Selectors are stable by order (customer, job type, status).
      const selects = dialog.locator("select");
      await selects.nth(1).selectOption({ label: jobType });
      await selects.nth(2).selectOption({ label: statusLabel });

      await dialog.getByPlaceholder("Add details about the job...").fill(description);
      await dialog.locator('input[type="date"]').fill(dateDone);
      await dialog.locator('input[placeholder^="e.g."]').fill(quoteAmount);

      const checkbox = dialog.locator('input[type="checkbox"]').first();
      await checkbox.setChecked(paid);

      if (photos) {
        await dialog.getByRole("button", { name: "Add photos" }).click();
        const fileInput = dialog.locator('input[type="file"]');
        await fileInput.setInputFiles([photos.before, photos.after]);

        // After upload, each photo draft has 2 radio inputs: before then after.
        // With 2 photos, the 4 radios are: [before1, after1, before2, after2].
        const radios = dialog.locator('input[type="radio"]');
        await expect(radios).toHaveCount(4);
        await radios.nth(3).check(); // set second photo to "after"
      }
    }

    async function saveJob() {
      // "Save job" for add; "Save changes" for edit.
      const btn = page.getByRole("button", { name: /Save (job|changes)/ }).first();
      await expect(btn).toBeVisible();
      await btn.click();
    }

    function jobDetailsLocator(jobType: string) {
      // Job type appears inside the <summary> of the correct job <details>.
      return page.locator("details").filter({ has: page.locator("summary").filter({ hasText: jobType }) });
    }

    async function verifyJobInHistory(jobType: string, quoteAmount: string) {
      const jobDetails = jobDetailsLocator(jobType).first();
      await expect(jobDetails).toBeVisible({ timeout: 30000 });
      await expect(jobDetails).toContainText(jobType);
      await expect(jobDetails).toContainText(`£${Number(quoteAmount).toFixed(2)}`);
    }

    async function expandJob(jobType: string) {
      const jobDetails = jobDetailsLocator(jobType).first();
      await jobDetails.locator("summary").click();
    }

    async function addJobBWithPhotos() {
      await page.getByRole("button", { name: "Add Job" }).first().click();
      const dialog = page.getByRole("dialog", { name: /Add Job/ }).first();
      await expect(dialog).toBeVisible();

      await dialog.locator("select").nth(1).selectOption({ label: jobB.jobType });
      await dialog.locator("select").nth(2).selectOption({ label: jobB.statusLabel });
      await dialog.getByPlaceholder("Add details about the job...").fill(jobB.description);
      await dialog.locator('input[type="date"]').fill(jobB.dateDone);
      await dialog.locator('input[placeholder^="e.g."]').fill(jobB.quoteAmount);

      const checkbox = dialog.locator('input[type="checkbox"]').first();
      await checkbox.setChecked(false);

      await dialog.getByRole("button", { name: "Add photos" }).click();
      const fileInput = dialog.locator('input[type="file"]');
      await fileInput.setInputFiles([beforePhotoPath, afterPhotoPath]);

      const radios = dialog.locator('input[type="radio"]');
      await expect(radios).toHaveCount(4);
      await radios.nth(3).check();

      await saveJob();
      await expect(page.getByRole("dialog", { name: /Add Job/ })).toBeHidden();
      await verifyJobInHistory(jobB.jobType, jobB.quoteAmount);
    }

    // 1) Auth
    await login();

    // 2) Add customer
    await goToCustomers();
    await addCustomer(customer1);
    await goToCustomers();
    await expect(page.getByRole("link", { name: `Open customer ${customer1.name}` })).toBeVisible();

    // 3) Add job
    await openCustomerDetail(customer1.name);
    await openAddJob();
    await fillJobSheet({
      jobType: jobA.jobType,
      description: jobA.description,
      statusLabel: jobA.statusLabel,
      quoteAmount: jobA.quote1,
      paid: false,
      dateDone: jobA.dateDone,
    });
    await saveJob();
    await expect(page.getByRole("dialog", { name: /Add Job/ })).toBeHidden();
    await verifyJobInHistory(jobA.jobType, jobA.quote1);

    // 4) Edit job
    // Clicking the job <summary> only expands the job details; "Edit" opens the edit sheet (via `edit_job_id`).
    const jobDetailsForEdit = jobDetailsLocator(jobA.jobType).first();
    await jobDetailsForEdit.getByRole("button", { name: "Edit" }).click();
    await expect(page.getByRole("dialog", { name: /Edit Job/ })).toBeVisible({ timeout: 30000 });

    const editDialog = page.getByRole("dialog", { name: /Edit Job/ }).first();
    // AddJobSheet hydrates edit data asynchronously; wait until the job type is correct
    // (otherwise the form submits the default "Lawn Mow").
    const editSelects = editDialog.locator("select");
    // Select order is stable: customer, job type, status.
    await expect(editSelects.nth(1)).toHaveValue(jobA.jobType, { timeout: 30000 });
    await editDialog.locator('input[placeholder^="e.g."]').fill(jobA.quote2);
    await saveJob();
    await expect(editDialog).toBeHidden();
    await verifyJobInHistory(jobA.jobType, jobA.quote2);

    // 5) Mark as paid
    const markPaidBtn = jobDetailsLocator(jobA.jobType).first().getByRole("button", { name: "Mark as paid" });
    await expect(markPaidBtn).toHaveCount(1);
    await markPaidBtn.first().scrollIntoViewIfNeeded();
    await markPaidBtn.first().click({ timeout: 30000 });
    await expect(jobDetailsLocator(jobA.jobType).first().getByText("Paid ✓")).toBeVisible({ timeout: 30000 });

    // 6) Delete job
    const deleteJobBtn = jobDetailsLocator(jobA.jobType).first().getByRole("button", { name: "Delete" });
    await expect(deleteJobBtn).toHaveCount(1);
    await deleteJobBtn.first().scrollIntoViewIfNeeded();
    let deleteJobDialogMessage = "";
    page.once("dialog", async (dialog) => {
      deleteJobDialogMessage = dialog.message();
      await dialog.accept();
    });
    await deleteJobBtn.first().click({ timeout: 30000 });
    expect(deleteJobDialogMessage).toContain("Delete this job?");

    await expect(jobDetailsLocator(jobA.jobType)).toHaveCount(0);

    // Setup for remaining flows: add a quoted job with photos that we will keep.
    await addJobBWithPhotos();

    // 7) Follow-up
    await page.getByLabel("Follow-up date").fill(toISODateLocal(followUpDate1));
    await page.getByPlaceholder("What should we do next?").fill(followUpNote);
    await page.getByRole("button", { name: "Save follow-up" }).click();

    await expect(page.getByText(`Due ${followUpDate1Str}`)).toBeVisible();

    // Verify on dashboard
    await page.getByRole("button", { name: "Dashboard" }).click();
    await expect(page.getByRole("heading", { name: customer1.name })).toBeVisible();
    await expect(page.getByText(`Due: ${followUpDate1Str}`).first()).toBeVisible();

    // 8) Edit follow-up
    await page.getByRole("button", { name: "Customers" }).click();
    await openCustomerDetail(customer1.name);

    const due1Text = page.getByText(`Due ${followUpDate1Str}`);
    const followUpCard = due1Text.locator('xpath=ancestor::div[contains(@class,"rounded-2xl")][1]');
    await followUpCard.getByRole("button", { name: "Edit" }).click();

    await page.getByLabel("Follow-up date").fill(toISODateLocal(followUpDate2));
    await page.getByPlaceholder("What should we do next?").fill(`${followUpNote} (edited)`);
    await page.getByRole("button", { name: "Update follow-up" }).click();

    await expect(page.getByText(`Due ${followUpDate2Str}`)).toBeVisible();

    // 9) Delete follow-up
    const due2Text = page.getByText(`Due ${followUpDate2Str}`);
    const followUpCard2 = due2Text.locator('xpath=ancestor::div[contains(@class,"rounded-2xl")][1]');
    let deleteFollowUpDialogMessage = "";
    page.once("dialog", async (dialog) => {
      deleteFollowUpDialogMessage = dialog.message();
      await dialog.accept();
    });
    await followUpCard2.getByRole("button", { name: "Delete" }).click();
    expect(deleteFollowUpDialogMessage).toContain("Delete this follow-up?");

    await expect(page.getByText("No follow-ups yet.")).toBeVisible();

    // 10) Dashboard notes
    await page.getByRole("button", { name: "Dashboard" }).click();
    const notesCard = page.getByText(/Today's Notes/i).first().locator('xpath=ancestor::div[contains(@class,"rounded-2xl")][1]');
    const notesArea = notesCard.locator("textarea").first();
    await notesArea.fill(dashboardNote);
    const saveBtn = notesCard.getByRole("button", { name: "Save" });
    const saveResponse = page.waitForResponse(
      (r) => r.url().includes("/api/dashboard-notes") && r.request().method() === "PUT"
    );
    await saveBtn.click();
    const resp = await saveResponse;
    expect(resp.ok()).toBeTruthy();

    await page.reload();
    const notesAreaAfter = page.getByText(/Today's Notes/i).first().locator('xpath=ancestor::div[contains(@class,"rounded-2xl")][1]').locator("textarea").first();
    await expect(notesAreaAfter).toHaveValue(dashboardNote, { timeout: 30000 });

    // 11) Earnings
    await page.getByRole("button", { name: "Earnings" }).click();
    await expect(page.getByText("This month")).toBeVisible();
    await expect(page.getByText(/Year-to-date/i)).toBeVisible();

    const thisMonthCard = page.getByText("This month").first().locator('xpath=ancestor::div[contains(@class,"rounded-2xl")][1]');
    await expect(thisMonthCard.getByText(/£\d/)).toBeVisible();
    const ytdCard = page.getByText(/Year-to-date/i).first().locator('xpath=ancestor::div[contains(@class,"rounded-2xl")][1]');
    await expect(ytdCard.getByText(/£\d/)).toBeVisible();

    // 12) Quote generator
    await page.getByRole("button", { name: "Customers" }).click();
    // Quote generator is driven by the `quote=1` URL param (more reliable than tapping the bottom-nav overlay).
    await page.goto("/customers?quote=1");

    const quoteDialog = page.getByRole("dialog", { name: "Quote generator" }).first();
    await expect(quoteDialog).toBeVisible();
    await quoteDialog.locator("select").first().selectOption({ label: customer1.name });
    await quoteDialog.getByPlaceholder("Describe the job...").fill(quoteJobDescription);
    await quoteDialog.getByPlaceholder("Item 1").fill(`Line item description ${runId}`);
    await quoteDialog.getByPlaceholder("0.00").fill("50");

    await quoteDialog.getByRole("button", { name: "Save quote" }).click();
    await expect(quoteDialog.getByRole("button", { name: "Send via WhatsApp" })).toBeVisible();
    await expect(quoteDialog.getByRole("button", { name: "Download as PDF" })).toBeVisible();
    // Two "Close" buttons exist: the backdrop (aria-label="Close") and the actual "Close" button.
    // Click the actual button by index.
    await quoteDialog.getByRole("button", { name: "Close" }).nth(1).click();
    await expect(quoteDialog).toBeHidden();

    // 13) Customer tags (add Regular)
    await page.getByRole("button", { name: "Customers" }).click();
    await openCustomerDetail(customer1.name);

    const contactCard = page.getByText("Contact details").first().locator('xpath=ancestor::div[contains(@class,"rounded-2xl")][1]');
    await contactCard.getByRole("button", { name: "Edit" }).click();
    await contactCard.getByRole("button", { name: "Regular" }).click();
    await contactCard.getByRole("button", { name: "Save contact" }).click();

    await goToCustomers();
    const customer1Card = page.getByRole("link", { name: `Open customer ${customer1.name}` });
    await expect(customer1Card.getByText("Regular")).toBeVisible();

    // Create a second customer without Regular, to validate filtering.
    await page.getByRole("link", { name: "Add Customer" }).click();
    await page.getByRole("heading", { name: "Add Customer" }).waitFor();
    await page.getByLabel("Name").fill(customer2.name);
    await page.getByLabel("Phone (UK format)").fill(customer2.phone);
    await page.getByLabel("Email").fill(customer2.email);
    await page.getByLabel("Address").fill(customer2.address);
    await page.getByRole("button", { name: "Add Customer" }).click();
    await expect(page.getByRole("heading", { name: customer2.name })).toBeVisible();
    await goToCustomers();

    // 14) Tag filtering
    const tagsFilterCard = page.getByText("Filter by tags").first().locator('xpath=ancestor::div[contains(@class,"rounded-2xl")][1]');
    await tagsFilterCard.getByRole("button", { name: "Regular" }).click();

    await expect(page.getByRole("link", { name: `Open customer ${customer1.name}` })).toBeVisible();
    await expect(page.getByRole("link", { name: `Open customer ${customer2.name}` })).toHaveCount(0);

    // 15) Job status filter - Quoted
    const statusFilterCard = page.getByText("Filter jobs by status").first().locator('xpath=ancestor::div[contains(@class,"rounded-2xl")][1]');
    await statusFilterCard.getByRole("button", { name: "Quoted" }).click();

    await expect(page.getByText(jobB.jobType).first()).toBeVisible();
    await expect(page.getByText(/quoted/i).first()).toBeVisible();

    // Return to All customers list
    await statusFilterCard.getByRole("button", { name: "All" }).click();
    await expect(page.getByRole("heading", { name: "Customers" })).toBeVisible();

    // 16) Full screen photo viewer
    await openCustomerDetail(customer1.name);
    const jobDetailsB = jobDetailsLocator(jobB.jobType);
    await jobDetailsB.locator("summary").click(); // expand details to show thumbnails
    await jobDetailsB.getByRole("button", { name: "Open before photo" }).click();

    const closeBtn = page.getByRole("button", { name: "Close photo viewer" });
    await expect(closeBtn).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(closeBtn).toBeHidden({ timeout: 30000 });
  });
});

