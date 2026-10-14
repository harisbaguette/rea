import {
  findWindows,
  makeWindow,
  rangeDays,
  shortDate,
  periodLabel,
  daysBetween,
  calendarFile,
  todayInSeoul,
  addDays,
} from "./calendar.js";
import {
  DESTINATIONS,
  ORIGINS,
  filterFlights,
  searchUrl,
  bookUrl,
} from "./flights.js";
const $ = (s, r = document) => r.querySelector(s),
  $$ = (s, r = document) => [...r.querySelectorAll(s)];
const escape = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const money = (value) => new Intl.NumberFormat("ko-KR").format(value);
const icon = (name) =>
  `<svg class="icon" aria-hidden="true"><use href="/assets/icons.svg#${name}"></use></svg>`;
const today = todayInSeoul(),
  params = new URLSearchParams(location.search);
const validDate = (value) =>
  /^202[67]-\d{2}-\d{2}$/.test(value || "") &&
  !Number.isNaN(Date.parse(`${value}T00:00:00Z`)) &&
  new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
const intParam = (key, options, fallback) =>
  params.has(key) && options.includes(Number(params.get(key)))
    ? Number(params.get(key))
    : fallback;
const state = {
  year: intParam("year", [2026, 2027], 2027),
  maxLeave: intParam("leave", [0, 1, 2, 3, 4, 5], 2),
  month: intParam(
    "month",
    Array.from({ length: 13 }, (_, i) => i),
    0,
  ),
  origin: ORIGINS[params.get("origin")] ? params.get("origin") : "ICN",
  budget: intParam("budget", [0, 200000, 300000, 400000, 600000], 0),
  region: [
    "all",
    "japan",
    "asia",
    "europe",
    "america",
    "domestic",
    "beach",
  ].includes(params.get("region"))
    ? params.get("region")
    : "all",
  windowSort: "longest",
  flightSort: "price",
  selected: null,
  allWindows: [],
  view: "plan",
  saved: [],
  flights: [],
  searchState: "idle",
  searchError: "",
  fareMeta: null,
  minNights: intParam("minNights", [1, 2, 3, 4, 5, 7], 2),
  buffer: intParam("buffer", [0, 1], 1),
  exact: params.get("exact") === "1",
  dealsOnly: false,
  visibleCount: 24,
};
let toastTimer,
  searchController,
  searchSerial = 0,
  historyController;
let storageAvailable = true;
const STORAGE_KEY = "tteum.saved.v2",
  queryCache = new Map();
function readSaved() {
  try {
    let raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) raw = localStorage.getItem("tteum.saved.v1");
    const items = JSON.parse(raw || "[]");
    return Array.isArray(items)
      ? items
          .filter(
            (item) =>
              item &&
              validDate(item.start) &&
              validDate(item.end) &&
              item.start <= item.end &&
              daysBetween(item.start, item.end) <= 31 &&
              ORIGINS[item.origin],
          )
          .slice(0, 40)
          .map((item) => {
            const old = DESTINATIONS.find((d) => d.id === item.destId);
            return {
              start: item.start,
              end: item.end,
              origin: item.origin,
              code: /^[A-Z]{3}$/.test(item.code || "")
                ? item.code
                : old?.code || "",
              city: String(item.city || old?.city || "").slice(0, 80),
              country: String(item.country || "").slice(0, 80),
              price: Number.isFinite(item.price) ? item.price : null,
              buffer: item.buffer === 0 ? 0 : 1,
            };
          })
      : [];
  } catch (error) {
    if (error.name !== "SyntaxError") storageAvailable = false;
    return [];
  }
}
state.saved = readSaved();
function hydrateIcons(root = document) {
  $$("[data-icon]", root).forEach(
    (el) => (el.outerHTML = icon(el.dataset.icon)),
  );
}
function toast(message) {
  clearTimeout(toastTimer);
  $("#toast").textContent = message;
  $("#toast").hidden = false;
  toastTimer = setTimeout(() => ($("#toast").hidden = true), 3500);
}
function syncUrl() {
  const next = new URLSearchParams();
  for (const [key, value] of Object.entries({
    year: state.year,
    leave: state.maxLeave,
    origin: state.origin,
    month: state.month,
    budget: state.budget,
    region: state.region,
    minNights: state.minNights,
    buffer: state.buffer,
    exact: Number(state.exact),
    start: state.selected?.start,
    end: state.selected?.end,
  }))
    if (value !== undefined) next.set(key, String(value));
  history.replaceState(
    null,
    "",
    `${location.pathname}?${next}${location.hash}`,
  );
}
const savedKey = (item) =>
  `${item.origin}|${item.code || ""}|${item.start}|${item.end}`;
const scheduleItem = () => ({
  start: state.selected.start,
  end: state.selected.end,
  origin: state.origin,
  code: "",
  city: "",
  buffer: state.buffer,
});
const flightItem = (flight) => ({
  start: flight.start,
  end: flight.end,
  origin: flight.origin,
  code: flight.code,
  city: flight.city,
  country: flight.country,
  price: flight.price,
  buffer: state.buffer,
});
const isSaved = (item) =>
  state.saved.some((entry) => savedKey(entry) === savedKey(item));
