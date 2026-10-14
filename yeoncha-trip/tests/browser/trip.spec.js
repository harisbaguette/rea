import { test, expect } from "@playwright/test";
import { mockFlights } from "./fixtures.js";

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date("2026-10-14T03:00:00Z"));
  await mockFlights(page);
  await page.goto("/");
  await expect(page.locator(".flight-card")).toHaveCount(2);
});
test("연휴 안의 실제 응답 요금·판매처 비교·가격 그래프", async ({ page }) => {
  await expect(page.locator("#selected-window")).toContainText(
    "연차 2일로, 최대 9일",
  );
  await expect(page.locator(".flight-card").first()).toContainText("210,000");
  await page
    .getByRole("button", { name: "오사카 항공권 상세 보기", exact: true })
    .click();
  await expect(page.locator("#detail-dialog .seller-row")).toHaveCount(2);
  await expect(page.locator("#price-history")).toContainText("3회 관측");
  await expect(
    page.locator("#detail-dialog .seller-row").first(),
  ).toHaveAttribute(
    "href",
    /origin=ICN.*code=KIX.*start=2027-09-13.*end=2027-09-15/,
  );
  await expect(page.locator("#detail-dialog")).toContainText("한국 도착일");
});
test("공항·연차·월 변경이 실제 조회 조건과 결과에 반영", async ({ page }) => {
  await page.getByLabel("출발 공항", { exact: true }).selectOption("PUS");
  await expect(page.locator(".flight-card").first()).toContainText("190,000");
  await page
    .getByRole("button", { name: "연차 최대 0일", exact: true })
    .click();
  await expect(page.locator("#selected-window")).toContainText(
    "연차 0일로, 최대 4일",
  );
  await page.locator(".preference-disclosure > summary").click();
  await page.getByLabel("최소 숙박일").selectOption("1");
  await page.locator(".month-picker > summary").click();
  await page
    .getByRole("button", { name: "12월, 최대 3일 여행", exact: true })
    .click();
  await expect(page.locator(".flight-card").first()).toContainText("12.25");
  await page
    .getByRole("button", { name: "오사카 항공권 상세 보기", exact: true })
    .click();
  await expect(
    page.locator("#detail-dialog .seller-row").first(),
  ).toHaveAttribute("href", /start=2027-12-25.*end=2027-12-26/);
});
test("예산·지역 빈 결과에서 복구하고 저렴한 항공권 필터 적용", async ({
  page,
}) => {
  await page.getByLabel("1인 왕복 예산").selectOption("200000");
  await page.getByRole("button", { name: "바다", exact: true }).click();
  await expect(page.locator("#flight-grid")).toContainText(
    "조건에 맞는 항공권이 없어요",
  );
  await page.getByRole("button", { name: "여행지 필터 초기화" }).click();
  await expect(page.locator(".flight-card")).toHaveCount(2);
  await page.getByLabel("노선 평균보다 저렴한 항공권만").check();
  await expect(page.locator(".flight-card")).toHaveCount(1);
});
test("저장·재방문·현재 운임 다시 조회·삭제", async ({ page }) => {
  await page
    .getByRole("button", { name: "오사카 여행 저장", exact: true })
    .click();
  await expect(page.locator("#saved-count")).toHaveText("1");
  await page.reload();
  await page.locator("#nav-saved").click();
  await expect(page.locator(".saved-card")).toHaveCount(1);
  await page
    .getByRole("button", { name: "현재 운임 조회", exact: true })
    .click();
  await expect(page.locator("#detail-dialog")).toBeVisible();
  await expect(page.locator("#detail-dialog")).toContainText("오사카");
  await page.keyboard.press("Escape");
  await page.locator("#nav-saved").click();
  await page.getByRole("button", { name: "오사카 저장 삭제" }).click();
  await expect(page.locator("#saved-list")).toContainText(
    "다음 여행을 담아 보세요",
  );
});
test("직접 날짜 선택의 오류 복구와 조회 날짜 유지", async ({ page }) => {
  await page.getByRole("button", { name: "내가 직접 날짜 고르기" }).click();
  await page.getByLabel("휴가 시작일", { exact: true }).fill("2027-05-01");
  await page.getByLabel("휴가 마지막 날", { exact: true }).fill("2027-04-30");
  await expect(page.locator("#custom-error")).toContainText(
    "휴가 마지막 날은 시작일 다음 날",
  );
  await page.getByLabel("휴가 마지막 날", { exact: true }).fill("2027-05-05");
  await expect(page.locator("#custom-preview")).toContainText(
    "5일의 여행 가능 기간 · 연차 1일 필요",
  );
  await page.getByRole("button", { name: "이 일정으로 여행지 보기" }).click();
  await expect(page.locator("#selected-window")).toContainText("최대 5일");
  await expect(page.locator(".flight-card").first()).toContainText("5.1");
  await page.reload();
  await expect(page.locator("#selected-window")).toContainText("최대 5일");
});
test("캘린더 파일은 귀국/휴가 마지막날을 포함한다", async ({ page }) => {
  const pending = page.waitForEvent("download");
  await page
    .locator("#selected-window")
    .getByRole("button", { name: "캘린더에 추가" })
    .click();
  const download = await pending;
  expect(download.suggestedFilename()).toBe("tteum-2027-09-11.ics");
  const stream = await download.createReadStream(),
    chunks = [];
  for await (const chunk of stream) chunks.push(chunk);
  expect(Buffer.concat(chunks).toString()).toContain(
    "DTEND;VALUE=DATE:20270920",
  );
});
test("잘못된 URL 복구와 과거 추천 제외", async ({ page }) => {
  await page.getByLabel("여행할 해").selectOption("2026");
  const dates = await page
    .locator("[data-window]")
    .evaluateAll((buttons) =>
      buttons.map((b) => b.dataset.window.split("_")[0]),
    );
  expect(dates.every((d) => d >= "2026-10-14")).toBeTruthy();
  await page.goto("/?year=bad&origin=<script>&leave=99&start=2027-99-12");
  await expect(page.getByLabel("출발 공항", { exact: true })).toHaveValue(
    "ICN",
  );
  await expect(page.locator("#selected-window")).toContainText("최대 9일");
});
test("브라우저 저장소가 막혀도 검색과 임시 저장 가능", async ({ page }) => {
  await page.addInitScript(() =>
    Object.defineProperty(window, "localStorage", {
      get() {
        throw new DOMException("Blocked", "SecurityError");
      },
    }),
  );
  await page.reload();
  await page
    .getByRole("button", { name: "오사카 여행 저장", exact: true })
    .click();
  await expect(page.locator("#saved-count")).toHaveText("1");
  await expect(page.locator("#toast")).toContainText(
    "새로고침하면 저장이 사라져요",
  );
});
test("조회 실패를 숨기지 않고 같은 조건으로 다시 조회", async ({ page }) => {
  await page.unroute("**/api/flights?**");
  await mockFlights(page, { failFirst: true });
  await page.goto("/");
  await expect(page.locator("#flight-grid")).toContainText(
    "항공권을 조회하지 못했어요",
  );
  await expect(page.locator(".flight-card")).toHaveCount(0);
  await page
    .getByRole("button", { name: "다시 조회", exact: true })
    .last()
    .click();
  await expect(page.locator(".flight-card")).toHaveCount(2);
});
test("이전 응답이 늦게 도착해도 새 공항 결과를 덮지 않는다", async ({
  page,
}) => {
  await page.unroute("**/api/flights?**");
  await mockFlights(page, { delayFirst: true });
  await page.goto("/");
  await page.getByLabel("출발 공항", { exact: true }).selectOption("PUS");
  await expect(page.locator(".flight-card").first()).toContainText("190,000");
  await page.waitForTimeout(500);
  await expect(page.locator(".flight-card").first()).toContainText("190,000");
});
test("모바일/데스크톱 에셋과 가로 넘침 없음", async ({ page }) => {
  await page.locator("footer").scrollIntoViewIfNeeded();
  await page.waitForFunction(() =>
    [...document.images].every((i) => i.complete && i.naturalWidth > 0),
  );
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBeTruthy();
});

