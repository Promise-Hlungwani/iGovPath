import { expect, test } from "@playwright/test";
import { cleanupTestUsers, email, makeOfficer, signUp } from "./helpers";

test.afterAll(cleanupTestUsers);

test("G18: draft without closing date or reference number is flagged for both", async ({ page }) => {
  const o = email("drafter");
  await signUp(page, "Draft Officer", o);
  await makeOfficer(o, "Department of Water and Sanitation");
  await page.goto("/portal/draft-check");
  await page.getByLabel("Draft advert").fill(
    "Finance Clerk. The department seeks a finance clerk at Midmar Dam. Requirements: Grade 12 with Mathematics. " +
      "Applications must be submitted online at https://erecruitment.dws.gov.za. Attach your CV and certified copies. " +
      "Use the new Z83 form. Enquiries: Ms N Dlamini Tel No: (033) 392 1300. The incumbent will be expected to perform such duties as may be assigned from time to time in accordance with operational exigencies.",
  );
  await page.getByRole("button", { name: "Check the draft" }).click();
  const missing = page.getByTestId("missing");
  await expect(missing).toContainText(/closing date/i, { timeout: 90_000 });
  await expect(missing).toContainText(/reference number/i);
});

test("G19: assistant answers from listings and admits what it doesn't know", async ({ page }) => {
  await page.goto("/assistant?q=" + encodeURIComponent("Is there a nursing post at a hospital in Cape Town?"));
  const a = page.getByTestId("answer");
  await expect(a).toBeVisible({ timeout: 90_000 });
  await expect(a).toContainText(/don.t know|do not have|not in|no listing/i);
});
