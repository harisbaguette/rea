export async function mockFlights(
  page,
  { failFirst = false, delayFirst = false } = {},
) {
  let count = 0;
  await page.route("**/api/flights?**", async (route) => {
    count++;
    const url = new URL(route.request().url()),
      q = Object.fromEntries(url.searchParams),
      start = q.start,
      end = q.end;
    if (failFirst && count === 1) {
      await route.fulfill({
        status: 503,
        json: { error: { message: "운임 제공처에 일시적인 문제가 있어요." } },
      });
      return;
    }
    if (delayFirst && count === 1)
      await new Promise((resolve) => setTimeout(resolve, 400));
    const last =
        q.buffer === "0"
          ? end
          : new Date(Date.parse(`${end}T00:00:00Z`) - 86400000)
              .toISOString()
              .slice(0, 10),
      nights = Math.round((Date.parse(last) - Date.parse(start)) / 86400000);
    const base = {
      origin: q.origin,
      start,
      end: last,
      recoveryEnd: end,
      nights,
      leave: [],
      average: 300000,
      discount: 30,
      observedAt: "2026-10-14T03:00:00Z",
      bestSeason: false,
      beach: false,
    };
    const flights =
      nights >= Number(q.minNights)
        ? [
            {
              ...base,
              id: `${q.origin}-KIX-${start}-${last}`,
              code: "KIX",
              city: "오사카",
              country: "일본",
              countryCode: "JP",
              continent: "아시아",
              price: q.origin === "PUS" ? 190000 : 210000,
              partner: "tripcom",
              sellers: [
                {
                  partner: "tripcom",
                  name: "트립닷컴",
                  price: q.origin === "PUS" ? 190000 : 210000,
                },
                { partner: "agoda", name: "아고다", price: 220000 },
              ],
            },
            {
              ...base,
              id: `${q.origin}-DAD-${start}-${last}`,
              code: "DAD",
              city: "다낭",
              country: "베트남",
              countryCode: "VN",
              continent: "아시아",
              price: 310000,
              discount: -3.3,
              partner: "tripcom",
              beach: true,
              sellers: [
                { partner: "tripcom", name: "트립닷컴", price: 310000 },
              ],
            },
          ]
        : [];
    await route.fulfill({
      json: {
        flights,
        query: q,
        complete: true,
        stale: false,
        updatedAt: "2026-10-14T03:00:00Z",
        fetchedAt: "2026-10-14T03:00:00Z",
        source: "시험용 응답",
      },
    });
  });
  await page.route("**/api/history?**", (route) =>
    route.fulfill({
      json: {
        items: [
          { date: "2026-10-12", price: 250000 },
          { date: "2026-10-13", price: 240000 },
          { date: "2026-10-14", price: 210000 },
        ],
        min: 210000,
        max: 250000,
        stale: false,
      },
    }),
  );
}
