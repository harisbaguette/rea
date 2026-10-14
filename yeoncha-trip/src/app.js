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
  windowSort: ["longest", "price", "efficiency", "earliest", "leave"].includes(params.get("windowSort")) ? params.get("windowSort") : "longest",
  flightSort: ["price", "discount", "longest"].includes(params.get("flightSort")) ? params.get("flightSort") : "price",
  selected: null,
  allWindows: [],
  view: params.get("view") === "saved" ? "saved" : "plan",
  saved: [],
  flights: [],
  searchState: "idle",
  searchError: "",
  fareMeta: null,
  minNights: intParam("minNights", [1, 2, 3, 4, 5, 7], 2),
  buffer: intParam("buffer", [0, 1], 1),
  exact: params.get("exact") === "1",
  dealsOnly: params.get("deals") === "1",
  visibleCount: 12,
  windowVisible: 4,
  overview: new Map(),
  overviewState: "idle",
  overviewError: "",
  alternatives: {},
};
let toastTimer,
  searchController,
  searchSerial = 0,
  historyController,
  overviewController,
  overviewSerial = 0;
let restoringHistory = false, detailReturnFocus = null, detailReturnSelector = null, suppressDetailClose = 0;
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
function syncUrl(push = false) {
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
    view: state.view,
    windowSort: state.windowSort,
    flightSort: state.flightSort,
    deals: Number(state.dealsOnly),
    offer: detailFlight ? `${detailFlight.code}~${detailFlight.start}~${detailFlight.end}` : state.searchState === "idle" || state.searchState === "loading" ? new URLSearchParams(location.search).get("offer") || undefined : undefined,
  }))
    if (value !== undefined) next.set(key, String(value));
  if (!restoringHistory) history[push ? "pushState" : "replaceState"](
    { tteum: true, detail: Boolean(detailFlight) }, "", `${location.pathname}?${next}`
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
        (d) => Number(d.date.slice(0, 4)) === state.year && Number(d.date.slice(5, 7)) === state.month,
      ),
  );
  if (state.windowSort === "price")
    windows.sort((a, b) => (state.overview.get(a.id)?.cheapest?.price ?? Infinity) - (state.overview.get(b.id)?.cheapest?.price ?? Infinity) || b.days - a.days);
  if (state.windowSort === "efficiency")
    windows.sort((a, b) => b.days / Math.max(1, b.leave.length) - a.days / Math.max(1, a.leave.length) || b.days - a.days);
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
  state.windowVisible = 4;
  render();
  loadFlights();
  loadOverview();
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
  const win = state.selected, root = $("#selected-window");
  if (!win) {
    root.innerHTML = `<div class="empty">${icon("calendar")}<h3>이 조건에 맞는 연휴가 없어요</h3><p>연차나 월을 바꾸거나 직접 날짜를 골라 주세요.</p><button class="button secondary" data-open-custom>직접 날짜 고르기</button></div>`;
    return;
  }
  const saved = isSaved(scheduleItem());
  root.innerHTML = `<div class="selected-top"><div><span class="selected-eyebrow">선택한 휴가 · ${escape(win.title)}</span><h3>연차 <span>${win.leave.length}일</span>로, 최대 <span>${win.days}일</span>의 여유.</h3><p>${win.start.slice(0,4)}년 ${periodLabel(win.start,win.end)}</p></div><div class="selected-actions"><button class="icon-button save-schedule ${saved ? "saved" : ""}" data-save-schedule aria-label="${saved ? "일정 저장 취소" : "이 일정 저장"}" aria-pressed="${saved}">${icon("bookmark")}</button><button class="icon-button" data-calendar aria-label="캘린더에 추가">${icon("calendar-plus")}</button></div></div><details class="schedule-detail"><summary>연차 신청일 <strong>${win.leave.map(shortDate).join(" · ") || "사용 없음"}</strong>${icon("chevron-down")}</summary>${timeline(win)}<div class="timeline-legend"><span class="legend-off">주말·공휴일</span><span class="legend-leave">연차 사용</span></div></details><p class="schedule-scope">${win.days}일은 휴가 가능 기간입니다. 아래 항공권의 실제 체류일은 각각 달라요.</p>`;
  $("#selected-period").textContent = `${shortDate(win.start)} — ${shortDate(win.end)} · 이 휴가 안에 다녀오는`;
}
function overviewFare(win) {
  const item = state.overview.get(win.id);
  if (!item) return `<span class="window-loading">${state.overviewState === "error" ? "가격 조회 실패" : "왕복 가격 확인 중"}</span>`;
  if (item.status === "error") return `<span class="window-error">가격 조회 실패 · 다시 조회 가능</span>`;
  if (item.status === "empty" || !item.cheapest) return `<span class="window-empty">조회된 항공권 없음 · 조건 변경 가능</span>`;
  const f = item.cheapest, long = item.longStay;
  return `<span class="window-fare"><span>${escape(f.city)} · ${f.nights}박 ${f.nights + 1}일</span><strong>${money(f.price)}<small>원부터</small></strong></span><span class="window-trip-date">${periodLabel(f.start,f.end)} · 필요 연차 ${f.leave.length}일</span>${long && long.nights > f.nights ? `<span class="window-long">길게 ${escape(long.city)} ${long.nights}박 · ${money(long.price)}원</span>` : `<span class="window-long">${item.destinationsCount}개 목적지 확인</span>`}${item.stale ? '<span class="window-error">이전 수집 가격</span>' : ''}`;
}
function renderWindows() {
  const windows = visibleWindows(), checked = windows.filter(w=>state.overview.has(w.id)), errors = checked.filter(w=>state.overview.get(w.id)?.status === "error").length;
  $("#window-count").textContent = `${state.month ? `${state.month}월 ` : ""}연휴 ${windows.length}개`;
  $("#month-caption").textContent = state.month ? `${state.month}월` : "전체";
  $("#overview-status").textContent = state.overviewState === "error" ? state.overviewError : `${checked.length}/${windows.length}개 확인${state.overviewState === "loading" ? " 중" : ""}${errors ? ` · ${errors}개 조회 실패` : ""} · 전체 목적지 기준`;
  $("#overview-retry").hidden = !errors && state.overviewState !== "error";
  $("#window-list").setAttribute("aria-busy", String(state.overviewState === "loading"));
  $("#window-list").innerHTML = windows.length ? windows.slice(0,state.windowVisible).map(win=>`<button class="window-option ${state.selected?.id === win.id ? "selected" : ""}" data-window="${win.id}" aria-pressed="${state.selected?.id === win.id}"><span class="window-option-top"><strong>${escape(win.title)}</strong>${icon(state.selected?.id === win.id ? "circle-check" : "arrow-up-right")}</span><span class="window-option-date">${periodLabel(win.start,win.end)}</span><span class="window-option-bottom">연차 <b>${win.leave.length}일</b>${icon("arrow-right")}<strong>휴가 최대 ${win.days}일</strong></span>${overviewFare(win)}</button>`).join("") : `<div class="empty small"><strong>이 조건에 맞는 연휴가 없어요</strong><button class="text-button" data-reset-month>전체 달 보기</button></div>`;
  $("#more-windows").innerHTML = windows.length > state.windowVisible ? `<button class="text-button" data-more-windows>연휴 ${Math.min(4,windows.length-state.windowVisible)}개 더 보기 (${state.windowVisible}/${windows.length})${icon("chevron-down")}</button>` : "";
  renderMonthPrices();
}
function renderMonthPrices() {
  $$("[data-month]").forEach(button=>{
    const choices = state.allWindows.filter(win=>rangeDays(win.start,win.end).some(day=>Number(day.date.slice(0,4))===state.year && Number(day.date.slice(5,7))===Number(button.dataset.month)));
    const items = choices.map(w=>state.overview.get(w.id)), prices = items.filter(i=>i?.status === "ready" && i.cheapest).map(i=>i.cheapest.price), done = items.filter(Boolean).length;
    button.querySelector("small").textContent = prices.length ? `${money(Math.min(...prices))}원~` : done < choices.length ? "조회 중" : choices.length ? "수집 운임 없음" : "연휴 없음";
  });
}
async function loadOverview() {
  overviewController?.abort();
  const serial = ++overviewSerial, controller = new AbortController();
  overviewController = controller;
  state.overview = new Map(); state.overviewState = "loading"; state.overviewError = ""; renderWindows();
  const query = {origin:state.origin,year:String(state.year),maxLeave:String(state.maxLeave),minNights:String(state.minNights),buffer:String(state.buffer),month:String(state.month)};
  const fetchPage = async(page)=>{
    const response = await fetch(`/api/overview?${new URLSearchParams({...query,page:String(page)})}`,{signal:controller.signal,headers:{Accept:"application/json"}});
    const data = await response.json();
    if(!response.ok || !Array.isArray(data.windows)) throw new Error(data.error?.message || "연휴 가격을 불러오지 못했어요.");
    if(serial !== overviewSerial) return null;
    data.windows.forEach(win=>state.overview.set(win.id,win)); renderWindows();
    return data;
  };
  try {
    const first = await fetchPage(1); if(!first) return;
    const last = Math.ceil(first.totalWindows / first.pageSize);
    for(let page=2;page<=last;page+=2) {
      await Promise.all([fetchPage(page),page+1<=last ? fetchPage(page+1) : Promise.resolve()]);
      if(serial !== overviewSerial) return;
    }
    if(serial !== overviewSerial) return;
    state.overviewState = "ready"; renderWindows();
  } catch(error) {
    if(error.name === "AbortError" || serial !== overviewSerial) return;
    state.overviewState = "error"; state.overviewError = error.message; renderWindows();
  }
}
function render() {
  $("#year-caption").textContent = `${state.year}년 연휴 비교`;
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
  $("#window-sort").value = state.windowSort;
  $("#flight-sort").value = state.flightSort;
  $("#deals-only").checked = state.dealsOnly;
  $("#preference-summary").textContent = `${state.minNights}박 이상${state.buffer ? " · 복귀 여유 하루" : " · 복귀 여유 없음"}${state.exact ? " · 날짜 고정" : ""}`;
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
          (d) => Number(d.date.slice(0, 4)) === state.year && Number(d.date.slice(5, 7)) === month,
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
function offerOption(flight,label,base) {
  const delta = base ? flight.price - base.price : 0;
  return `<button class="offer-option ${base ? "long-option" : "cheap-option"}" data-detail="${flight.id}" aria-label="${escape(flight.city)} ${label} ${flight.nights}박 ${money(flight.price)}원 상세 보기"><span class="offer-kind">${label}${base && flight.nights > base.nights ? `<span class="trip-gain">${flight.nights-base.nights}박 더</span>` : ""}</span><span class="offer-itinerary"><strong>${flight.nights}박 ${flight.nights+1}일</strong><span>${periodLabel(flight.start,flight.end)}</span><span>필요 연차 ${flight.leave.length}일${state.buffer ? " · 여유 포함" : ""}</span></span><span class="offer-price"><strong>${money(flight.price)}<small>원</small></strong><span>${base ? `${delta > 0 ? "+" : ""}${money(delta)}원 차이` : `${escape(flight.sellers[0]?.name || "판매처")} · 1인 왕복`}</span></span>${icon("chevron-right")}</button>`;
}
function renderFlights() {
  const grid = $("#flight-grid");
  grid.setAttribute("aria-busy",String(state.searchState === "loading"));
  $("#preference-summary").textContent = `${state.minNights}박 이상${state.buffer ? " · 복귀 여유 하루" : " · 복귀 여유 없음"}${state.exact ? " · 날짜 고정" : ""}`;
  if(state.searchState === "loading") {
    grid.innerHTML = `<div class="empty loading-state">${icon("plane")}<h3>선택한 휴가의 항공권을 조회하고 있어요</h3><p>가장 싼 일정과 길게 머무는 일정을 함께 찾습니다.</p></div>`;
    $("#fare-status").textContent = "항공권 조회 중"; return;
  }
  if(state.searchState === "error") {
    grid.innerHTML = `<div class="empty">${icon("info")}<h3>항공권을 조회하지 못했어요</h3><p>${escape(state.searchError)}</p><button class="button primary" data-retry-flights>다시 조회</button></div>`;
    $("#fare-status").textContent = "조회 실패 · 선택한 조건은 유지됩니다"; return;
  }
  const flights = filterFlights(state.flights,{budget:state.budget,region:state.region,sort:state.flightSort,dealsOnly:state.dealsOnly,alternatives:state.alternatives});
  $("#fare-status").textContent = state.fareMeta ? `${flights.length}개 목적지 · ${sourceTime(state.fareMeta.updatedAt)} 수집${state.fareMeta.stale ? " · 이전 수집 운임" : ""}${state.fareMeta.complete ? "" : " · 일부 노선"}` : "떠날 일정을 골라 주세요";
  $("#fare-notice").innerHTML = `${icon("info")}<span>${state.fareMeta?.stale ? escape(state.fareMeta.warning) : "최근 수집된 성인 1인·일반석 왕복 요금입니다. 한국 도착 시각·수하물·최종 가격은 판매처에서 확인해 주세요."} <a href="https://catchfrog.ai/" target="_blank" rel="noopener noreferrer">Catchfrog 제공 ↗</a>${state.fareMeta?.alternativesStatus === "partial" ? `<strong class="alternatives-warning">긴 체류 대안 조회에 일부 실패했습니다. 최저가 조회 결과를 표시합니다.</strong>` : ""}</span>`;
  grid.innerHTML = flights.length ? flights.slice(0,state.visibleCount).map(flight=>{
    const options = state.alternatives[flight.code] || [flight], long = options.find(f=>f.nights > flight.nights && f.id !== flight.id), longVisible = long && (!state.budget || long.price <= state.budget), meta=DESTINATIONS.find(d=>d.code===flight.code);
    return `<article class="flight-card"><div class="destination-heading">${meta ? `<img class="destination-thumb" src="/assets/${meta.image}" alt="${meta.alt}" width="72" height="72" loading="lazy">` : `<span class="destination-symbol" aria-hidden="true">${icon("plane")}</span>`}<div><h3><button class="destination-name" data-detail="${flight.id}" aria-label="${escape(flight.city)} 항공권 상세 보기">${escape(flight.city)}${icon("arrow-up-right")}</button></h3><span class="destination-country">${escape(flight.country)} · ${flight.code}</span></div>${flight.discount > 0 ? `<span class="deal-badge">노선 평균보다 ${flight.discount.toFixed(1)}% ↓</span>` : ""}<button class="card-save ${isSaved(flightItem(flight)) ? "saved" : ""}" data-save-offer="${flight.id}" aria-label="${escape(flight.city)} ${isSaved(flightItem(flight)) ? "저장 취소" : "여행 저장"}" aria-pressed="${isSaved(flightItem(flight))}">${icon("bookmark")}</button></div><div class="offer-comparison">${offerOption(flight,"최저가 일정")}${longVisible ? offerOption(long,"길게 머물기",flight) : ""}</div>${long && !longVisible ? `<p class="option-note">같은 목적지 ${long.nights}박 대안은 ${money(long.price)}원으로 선택한 예산을 넘습니다.</p>` : ""}<div class="card-footnote"><span>${flight.average ? `노선 수집 평균 ${money(flight.average)}원` : "노선 평균 미제공"}</span><button class="history-link" data-detail="${flight.id}">판매처 ${flight.sellers.length}곳 · 가격 이력${icon("arrow-right")}</button></div></article>`;
  }).join("") + (flights.length > state.visibleCount ? `<div class="more-flights"><button class="button secondary" data-more-flights>항공권 더 보기 (${state.visibleCount}/${flights.length})${icon("chevron-down")}</button></div>` : "") : `<div class="empty">${icon("search")}<h3>${!state.selected ? "먼저 떠날 일정을 골라 주세요" : state.flights.length ? "조건에 맞는 항공권이 없어요" : "이 날짜에 조회된 항공권이 없어요"}</h3><p>${state.flights.length ? "예산이나 여행지 분류를 바꿔 보세요." : "숙박일을 줄이거나 다른 연휴를 골라 주세요. 수집되지 않은 항공권에는 가격을 표시하지 않습니다."}</p>${state.flights.length ? '<button class="button secondary" data-reset-flights>여행지 필터 초기화</button>' : `${state.selected && state.minNights > 1 ? '<button class="button secondary" data-relax-nights>최소 1박으로 다시 조회</button>' : ''}<button class="button secondary" data-open-custom>직접 날짜 고르기</button>`}</div>`;
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
      alternatives: "1",
    },
    query = new URLSearchParams(input).toString();
  const cached = queryCache.get(query);
  $("#return-cutoff").textContent = state.exact
    ? `${shortDate(input.start)} 출발 · ${shortDate(addDays(input.end, -state.buffer))} 귀국편`
    : `귀국편 출발 마감 ${shortDate(addDays(input.end, -state.buffer))}`;
  state.visibleCount = 12;
  state.flights = [];
  state.fareMeta = null;
  state.alternatives = {};
  state.searchError = "";
  state.searchState = "loading";
  renderFlights();
  if (!refresh && cached && Date.now() - cached.at < 120000) {
    state.flights = cached.data.flights;
    state.fareMeta = cached.data;
    state.alternatives = cached.data.alternatives || {};
    state.searchState = "ready";
    renderFlights();
    restoreDetailFromUrl();
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
    state.alternatives = data.alternatives || {};
    state.searchState = "ready";
    if (queryCache.size >= 20)
      queryCache.delete(queryCache.keys().next().value);
    queryCache.set(query, { at: Date.now(), data });
    renderFlights();
    restoreDetailFromUrl();
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
function allOffers() { return [...state.flights,...Object.values(state.alternatives).flat()]; }
function restoreDetailFromUrl() {
  const offer = new URLSearchParams(location.search).get("offer");
  if (!offer) return;
  const flight = allOffers().find(f=>`${f.code}~${f.start}~${f.end}` === offer);
  if(flight) openDetail(flight, false);
  else { toast("이 일정의 현재 운임을 찾지 못했어요. 조회된 다른 항공권을 확인해 주세요."); syncUrl(); }
}
function openDetail(id, push = true) {
  const flight =
    typeof id === "object" ? id : allOffers().find((item) => item.id === id);
  if (!flight) return;
  detailReturnFocus = document.activeElement;
  detailReturnSelector = detailReturnFocus?.dataset.detail ? `.${detailReturnFocus.classList[0]}[data-detail="${CSS.escape(detailReturnFocus.dataset.detail)}"]` : null;
  detailFlight = flight;
  if(push) syncUrl(true);
  const root = $("#detail-dialog");
  root.dataset.offer = flight.id;
  const calendar = makeWindow(flight.start, flight.recoveryEnd);
  root.innerHTML = `<div class="detail-image">${artwork(flight, true)}<button class="icon-button dialog-close" aria-label="닫기">${icon("x")}</button><span>${escape(flight.country)} · ${flight.code}</span></div><div class="detail-body"><span class="section-caption">${ORIGINS[flight.origin]}에서 떠나는 실제 수집 항공권</span><h2 id="detail-title">${escape(flight.city)}, ${flight.nights}박 ${flight.nights + 1}일.</h2><p class="detail-date">${periodLabel(flight.start, flight.end)} · ${flight.start.slice(0, 4)}년</p><div class="detail-stats"><div><span>필요 연차${state.buffer ? " · 여유 포함" : ""}</span><strong>${flight.leave.length}일</strong></div><div><span>여행 일정</span><strong>${flight.nights}박 ${flight.nights + 1}일</strong></div><div><span>비교 판매처</span><strong>${flight.sellers.length}곳</strong></div></div>${timeline(calendar)}<p class="leave-detail">연차 신청: <strong>${flight.leave.map(shortDate).join(" · ") || "사용 없음"}</strong></p><p class="arrival-note">귀국편 출발일 ${shortDate(flight.end)}${state.buffer ? ` · 복귀 여유 ${shortDate(flight.recoveryEnd)}` : ""}. 한국 도착일과 추가 연차는 판매처에서 확인해 주세요.</p><p class="schedule-unverified">항공사·편명·출도착 시각·경유·수하물 조건은 이 조회에 제공되지 않습니다. 예약 전 판매처에서 확인하세요.</p><div class="detail-price"><div><span>조회된 판매처 중 1인 왕복 최저</span><strong>${money(flight.price)}<small>원</small></strong></div>${flight.average ? `<span>노선 수집 평균<br>${money(flight.average)}원</span>` : ""}</div><p class="detail-disclaimer">${flight.observedAt ? `${sourceTime(flight.observedAt)} 판매처 가격 수집. ` : ""}최근 수집 요금이며 결제 시점의 운임·좌석·수하물 조건은 달라질 수 있어요.</p><div class="seller-list">${flight.sellers.map((seller) => `<a href="${bookUrl(flight, seller.partner)}" target="_blank" rel="noopener noreferrer" class="seller-row" aria-label="${escape(seller.name)} ${money(seller.price)}원 항공권 확인"><span>${escape(seller.name)}</span><strong>${money(seller.price)}원</strong>${icon("arrow-up-right")}</a>`).join("")}</div><div class="history-heading"><h3>이 일정, 가격은 어땠을까요?</h3><label><span class="sr-only">가격 이력 판매처</span><select id="history-partner">${flight.sellers.map((seller) => `<option value="${seller.partner}">${escape(seller.name)}</option>`).join("")}</select></label></div><div id="price-history" class="price-history"></div><div class="detail-actions"><button class="button secondary" data-detail-save>${icon("bookmark")}이 여행 저장</button><button class="button secondary" data-detail-calendar>${icon("calendar-plus")}캘린더에 추가</button></div><a class="skyscanner-link" href="${searchUrl(flight, flight, flight.origin)}" target="_blank" rel="noopener noreferrer">같은 날짜로 스카이스캐너에서도 확인 ↗</a></div>`;
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
function switchView(view, push = true) {
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
  syncUrl(push);
  if(push) window.scrollTo({
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
  loadOverview();
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
  syncUrl(true);
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
    state.windowVisible = 4;
    state.selected = visibleWindows()[0] || null;
    render();
    loadFlights();
    loadOverview();
    $(`[data-month="${state.month}"]`).focus({ preventScroll: true });
  } else if (
    target.id === "month-all" ||
    target.matches("[data-reset-month]")
  ) {
    state.month = 0;
    selectWindow(visibleWindows()[0] || null);
    render();
    loadOverview();
  } else if (target.matches("[data-more-windows]")) {
    state.windowVisible += 4; renderWindows();
  } else if (target.id === "overview-retry") { loadOverview();
  } else if (target.matches("[data-window]")) {
    selectWindow(state.allWindows.find((w) => w.id === target.dataset.window));
    $(`[data-window="${state.selected.id}"]`).focus({ preventScroll: true });
    $("#trip-results").scrollIntoView({block:"start",behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth"});
  } else if (target.matches("[data-more-flights]")) {
    const previous = state.visibleCount;
    state.visibleCount += 12;
    renderFlights();
    $$(".destination-name")[previous]?.focus({ preventScroll: true });
  } else if (target.matches("[data-region]")) {
    state.visibleCount = 12;
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
  else if (target.matches("[data-relax-nights]")) {
    state.minNights=1; $("#min-nights").value="1"; syncUrl(); loadFlights(); loadOverview();
  }
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
  loadOverview();
});
$("#budget").addEventListener("change", (e) => {
  state.budget = Number(e.target.value);
  renderFlights();
  syncUrl();
});
$("#window-sort").addEventListener("change", (e) => {
  state.windowSort = e.target.value;
  renderWindows();
  syncUrl();
});
$("#flight-sort").addEventListener("change", (e) => {
  state.flightSort = e.target.value;
  renderFlights();
  syncUrl();
});
$("#min-nights").addEventListener("change", (e) => {
  state.minNights = Number(e.target.value);
  syncUrl();
  loadFlights();
  loadOverview();
});
$("#return-buffer").addEventListener("change", (e) => {
  state.buffer = e.target.checked ? 1 : 0;
  syncUrl();
  loadFlights();
  loadOverview();
});
$("#exact-dates").addEventListener("change", (e) => {
  state.exact = e.target.checked;
  syncUrl();
  loadFlights();
});
$("#deals-only").addEventListener("change", (e) => {
  state.dealsOnly = e.target.checked;
  renderFlights();
  syncUrl();
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
  loadOverview();
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
  if(suppressDetailClose > 0) { suppressDetailClose--; return; }
  historyController?.abort();
  detailFlight = null;
  if(!restoringHistory) {
    if(history.state?.detail) history.back();
    else syncUrl();
  }
  detailReturnFocus?.focus?.({preventScroll:true});
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
  daysBetween(params.get("start"), params.get("end")) <= 16
)
  state.selected = makeWindow(params.get("start"), params.get("end"));
else state.selected = visibleWindows()[0] || null;
render();
loadFlights();
loadOverview();
switchView(state.view, false);
window.addEventListener("popstate",async()=>{
  restoringHistory = true;
  const wasDetailOpen = $("#detail-dialog").open;
  const q = new URLSearchParams(location.search), previousQuery = `${state.origin}|${state.selected?.start}|${state.selected?.end}|${state.minNights}|${state.buffer}|${state.exact}`;
  const number = (key,allowed,fallback)=>allowed.includes(Number(q.get(key))) ? Number(q.get(key)) : fallback;
  state.year = number("year",[2026,2027],2027); state.maxLeave=number("leave",[0,1,2,3,4,5],2);
  state.origin=ORIGINS[q.get("origin")] ? q.get("origin") : "ICN";
  state.month=number("month",Array.from({length:13},(_,i)=>i),0);
  state.minNights=number("minNights",[1,2,3,4,5,7],2); state.buffer=number("buffer",[0,1],1); state.exact=q.get("exact")==="1";
  state.budget=number("budget",[0,200000,300000,400000,600000],0); state.region=["all","japan","asia","europe","beach"].includes(q.get("region")) ? q.get("region") : "all";
  state.dealsOnly=q.get("deals")==="1"; state.windowSort=q.get("windowSort")||"longest"; state.flightSort=q.get("flightSort")||"price";
  state.allWindows=findWindows({year:state.year,maxLeave:state.maxLeave,today});
  state.selected=validDate(q.get("start"))&&validDate(q.get("end"))&&q.get("start")>=today&&q.get("start")<q.get("end")&&daysBetween(q.get("start"),q.get("end"))<=16 ? makeWindow(q.get("start"),q.get("end")) : visibleWindows()[0]||null;
  if(!q.has("offer")&&$("#detail-dialog").open) { suppressDetailClose++; $("#detail-dialog").close(); detailFlight=null; }
  render(); switchView(q.get("view")==="saved" ? "saved" : "plan",false);
  const nextQuery=`${state.origin}|${state.selected?.start}|${state.selected?.end}|${state.minNights}|${state.buffer}|${state.exact}`;
  if(previousQuery!==nextQuery) { await loadFlights(); loadOverview(); } else restoreDetailFromUrl();
  restoringHistory=false;
  if(!q.has("offer") && detailReturnSelector) $(detailReturnSelector)?.focus({preventScroll:true});
});