function persistSaved() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.saved));
  } catch {
    storageAvailable = false;
  }
  $("#saved-count").textContent = state.saved.length;
}
function toggleSaved(item) {
  const active = document.activeElement,
    focusSelector = active?.dataset.saveOffer
      ? `[data-save-offer="${active.dataset.saveOffer}"]`
      : active?.hasAttribute("data-save-schedule")
        ? "[data-save-schedule]"
        : null;
  const index = state.saved.findIndex(
    (entry) => savedKey(entry) === savedKey(item),
  );
  if (index >= 0) {
    state.saved.splice(index, 1);
    toast("저장한 여행에서 삭제했어요.");
  } else {
    if (state.saved.length >= 40) {
      toast("최대 40개까지 저장할 수 있어요.");
      return;
    }
    state.saved.unshift(item);
    toast("저장했어요. ‘저장한 여행’에서 다시 만나요.");
  }
  persistSaved();
  if (!storageAvailable)
    toast("브라우저 저장소를 사용할 수 없어 새로고침하면 저장이 사라져요.");
  renderSelected();
  renderFlights();
  if (state.view === "saved") renderSaved();
  if ($("#detail-dialog").open) updateDetailSave();
  else if (focusSelector) $(focusSelector)?.focus({ preventScroll: true });
}
function downloadCalendar(window, city = "") {
  const url = URL.createObjectURL(
    new Blob([calendarFile(window, city)], {
      type: "text/calendar;charset=utf-8",
    }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = `tteum-${window.start}${city ? `-${city}` : ""}.ics`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  toast(
    "캘린더 파일을 내려받았어요. 실제 항공편과 휴가는 별도로 확정해 주세요.",
  );
}
function visibleWindows() {
  const windows = state.allWindows.filter(
    (win) =>
      !state.month ||
      rangeDays(win.start, win.end).some(
        (d) => Number(d.date.slice(5, 7)) === state.month,
      ),
  );
  if (state.windowSort === "earliest")
    windows.sort((a, b) => a.start.localeCompare(b.start));
  if (state.windowSort === "leave")
    windows.sort(
      (a, b) =>
        a.leave.length - b.leave.length ||
        b.days - a.days ||
        a.start.localeCompare(b.start),
    );
  return windows;
}
function recompute() {
  state.allWindows = findWindows({
    year: state.year,
    maxLeave: state.maxLeave,
    today,
  });
  state.selected = visibleWindows()[0] || null;
  render();
  loadFlights();
}
function timeline(win) {
  return `<div class="timeline" role="list" aria-label="여행 날짜와 연차 사용일">${rangeDays(
    win.start,
    win.end,
  )
    .map(
      (day) =>
        `<div role="listitem" class="day ${day.off ? (day.holiday ? "holiday" : "weekend") : "leave"}" aria-label="${shortDate(day.date)} ${day.weekday}요일, ${escape(day.holiday || (day.weekend ? "주말" : "연차 사용"))}"><span class="day-week">${day.weekday}</span><strong>${Number(day.date.slice(8))}</strong><span class="day-type">${day.off ? (day.holiday ? "공휴일" : "주말") : "연차"}</span></div>`,
    )
    .join("")}</div>`;
}
function renderSelected() {
  const win = state.selected,
    root = $("#selected-window");
  if (!win) {
    root.innerHTML = `<div class="empty">${icon("calendar")}<h3>다른 달에는 여행이 기다려요</h3><p>연차나 월을 바꾸거나 직접 날짜를 골라 주세요.</p></div>`;
    return;
  }
  const saved = isSaved(scheduleItem());
  root.innerHTML = `<div class="selected-top"><div><span class="selected-eyebrow">${escape(win.title)}</span><h3>연차 <span>${win.leave.length}일</span>로, 최대 <span>${win.days}일</span>의 여유.</h3><p>${state.year}년 ${periodLabel(win.start, win.end)}</p></div><button class="icon-button save-schedule ${saved ? "saved" : ""}" data-save-schedule aria-label="${saved ? "일정 저장 취소" : "이 일정 저장"}" aria-pressed="${saved}">${icon("bookmark")}</button></div>${timeline(win)}<div class="selected-bottom"><span>${icon("check")}연차 신청일 <strong>${win.leave.map(shortDate).join(" · ") || "없어요. 연차 없이 떠나요!"}</strong></span><button class="calendar-download" data-calendar>${icon("calendar-plus")}캘린더에 추가</button></div>`;
  $("#selected-period").textContent =
    `${shortDate(win.start)} — ${shortDate(win.end)} · 이 연휴 안에 다녀오는`;
}
function renderWindows() {
  const windows = visibleWindows();
  $("#window-count").textContent =
    `${state.month ? `${state.month}월 ` : ""}추천 연휴 ${windows.length}`;
  $("#window-list").innerHTML = windows.length
    ? windows
        .map(
          (win, i) =>
            `<button class="window-option ${state.selected?.id === win.id ? "selected" : ""}" data-window="${win.id}" aria-pressed="${state.selected?.id === win.id}"><span class="window-option-top"><strong>${escape(win.title)}</strong>${i === 0 && state.windowSort === "longest" ? '<span class="mini-tag">가장 길게</span>' : ""}</span><span class="window-option-date">${periodLabel(win.start, win.end)}</span><span class="window-option-bottom"><span>연차 <b>${win.leave.length}일</b><span class="arrow">→</span><strong>최대 ${win.days}일</strong></span>${icon(state.selected?.id === win.id ? "circle-check" : "arrow-up-right")}</span></button>`,
        )
        .join("")
    : `<div class="empty small">${icon("calendar")}<strong>이 조건에 맞는 연휴가 없어요</strong><p>연차를 늘리거나 다른 달을 골라 보세요.</p><button class="text-button" data-reset-month>전체 달 보기</button></div>`;
}
function render() {
  $("#year-caption").textContent = `나의 ${state.year} 여행 캘린더`;
  const best = state.allWindows[0];
  $("#hero-stat").innerHTML = best
    ? `연차 ${best.leave.length}일 <span>→</span> 최대 ${best.days}일`
    : "내 일정으로 떠나는 여행";
  $("#origin").value = state.origin;
  $("#year").value = state.year;
  $("#budget").value = state.budget;
  $("#min-nights").value = state.minNights;
  $("#return-buffer").checked = Boolean(state.buffer);
  $("#exact-dates").checked = state.exact;
  $("#leave-buttons").innerHTML = [0, 1, 2, 3, 4, 5]
    .map(
      (n) =>
        `<button type="button" data-leave="${n}" aria-pressed="${state.maxLeave === n}" aria-label="연차 최대 ${n}일">${n}<span>일</span></button>`,
    )
    .join("");
  $("#month-grid").innerHTML = Array.from({ length: 12 }, (_, i) => {
    const month = i + 1,
      choices = state.allWindows.filter((win) =>
        rangeDays(win.start, win.end).some(
          (d) => Number(d.date.slice(5, 7)) === month,
        ),
      ),
      max = Math.max(0, ...choices.map((w) => w.days));
    return `<button data-month="${month}" class="month-button ${state.month === month ? "selected" : ""}" aria-pressed="${state.month === month}" aria-label="${month}월${max ? `, 최대 ${max}일 여행` : ", 추천 연휴 없음"}"><span>${month}월</span><small>${max ? `${max}일 여행` : "—"}</small>${max >= 7 ? '<i class="month-dot" aria-hidden="true"></i>' : ""}</button>`;
  }).join("");
  $("#month-all").classList.toggle("all-active", !state.month);
  renderWindows();
  renderSelected();
  renderFlights();
  $$("#region-tabs button").forEach((btn) =>
    btn.setAttribute(
      "aria-pressed",
      String(btn.dataset.region === state.region),
    ),
  );
  syncUrl();
}
function artwork(flight, detail = false) {
  const meta = DESTINATIONS.find((dest) => dest.code === flight.code);
  return meta
    ? `<img src="/assets/${meta.image}" alt="${meta.alt}" width="600" height="340" ${detail ? "" : 'loading="lazy"'} />`
    : `<div class="route-art tone-${flight.code.charCodeAt(0) % 4}" aria-label="${escape(flight.city)} 항공 노선"><span class="route-code">${escape(flight.code)}</span><div>${icon("plane")}<span>${escape(flight.origin)} <b>→</b> ${escape(flight.code)}</span></div></div>`;
}
function sourceTime(value) {
  if (!value || Number.isNaN(Date.parse(value))) return "수집 시각 미제공";
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(value));
}
function renderFlights() {
  const grid = $("#flight-grid");
  grid.setAttribute("aria-busy", String(state.searchState === "loading"));
  if (state.searchState === "loading") {
    grid.innerHTML = `<div class="empty flights-empty loading-state">${icon("plane")}<h3>이 연휴에 떠나는 항공권을 찾고 있어요</h3><p>출발·귀국 날짜가 맞는 실제 수집 운임을 조회합니다.</p></div>`;
    $("#fare-status").textContent = "항공권 조회 중";
    return;
  }
  if (state.searchState === "error") {
    grid.innerHTML = `<div class="empty flights-empty">${icon("info")}<h3>항공권을 조회하지 못했어요</h3><p>${escape(state.searchError)}</p><button class="button primary" data-retry-flights>다시 조회</button></div>`;
    $("#fare-status").textContent = "조회 실패 · 다시 시도할 수 있어요";
    return;
  }
  const flights = filterFlights(state.flights, {
    budget: state.budget,
    region: state.region,
    sort: state.flightSort,
    dealsOnly: state.dealsOnly,
  });
  $("#fare-status").textContent = state.fareMeta
    ? `${flights.length}개 노선 · ${state.fareMeta.stale ? "이전 수집 운임 · " : ""}${sourceTime(state.fareMeta.updatedAt)} 수집${state.fareMeta.complete ? "" : " · 일부 노선"}`
    : "떠날 일정을 골라 주세요";
  $("#fare-notice").innerHTML =
    `${icon("info")}<span>${state.fareMeta?.stale ? escape(state.fareMeta.warning) : "최근 수집된 성인 1인·일반석 왕복 요금입니다. 최종 가격·수하물·한국 도착일은 판매처에서 확인해 주세요."} <a href="https://catchfrog.ai/" target="_blank" rel="noopener noreferrer">운임 제공: Catchfrog ↗</a></span>`;
  grid.innerHTML = flights.length
    ? flights
        .slice(0, state.visibleCount)
        .map(
          (flight, i) =>
            `<article class="flight-card" style="--card-index:${Math.min(i, 8)}"><div class="card-image-wrap"><button class="card-photo-button" data-detail="${flight.id}" aria-label="${escape(flight.city)} 항공권 상세 보기">${artwork(flight)}</button><span class="country-label">${escape(flight.country)}</span><button class="card-save ${isSaved(flightItem(flight)) ? "saved" : ""}" data-save-offer="${flight.id}" aria-label="${escape(flight.city)} ${isSaved(flightItem(flight)) ? "저장 취소" : "여행 저장"}" aria-pressed="${isSaved(flightItem(flight))}">${icon("bookmark")}</button>${flight.discount > 0 ? `<span class="deal-badge">노선 평균보다 ${flight.discount.toFixed(1)}% ↓</span>` : ""}</div><div class="card-content"><div class="card-title"><h3><button data-detail="${flight.id}">${escape(flight.city)}</button></h3><span>${flight.code}</span></div><p class="offer-dates">${periodLabel(flight.start, flight.end)}</p><div class="flight-meta">${flight.nights}박 ${flight.nights + 1}일<span>·</span>연차 ${flight.leave.length}일${state.buffer ? " (복귀 여유 포함)" : ""}</div>${flight.average ? `<p class="route-average">노선 수집 평균 ${money(flight.average)}원</p>` : ""}<div class="card-bottom"><div><span class="price-label">${escape(flight.sellers[0].name)} · 1인 왕복</span><strong class="price">${money(flight.price)}<span>원</span></strong></div><button class="flight-search" data-detail="${flight.id}" aria-label="${escape(flight.city)} 판매처 ${flight.sellers.length}곳 가격 비교">${flight.sellers.length}곳 비교${icon("arrow-right")}</button></div><button class="history-link" data-detail="${flight.id}">가격 이력 보기${icon("arrow-up-right")}</button></div></article>`,
        )
        .join("") +
      (flights.length > state.visibleCount
        ? `<div class="more-flights"><button class="button secondary" data-more-flights>항공권 더 보기 (${state.visibleCount}/${flights.length})${icon("chevron-right")}</button></div>`
        : "")
    : `<div class="empty flights-empty">${icon("search")}<h3>${!state.selected ? "먼저 떠날 일정을 골라 주세요" : state.flights.length ? "조건에 맞는 항공권이 없어요" : "이 날짜에 조회된 항공권이 없어요"}</h3><p>${state.flights.length ? "예산이나 여행지 분류를 바꾸면 더 많은 항공권을 볼 수 있어요." : "숙박일을 줄이거나 다른 연휴를 골라 보세요. 수집되지 않은 항공권은 가격을 표시하지 않습니다."}</p>${state.flights.length ? '<button class="button secondary" data-reset-flights>여행지 필터 초기화</button>' : '<button class="button secondary" data-open-custom>직접 날짜 고르기</button>'}</div>`;
}
async function loadFlights(refresh = false) {
  searchController?.abort();
  const serial = ++searchSerial;
  if (!state.selected) {
    state.flights = [];
    state.fareMeta = null;
    state.searchState = "idle";
    renderFlights();
    return;
  }
  const input = {
      origin: state.origin,
      start: state.selected.start,
      end: state.selected.end,
      minNights: String(state.minNights),
      buffer: String(state.buffer),
      exact: state.exact ? "1" : "0",
    },
    query = new URLSearchParams(input).toString();
  const cached = queryCache.get(query);
  $("#return-cutoff").textContent = state.exact
    ? `${shortDate(input.start)} 출발 · ${shortDate(addDays(input.end, -state.buffer))} 귀국편`
    : `귀국편 출발 마감 ${shortDate(addDays(input.end, -state.buffer))}`;
  state.visibleCount = 24;
  state.flights = [];
  state.fareMeta = null;
  state.searchError = "";
  state.searchState = "loading";
  renderFlights();
  if (!refresh && cached && Date.now() - cached.at < 120000) {
    state.flights = cached.data.flights;
    state.fareMeta = cached.data;
    state.searchState = "ready";
    renderFlights();
    return;
  }
  const controller = new AbortController();
  searchController = controller;
  try {
    const response = await fetch(`/api/flights?${query}`, {
      signal: controller.signal,
      headers: { Accept: "application/json" },
    });
    const data = await response.json();
    if (!response.ok)
      throw new Error(data.error?.message || "운임 조회에 실패했어요.");
    if (!Array.isArray(data.flights))
      throw new Error("운임 결과 형식이 올바르지 않아요.");
    if (serial !== searchSerial) return;
    state.flights = data.flights;
    state.fareMeta = data;
    state.searchState = "ready";
    if (queryCache.size >= 20)
      queryCache.delete(queryCache.keys().next().value);
    queryCache.set(query, { at: Date.now(), data });
    renderFlights();
  } catch (error) {
    if (error.name === "AbortError" || serial !== searchSerial) return;
    state.searchState = "error";
    state.searchError = error.message;
    renderFlights();
  }
}
let detailFlight = null;
function updateDetailSave() {
  if (!detailFlight) return;
  const button = $("[data-detail-save]", $("#detail-dialog"));
  if (!button) return;
  const saved = isSaved(flightItem(detailFlight));
  button.innerHTML = `${icon("bookmark")}${saved ? "저장한 여행" : "이 여행 저장"}`;
  button.setAttribute("aria-pressed", String(saved));
  button.classList.toggle("saved", saved);
}
function chart(data) {
  if (!data.items?.length)
    return '<p class="chart-empty">이 일정의 가격 이력이 아직 없어요.</p>';
  const items = data.items,
    min = Math.min(...items.map((i) => i.price)),
    max = Math.max(...items.map((i) => i.price)),
    spread = max - min || 1;
  const points = items
    .map(
      (item, i) =>
        `${24 + (i / Math.max(1, items.length - 1)) * 452},${130 - ((item.price - min) / spread) * 100}`,
    )
    .join(" ");
  return `<div class="chart-summary"><span>최저 <strong>${money(min)}원</strong></span><span>최고 <strong>${money(max)}원</strong></span><span>${items.length}회 관측</span></div><svg class="price-chart" viewBox="0 0 500 165" role="img" aria-label="이 일정의 수집 요금 변화. 최저 ${money(min)}원, 최고 ${money(max)}원, ${items.length}회 관측"><path d="M24 30H476 M24 80H476 M24 130H476" stroke="#e2e9e5" fill="none"/><polyline points="${points}" stroke="#087f6a" stroke-width="2.5" fill="none" stroke-linejoin="round"/><text x="24" y="157">${escape(items[0].date.slice(5, 10))}</text><text x="476" y="157" text-anchor="end">${escape(items.at(-1).date.slice(5, 10))}</text></svg><p class="chart-note">동일 노선·같은 출발/귀국일·선택한 판매처의 수집 요금입니다.</p>`;
}
async function loadHistory(partner = detailFlight?.partner) {
  historyController?.abort();
  if (!detailFlight) return;
  const flight = detailFlight,
    root = $("#price-history"),
    controller = new AbortController();
  historyController = controller;
  root.innerHTML =
    '<p class="chart-empty" role="status">가격 이력을 조회하고 있어요.</p>';
  try {
    const response = await fetch(
      `/api/history?${new URLSearchParams({ origin: flight.origin, code: flight.code, start: flight.start, end: flight.end, partner })}`,
      { signal: controller.signal },
    );
    const data = await response.json();
    if (!response.ok)
      throw new Error(data.error?.message || "가격 이력을 조회하지 못했어요.");
    if (detailFlight?.id !== flight.id) return;
    root.innerHTML =
      (data.stale
        ? `<p class="history-stale" role="status">${escape(data.warning || "이력 갱신에 실패해 이전 수집 기록을 표시합니다.")}</p>`
        : "") +
      chart(data) +
      (data.collectedAt
        ? `<p class="chart-note">이력 수집 ${sourceTime(data.collectedAt)}</p>`
        : "");
  } catch (error) {
    if (error.name !== "AbortError")
      root.innerHTML = `<p class="chart-empty">${escape(error.message)}</p><button class="text-button" data-retry-history>가격 이력 다시 조회</button>`;
  }
}
function openDetail(id) {
  const flight =
    typeof id === "object" ? id : state.flights.find((item) => item.id === id);
  if (!flight) return;
  detailFlight = flight;
  const root = $("#detail-dialog");
  root.dataset.offer = flight.id;
  const calendar = makeWindow(flight.start, flight.recoveryEnd);
  root.innerHTML = `<div class="detail-image">${artwork(flight, true)}<button class="icon-button dialog-close" aria-label="닫기">${icon("x")}</button><span>${escape(flight.country)} · ${flight.code}</span></div><div class="detail-body"><span class="section-caption">${ORIGINS[flight.origin]}에서 떠나는 실제 수집 항공권</span><h2 id="detail-title">${escape(flight.city)}, ${flight.nights}박 ${flight.nights + 1}일.</h2><p class="detail-date">${periodLabel(flight.start, flight.end)} · ${flight.start.slice(0, 4)}년</p><div class="detail-stats"><div><span>필요 연차${state.buffer ? " · 여유 포함" : ""}</span><strong>${flight.leave.length}일</strong></div><div><span>여행 일정</span><strong>${flight.nights}박 ${flight.nights + 1}일</strong></div><div><span>비교 판매처</span><strong>${flight.sellers.length}곳</strong></div></div>${timeline(calendar)}<p class="leave-detail">연차 신청: <strong>${flight.leave.map(shortDate).join(" · ") || "사용 없음"}</strong></p><p class="arrival-note">귀국편 출발일 ${shortDate(flight.end)}${state.buffer ? ` · 복귀 여유 ${shortDate(flight.recoveryEnd)}` : ""}. 한국 도착일과 추가 연차는 판매처에서 확인해 주세요.</p><div class="detail-price"><div><span>조회된 판매처 중 1인 왕복 최저</span><strong>${money(flight.price)}<small>원</small></strong></div>${flight.average ? `<span>노선 수집 평균<br>${money(flight.average)}원</span>` : ""}</div><p class="detail-disclaimer">${flight.observedAt ? `${sourceTime(flight.observedAt)} 판매처 가격 수집. ` : ""}최근 수집 요금이며 결제 시점의 운임·좌석·수하물 조건은 달라질 수 있어요.</p><div class="seller-list">${flight.sellers.map((seller) => `<a href="${bookUrl(flight, seller.partner)}" target="_blank" rel="noopener noreferrer" class="seller-row" aria-label="${escape(seller.name)} ${money(seller.price)}원 항공권 확인"><span>${escape(seller.name)}</span><strong>${money(seller.price)}원</strong>${icon("arrow-up-right")}</a>`).join("")}</div><div class="history-heading"><h3>이 일정, 가격은 어땠을까요?</h3><label><span class="sr-only">가격 이력 판매처</span><select id="history-partner">${flight.sellers.map((seller) => `<option value="${seller.partner}">${escape(seller.name)}</option>`).join("")}</select></label></div><div id="price-history" class="price-history"></div><div class="detail-actions"><button class="button secondary" data-detail-save>${icon("bookmark")}이 여행 저장</button><button class="button secondary" data-detail-calendar>${icon("calendar-plus")}캘린더에 추가</button></div><a class="skyscanner-link" href="${searchUrl(flight, flight, flight.origin)}" target="_blank" rel="noopener noreferrer">같은 날짜로 스카이스캐너에서도 확인 ↗</a></div>`;
  updateDetailSave();
  if (!root.open) root.showModal();
  loadHistory();
}
function openCustom() {
  const min = today > "2026-01-01" ? today : "2026-01-01";
  for (const id of ["#custom-start", "#custom-end"]) {
    $(id).min = min;
    $(id).max = "2027-12-31";
  }
  $("#custom-start").value =
    state.selected?.start ||
    (today.slice(0, 4) === String(state.year) ? today : `${state.year}-01-01`);
  $("#custom-end").value =
    state.selected?.end || addDays($("#custom-start").value, 2);
  updateCustomPreview();
  $("#custom-dialog").showModal();
}
function customValidation() {
  const start = $("#custom-start").value,
    end = $("#custom-end").value;
  if (!validDate(start) || !validDate(end))
    return { error: "2026년 또는 2027년의 올바른 날짜를 골라 주세요." };
  if (start < today) return { error: "오늘 이후의 휴가 시작일을 골라 주세요." };
  if (end <= start)
    return { error: "휴가 마지막 날은 시작일 다음 날부터 선택할 수 있어요." };
  if (start.slice(0, 4) !== end.slice(0, 4))
    return { error: "같은 해 안에서 날짜를 골라 주세요." };
  if (daysBetween(start, end) > 16)
    return { error: "최대 16일 안에서 여행 일정을 골라 주세요." };
  return { window: makeWindow(start, end) };
}
function updateCustomPreview() {
  const result = customValidation();
  $("#custom-error").textContent = result.error || "";
  $("#custom-preview").innerHTML = result.window
    ? `<strong>${result.window.days}일의 여행 가능 기간 · 연차 ${result.window.leave.length}일 필요</strong><p>연차 신청: ${result.window.leave.map(shortDate).join(" · ") || "사용 없음"}</p>${result.window.leave.length > state.maxLeave ? `<p class="leave-warning">설정한 연차 ${state.maxLeave}일보다 ${result.window.leave.length - state.maxLeave}일 더 필요해요.</p>` : ""}`
    : "";
  return result;
}
function switchView(view) {
  state.view = view;
  $$(".hero,.search-bar,.planner").forEach(
    (el) => (el.hidden = view !== "plan"),
  );
  $("#saved-view").hidden = view !== "saved";
  for (const name of ["plan", "saved"]) {
    const btn = $(`#nav-${name}`);
    btn.classList.toggle("active", view === name);
    if (view === name) btn.setAttribute("aria-current", "page");
    else btn.removeAttribute("aria-current");
  }
  if (view === "saved") renderSaved();
  window.scrollTo({
    top: 0,
    behavior: matchMedia("(prefers-reduced-motion: reduce)").matches
      ? "instant"
      : "smooth",
  });
}
function renderSaved() {
  $("#saved-list").innerHTML = state.saved.length
    ? state.saved
        .map((item, index) => {
          const win = makeWindow(item.start, item.end),
            meta = DESTINATIONS.find((d) => d.code === item.code);
          return `<article class="saved-card">${meta ? `<img src="/assets/${meta.image}" alt="${meta.alt}" width="240" height="160" />` : `<div class="saved-art">${icon(item.code ? "plane" : "calendar")}<strong>${escape(item.code || "연휴")}</strong></div>`}<div class="saved-card-info"><span class="section-caption">${item.start < today ? "지난 일정" : `${win.days - 1}박 ${win.days}일`} · ${ORIGINS[item.origin]} 출발</span><h2>${escape(item.city || win.title)}</h2><p>${item.start.slice(0, 4)}년 ${periodLabel(item.start, item.end)}</p>${item.price ? `<p>저장 당시 ${money(item.price)}원 · 현재 운임은 다시 조회</p>` : ""}</div><div class="saved-card-actions"><button class="button secondary" data-saved-open="${index}" ${item.start < today ? "disabled" : ""}>${item.code ? "현재 운임 조회" : "일정 보기"}</button><button class="icon-button" data-saved-remove="${index}" aria-label="${escape(item.city || "일정")} 저장 삭제">${icon("trash-2")}</button></div></article>`;
        })
        .join("")
    : `<div class="empty saved-empty">${icon("bookmark")}<h2>다음 여행을 담아 보세요</h2><p>마음에 드는 일정이나 항공권의 북마크를 눌러 주세요.</p><button class="button primary" data-back-plan>연휴 찾아보기${icon("arrow-right")}</button></div>`;
}
async function openSaved(index) {
  const item = state.saved[index];
  if (!item || item.start < today) return;
  state.year = Number(item.start.slice(0, 4));
  state.origin = item.origin;
  state.month = 0;
  state.buffer = item.buffer;
  state.exact = Boolean(item.code);
  state.minNights = Math.max(
    1,
    Math.min(2, daysBetween(item.start, item.end) - 1),
  );
  state.selected = makeWindow(
    item.start,
    item.code ? addDays(item.end, item.buffer) : item.end,
  );
  state.maxLeave = Math.min(
    5,
    Math.max(state.maxLeave, state.selected.leave.length),
  );
  state.allWindows = findWindows({
    year: state.year,
    maxLeave: state.maxLeave,
    today,
  });
  switchView("plan");
  render();
  await loadFlights();
  const flight = state.flights.find((f) => f.code === item.code);
  if (flight) openDetail(flight);
  else if (item.code)
    toast(
      "저장한 일정의 현재 운임이 조회되지 않았어요. 다른 항공권을 확인해 주세요.",
    );
}
function selectWindow(win) {
  state.selected = win;
  renderWindows();
  renderSelected();
  syncUrl();
  loadFlights();
}
document.addEventListener("click", (event) => {
  const target = event.target.closest("button,a");
  if (!target) return;
  if (target.matches("[data-leave]")) {
    state.maxLeave = Number(target.dataset.leave);
    recompute();
    $(`[data-leave="${state.maxLeave}"]`).focus({ preventScroll: true });
  } else if (target.matches("[data-month]")) {
    state.month = Number(target.dataset.month);
    state.selected = visibleWindows()[0] || null;
    render();
    loadFlights();
    $(`[data-month="${state.month}"]`).focus({ preventScroll: true });
  } else if (
    target.id === "month-all" ||
    target.matches("[data-reset-month]")
  ) {
    state.month = 0;
    selectWindow(visibleWindows()[0] || null);
    render();
  } else if (target.matches("[data-window]")) {
    selectWindow(state.allWindows.find((w) => w.id === target.dataset.window));
    $(`[data-window="${state.selected.id}"]`).focus({ preventScroll: true });
  } else if (target.matches("[data-more-flights]")) {
    const previous = state.visibleCount;
    state.visibleCount += 24;
    renderFlights();
    $$(".card-photo-button")[previous]?.focus({ preventScroll: true });
  } else if (target.matches("[data-region]")) {
    state.visibleCount = 24;
    state.region = target.dataset.region;
    renderFlights();
    $$("#region-tabs button").forEach((btn) =>
      btn.setAttribute("aria-pressed", String(btn === target)),
    );
    syncUrl();
  } else if (target.matches("[data-save-schedule]"))
    toggleSaved(scheduleItem());
  else if (target.matches("[data-save-offer]")) {
    const flight = state.flights.find((f) => f.id === target.dataset.saveOffer);
    if (flight) toggleSaved(flightItem(flight));
  } else if (target.matches("[data-calendar]"))
    downloadCalendar(state.selected);
  else if (target.matches("[data-detail]")) openDetail(target.dataset.detail);
  else if (target.matches("[data-detail-save]"))
    toggleSaved(flightItem(detailFlight));
  else if (target.matches("[data-detail-calendar]"))
    downloadCalendar(
      makeWindow(detailFlight.start, detailFlight.recoveryEnd),
      detailFlight.city,
    );
  else if (target.matches("[data-retry-history]"))
    loadHistory($("#history-partner").value);
  else if (
    target.matches("[data-retry-flights]") ||
    target.id === "refresh-flights"
  )
    loadFlights(true);
  else if (target.id === "custom-open" || target.matches("[data-open-custom]"))
    openCustom();
  else if (["help-open", "footer-help"].includes(target.id))
    $("#help-dialog").showModal();
  else if (target.matches(".dialog-close")) target.closest("dialog").close();
  else if (target.id === "nav-saved") switchView("saved");
  else if (
    ["nav-plan", "back-to-planner"].includes(target.id) ||
    target.matches("[data-back-plan]")
  )
    switchView("plan");
  else if (target.matches("[data-reset-flights]")) {
    state.budget = 0;
    state.region = "all";
    state.dealsOnly = false;
    $("#deals-only").checked = false;
    render();
  } else if (target.matches("[data-saved-remove]")) {
    state.saved.splice(Number(target.dataset.savedRemove), 1);
    persistSaved();
    renderSaved();
    renderSelected();
    renderFlights();
    toast("저장한 여행에서 삭제했어요.");
  } else if (target.matches("[data-saved-open]"))
    openSaved(Number(target.dataset.savedOpen));
});
$("#year").addEventListener("change", (e) => {
  state.year = Number(e.target.value);
  state.month = 0;
  recompute();
});
$("#origin").addEventListener("change", (e) => {
  state.origin = e.target.value;
  renderSelected();
  syncUrl();
  loadFlights();
});
$("#budget").addEventListener("change", (e) => {
  state.budget = Number(e.target.value);
  renderFlights();
  syncUrl();
});
$("#window-sort").addEventListener("change", (e) => {
  state.windowSort = e.target.value;
  renderWindows();
});
$("#flight-sort").addEventListener("change", (e) => {
  state.flightSort = e.target.value;
  renderFlights();
});
$("#min-nights").addEventListener("change", (e) => {
  state.minNights = Number(e.target.value);
  syncUrl();
  loadFlights();
});
$("#return-buffer").addEventListener("change", (e) => {
  state.buffer = e.target.checked ? 1 : 0;
  syncUrl();
  loadFlights();
});
$("#exact-dates").addEventListener("change", (e) => {
  state.exact = e.target.checked;
  syncUrl();
  loadFlights();
});
$("#deals-only").addEventListener("change", (e) => {
  state.dealsOnly = e.target.checked;
  renderFlights();
});
for (const field of ["#custom-start", "#custom-end"])
  $(field).addEventListener("input", updateCustomPreview);
$("#custom-form").addEventListener("submit", (e) => {
  e.preventDefault();
  const result = updateCustomPreview();
  if (result.error) return;
  state.selected = result.window;
  state.year = Number(result.window.start.slice(0, 4));
  state.month = 0;
  state.allWindows = findWindows({
    year: state.year,
    maxLeave: state.maxLeave,
    today,
  });
  $("#custom-dialog").close();
  render();
  loadFlights();
  $("#selected-window").scrollIntoView({ block: "start", behavior: "smooth" });
});
document.addEventListener("change", (event) => {
  if (event.target.id === "history-partner") loadHistory(event.target.value);
});
$$("dialog").forEach((dialog) =>
  dialog.addEventListener("click", (event) => {
    if (event.target !== dialog) return;
    const rect = dialog.getBoundingClientRect();
    if (
      event.clientX < rect.left ||
      event.clientX > rect.right ||
      event.clientY < rect.top ||
      event.clientY > rect.bottom
    )
      dialog.close();
  }),
);
$("#detail-dialog").addEventListener("close", () => {
  historyController?.abort();
  detailFlight = null;
});
window.addEventListener("storage", (event) => {
  if (event.key !== STORAGE_KEY) return;
  state.saved = readSaved();
  $("#saved-count").textContent = state.saved.length;
  if (state.view === "saved") renderSaved();
  renderSelected();
  renderFlights();
});
hydrateIcons();
$("#saved-count").textContent = state.saved.length;
state.allWindows = findWindows({
  year: state.year,
  maxLeave: state.maxLeave,
  today,
});
if (
  validDate(params.get("start")) &&
  validDate(params.get("end")) &&
  params.get("start") >= today &&
  params.get("start") < params.get("end") &&
  params.get("start").slice(0, 4) === String(state.year) &&
  params.get("end").slice(0, 4) === String(state.year) &&
  daysBetween(params.get("start"), params.get("end")) <= 16
)
  state.selected = makeWindow(params.get("start"), params.get("end"));
else state.selected = visibleWindows()[0] || null;
render();
loadFlights();
