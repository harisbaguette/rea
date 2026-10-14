export const DESTINATIONS = [
  {
    id: "osaka",
    city: "오사카",
    code: "KIX",
    image: "osaka.webp",
    alt: "오사카 도톤보리의 거리",
  },
  {
    id: "okinawa",
    city: "오키나와",
    code: "OKA",
    image: "okinawa.webp",
    alt: "오키나와의 푸른 바다",
  },
  {
    id: "taipei",
    city: "타이베이",
    code: "TPE",
    image: "taipei.webp",
    alt: "타이베이의 거리",
  },
  {
    id: "danang",
    city: "다낭",
    code: "DAD",
    image: "danang.webp",
    alt: "다낭의 해변",
  },
  {
    id: "tokyo",
    city: "도쿄",
    code: "NRT",
    image: "tokyo.webp",
    alt: "도쿄의 야경",
  },
  {
    id: "fukuoka",
    city: "후쿠오카",
    code: "FUK",
    image: "fukuoka.webp",
    alt: "후쿠오카의 야간 거리",
  },
];
export const ORIGINS = {
  ICN: "인천",
  PUS: "부산·김해",
  GMP: "김포",
  CJU: "제주",
  TAE: "대구",
  CJJ: "청주",
};
export function searchUrl(destination, window, origin = "ICN") {
  return `https://www.skyscanner.co.kr/transport/flights/${origin.toLowerCase()}/${destination.code.toLowerCase()}/${window.start.slice(2).replaceAll("-", "")}/${window.end.slice(2).replaceAll("-", "")}/?adults=1&adultsv2=1&cabinclass=economy&children=0&rtn=1&currency=KRW`;
}
export function bookUrl(flight, partner = flight.partner) {
  return `/api/book?${new URLSearchParams({ origin: flight.origin, code: flight.code, start: flight.start, end: flight.end, partner })}`;
}
export function filterFlights(
  flights,
  { budget = 0, region = "all", sort = "price", dealsOnly = false, alternatives = {} } = {},
) {
  return flights
    .filter(
      (flight) =>
        (!budget || flight.price <= budget) &&
        (!dealsOnly || (flight.discount !== null && flight.discount > 0)) &&
        (region === "all" ||
          (region === "japan"
            ? flight.countryCode === "JP"
            : region === "beach"
              ? flight.beach
              : region === "asia"
                ? flight.continent === "아시아"
                : region === "europe"
                  ? flight.continent === "유럽"
                  : region === "america"
                    ? [
                        "북아메리카",
                        "남아메리카",
                        "미주",
                        "북미",
                        "남미",
                      ].includes(flight.continent)
                    : region === "domestic"
                      ? flight.countryCode === "KR"
                      : true)),
    )
    .sort((a, b) =>
      sort === "discount"
        ? (b.discount ?? -999) - (a.discount ?? -999) || a.price - b.price
        : sort === "longest"
          ? Math.max(b.nights, ...(alternatives[b.code] || []).filter(f => !budget || f.price <= budget).map(f => f.nights)) - Math.max(a.nights, ...(alternatives[a.code] || []).filter(f => !budget || f.price <= budget).map(f => f.nights)) || a.price - b.price
          : a.price - b.price,
    );
}
