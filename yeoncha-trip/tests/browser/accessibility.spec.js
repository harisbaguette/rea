import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { mockFlights } from "./fixtures.js";
test("운임 결과·가격 그래프·날짜·안내 접근성", async ({ page }) => {
  await mockFlights(page);
  await page.goto("/");
  await expect(page.locator(".flight-card")).toHaveCount(2);
  const scan = async () => {
    await page.waitForFunction(() =>
      document.getAnimations().every((a) => a.playState === "finished"),
    );
    const result = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    expect(
      result.violations.map((v) => ({
        id: v.id,
        targets: v.nodes.map((n) => n.target),
      })),
    ).toEqual([]);
  };
  await scan();
  for (const opener of [
    '.card-photo-button[data-detail^="ICN-KIX"]',
    "#custom-open",
    "#help-open",
  ]) {
    await page.locator(opener).click();
    if (opener.startsWith(".card"))
      await expect(page.locator("#price-history")).toContainText("회 관측");
    await scan();
    await page.keyboard.press("Escape");
    await expect(page.locator(opener)).toBeFocused();
  }
});