test("휴가 마지막 날과 귀국편 마감일을 구분하고 날짜 고정을 보존한다", async ({
  page,
}) => {
  await page.getByRole("button", { name: "내가 직접 날짜 고르기" }).click();
  await page.getByLabel("휴가 시작일", { exact: true }).fill("2027-05-01");
  await page.getByLabel("휴가 마지막 날", { exact: true }).fill("2027-05-05");
  await page.getByRole("button", { name: "이 일정으로 여행지 보기" }).click();
  await page.locator(".preference-disclosure > summary").click();
  await page.getByLabel("출발·귀국편 날짜 고정").check();
  await expect(page.locator("#return-cutoff")).toHaveText(
    "5.1 출발 · 5.4 귀국편",
  );
  await page.getByLabel("복귀 여유 하루").uncheck();
  await expect(page.locator("#return-cutoff")).toHaveText(
    "5.1 출발 · 5.5 귀국편",
  );
  await page
    .getByRole("button", { name: "오사카 항공권 상세 보기", exact: true })
    .click();
  await expect(page.locator(".seller-row").first()).toHaveAttribute(
    "href",
    /start=2027-05-01.*end=2027-05-05/,
  );
});
test("이력 갱신 실패 시 이전 기록 표시를 알린다", async ({ page }) => {
  await page.unroute("**/api/history?**");
  await page.route("**/api/history?**", (route) =>
    route.fulfill({
      json: {
        stale: true,
        warning: "새 조회에 실패해 이전 수집 기록을 표시합니다.",
        collectedAt: "2026-10-14T03:00:00Z",
        items: [
          { date: "2026-10-13", price: 250000 },
          { date: "2026-10-14", price: 210000 },
        ],
      },
    }),
  );
  await page
    .getByRole("button", { name: "오사카 항공권 상세 보기", exact: true })
    .click();
  await expect(page.locator("#price-history")).toContainText("이전 수집 기록");
  await expect(page.locator("#price-history")).toContainText("2회 관측");
});
