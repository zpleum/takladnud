const API = "/api/v1";
const state = { user: null, shop: null, csrfToken: "", sessions: [], sessionId: "", publicSessionId: "", requestedPublicSession: "", pendingPage: "", stalls: [], selected: new Set(), zoom: 1, page: 1, totalPages: 0, totalBookings: 0, authMode: "login", publicTimer: null };
const statusEl = document.querySelector("#status");
const toastRegion = document.querySelector("#toast-region");
const authDialog = document.querySelector("#auth-dialog");
const money = new Intl.NumberFormat("th-TH", { style: "currency", currency: "THB", maximumFractionDigits: 0 });
const byId = (id) => document.getElementById(id);

function escapeHtml(value = "") {
  return String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
}

async function request(path, options = {}) {
  const response = await fetch(`${API}${path}`, {
    credentials: "same-origin",
    headers: { ...(options.body && !(options.body instanceof FormData) ? { "Content-Type": "application/json" } : {}), ...(state.csrfToken && options.method && !["GET", "HEAD"].includes(options.method.toUpperCase()) ? { "X-CSRF-Token": state.csrfToken } : {}), ...(options.headers || {}) },
    ...options,
  });
  if (response.status === 204) return null;
  let result;
  try { result = await response.json(); }
  catch { throw new Error("ข้อมูลตอบกลับจากเซิร์ฟเวอร์ไม่ถูกต้อง กรุณาลองใหม่"); }
  state.paginationMeta = result.meta || null;
  if (result.meta) state.totalPages = result.meta.totalPages || 0;
  else if (response.headers.has("X-Pagination")) {
    try { state.totalPages = JSON.parse(response.headers.get("X-Pagination")).totalPages || 0; } catch { state.totalPages = 0; }
  }
  if (!response.ok) {
    const error = new Error(result.error?.message || "เกิดข้อผิดพลาด กรุณาลองอีกครั้ง");
    error.status = response.status;
    error.code = result.error?.code;
    throw error;
  }
  return result.data;
}

function toast(message) {
  const item = document.createElement("div");
  item.className = "toast";
  item.textContent = message;
  toastRegion.append(item);
  window.setTimeout(() => item.remove(), 3600);
}

function showHealth(ok, message) {
  statusEl.textContent = message;
  byId("footer-health").textContent = ok ? "ระบบพร้อมใช้งาน" : "ระบบยังไม่พร้อม";
  byId("footer-health").style.color = ok ? "#285b49" : "#a44d43";
}

function openAuth(mode = "login") {
  state.authMode = mode;
  renderAuthFields();
  if (!authDialog.open) authDialog.showModal();
}

function renderAuthFields() {
  const register = state.authMode === "register";
  document.querySelectorAll(".auth-tab").forEach((tab) => tab.classList.toggle("active", tab.dataset.auth === state.authMode));
  byId("auth-submit").innerHTML = `${register ? "สมัครร้านค้า" : "เข้าสู่ระบบ"} <span aria-hidden="true">→</span>`;
  byId("auth-message").textContent = "";
  byId("auth-fields").innerHTML = register
    ? '<label>ชื่อร้าน<input name="shopName" required maxlength="120" autocomplete="organization" placeholder="ชื่อร้านของคุณ"></label><label>ชื่อผู้ติดต่อ<input name="contactName" required maxlength="120" autocomplete="name" placeholder="ชื่อผู้ดูแลร้าน"></label><label>เบอร์ติดต่อร้าน<input name="contactPhone" inputmode="tel" maxlength="20" autocomplete="tel" placeholder="ลูกค้าจะเห็นเบอร์นี้"></label><label>อีเมล<input name="email" type="email" required maxlength="254" autocomplete="email" placeholder="name@example.com"></label><label>รหัสผ่าน<input name="password" type="password" required minlength="10" autocomplete="new-password" placeholder="อย่างน้อย 10 ตัวอักษร"></label>'
    : '<label>อีเมล<input name="email" type="email" required maxlength="254" autocomplete="email" placeholder="name@example.com"></label><label>รหัสผ่าน<input name="password" type="password" required autocomplete="current-password" placeholder="รหัสผ่านของคุณ"></label>';
}

function setPage(page) {
  const target = document.querySelector(`[data-page="${page}"]`);
  if (!target) page = "home";
  if (["stalls", "bookings", "profile"].includes(page) && !state.user) {
    state.pendingPage = page;
    openAuth("login");
    page = "home";
  }
  document.querySelectorAll("[data-page]").forEach((section) => { section.hidden = section.dataset.page !== page; });
  document.querySelectorAll(".nav-link").forEach((link) => link.classList.toggle("active", link.dataset.view === page));
  const hash = page === "bookings" ? "my-bookings" : page === "market" ? "market-map" : page;
  const targetHash = page === "market" && (state.requestedPublicSession || state.publicSessionId)
    ? `#${hash}?session=${encodeURIComponent(state.requestedPublicSession || state.publicSessionId)}`
    : `#${hash}`;
  if (location.hash !== targetHash) {
    history.replaceState(null, "", targetHash);
  }
  if (page === "bookings") loadBookings();
  if (page === "stalls") loadMarketData();
  if (page === "market") loadPublicMarket();
  if (page === "profile") loadProfile();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function navFromHash() {
  const [hash, query = ""] = location.hash.slice(1).split("?", 2);
  state.requestedPublicSession = new URLSearchParams(query).get("session") || "";
  const page = hash === "my-bookings" ? "bookings" : hash === "market-map" ? "market" : hash === "stalls" ? "stalls" : hash === "profile" ? "profile" : "home";
  setPage(page);
}

function renderMiniStalls(stalls = []) {
  const container = byId("mini-stalls");
  container.innerHTML = stalls.length
    ? stalls.slice(0, 24).map((stall) => `<span class="stall-chip ${stall.availability === "booked" ? "taken" : ""}">${escapeHtml(stall.code || stall.stall_code || "แผง")}</span>`).join("")
    : '<span class="empty-note">กำลังโหลดผังตลาด...</span>';
}

function renderBookings(bookings = []) {
  state.bookings = bookings;
  const recent = byId("recent-bookings");
  const rows = bookings.slice(0, 3);
  recent.innerHTML = rows.length ? rows.map((item) => `<article class="booking-row"><span class="booking-mark" aria-hidden="true"><svg class="ui-icon" viewBox="0 0 24 24"><path d="M7 4h13v16H7zM4 7v13"/><path d="M10 8h7M10 12h7M10 16h5"/></svg></span><div class="booking-info"><strong>แผง ${escapeHtml(item.stallCode || item.stall_code || "—")}</strong><small>${escapeHtml(item.sessionName || item.session_name || "รอบตลาด")} · ${escapeHtml(formatDate(item.startsAt || item.starts_at))}</small></div><div class="booking-meta"><strong>${money.format(Number(item.priceAtBooking ?? item.price_at_booking ?? 0))}</strong><span class="status-badge ${statusClass(item.status)}">${statusLabel(item.status)}</span></div></article>`).join("") : '<p class="empty-note">ยังไม่มีรายการจอง ลองเลือกแผงสำหรับรอบตลาดถัดไป</p>';
}

async function logout() {
  try {
    await request("/auth/logout", { method: "POST", body: "{}" });
  } catch (error) {
    if (error.status !== 401) { toast(error.message); return; }
  }
  state.user = null;
  state.shop = null;
  state.csrfToken = "";
  document.querySelector(".account-copy b").textContent = "ร้านของฉัน";
  document.querySelector(".account-copy small").textContent = "เข้าสู่ระบบ";
  document.querySelector(".avatar").textContent = "ร";
  state.pendingPage = "";
  toast("ออกจากระบบแล้ว");
  setPage("home");
}

function formatDate(value) {
  if (!value) return "วันที่ตามรอบตลาด";
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? "วันที่ตามรอบตลาด" : new Intl.DateTimeFormat("th-TH", { day: "numeric", month: "short", year: "numeric" }).format(date);
}

function formatTime(value) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? "—" : new Intl.DateTimeFormat("th-TH", { hour: "2-digit", minute: "2-digit", hour12: false }).format(date);
}

function updateMarketBanner(market, session) {
  byId("banner-market-name").textContent = market.name || "ตลาด";
  byId("banner-address").textContent = market.address || market.description || "ดูข้อมูลตลาด";
  byId("banner-date").textContent = formatDate(session.startsAt);
  byId("banner-time").textContent = `${formatTime(session.startsAt)}–${formatTime(session.endsAt)}`;
  const startsAt = new Date(session.startsAt);
  const days = Number.isNaN(startsAt.valueOf()) ? null : Math.max(0, Math.floor((startsAt - Date.now()) / 86400000));
  byId("banner-countdown").innerHTML = days == null ? "—" : `${days} <small>วัน</small>`;
  byId("home-map-summary").textContent = `${market.name || "ตลาด"} · ${state.stalls.length} แผง`;
  byId("home-map-updated").textContent = market.description || "ผังตลาด";
}

function statusLabel(status) {
  return ({ confirmed: "ยืนยันแล้ว", pending: "รอตรวจสอบ", cancelled: "ยกเลิก", rejected: "ไม่อนุมัติ" })[status] || "ไม่ทราบสถานะ";
}

function statusClass(status) {
  return ({ confirmed: "status-confirmed", pending: "status-pending", cancelled: "status-cancelled", rejected: "status-rejected" })[status] || "status-unknown";
}

function renderBookingsPage() {
  const rows = byId("booking-table");
  const filtered = state.bookings;
  rows.innerHTML = '<div class="booking-table-row header"><span>แผง / รอบตลาด</span><span>วันตลาด</span><span>สถานะ</span><span>ค่าเช่า</span><span>จัดการ</span></div>' + (filtered.length ? filtered.map((item) => `<div class="booking-table-row"><strong>แผง ${escapeHtml(item.stallCode || item.stall_code || "—")}<small>${escapeHtml(item.sessionName || item.session_name || "รอบตลาด")}</small></strong><span>${escapeHtml(formatDate(item.startsAt || item.starts_at))}</span><span class="status-badge ${statusClass(item.status)}">${statusLabel(item.status)}</span><strong>${money.format(Number(item.priceAtBooking ?? item.price_at_booking ?? 0))}</strong><div class="row-actions">${["confirmed", "pending"].includes(item.status) ? `<button class="small-action" data-booking-action="edit" data-booking-id="${escapeHtml(item.id)}">แก้ไข</button>` : ""}${item.status !== "cancelled" ? `<button class="small-action danger" data-booking-action="cancel" data-booking-id="${escapeHtml(item.id)}">ยกเลิก</button>` : ""}</div></div>`).join("") : '<p class="empty-note">ไม่พบรายการจองในตัวกรองนี้</p>');
  const pagination = byId("booking-pagination");
  if (state.totalPages <= 1) { pagination.innerHTML = ""; return; }
  pagination.innerHTML = `<button type="button" data-booking-page="${state.page - 1}" ${state.page <= 1 ? "disabled" : ""} aria-label="หน้าก่อนหน้า">ก่อนหน้า</button><span aria-live="polite">หน้า ${state.page} จาก ${state.totalPages}</span><button type="button" data-booking-page="${state.page + 1}" ${state.page >= state.totalPages ? "disabled" : ""} aria-label="หน้าถัดไป">ถัดไป</button>`;
}

async function loadBookings() {
  if (!state.user) return;
  try {
    const status = byId("booking-filter").value;
    const query = new URLSearchParams({ page: String(state.page), limit: "20" });
    if (status) query.set("status", status);
    if (byId("booking-session-filter").value) query.set("sessionId", byId("booking-session-filter").value);
    const result = await request(`/bookings?${query}`);
    const list = result.data || [];
    if (state.paginationMeta) state.totalBookings = state.paginationMeta.total;
    if (state.page > state.totalPages) {
      state.page = state.totalPages || 1;
      if (state.page !== Number(query.get("page"))) return loadBookings();
    }
    renderBookings(list);
    renderBookingsPage();
  } catch (error) {
    if (error.status === 401) { state.user = null; return; }
    toast(error.message);
  }
}

async function loadDashboard() {
  if (!state.user) return;
  try {
    const result = await request("/shop/dashboard");
    state.shop = result?.shop || state.shop;
    if (result?.shop?.name) document.querySelector(".account-copy b").textContent = result.shop.name;
    if (result?.confirmedCount != null) document.querySelectorAll(".stat-card strong")[2].textContent = String(result.confirmedCount);
    if (result?.recentBookings) renderBookings(result.recentBookings);
  } catch (error) {
    if (error.status === 401) { state.user = null; return; }
    toast(error.message);
  }
}

async function loadSessions(selectId, publicMode = false) {
  const select = byId(selectId);
  try {
    const marketResponse = await fetch(`${API}/markets?page=1&limit=20`);
    if (!marketResponse.ok) throw new Error("ยังไม่มีข้อมูลตลาดในระบบ");
    const markets = (await marketResponse.json()).data;
    const marketList = markets || [];
    if (!marketList.length) throw new Error("ยังไม่มีข้อมูลตลาดในระบบ");
    const market = marketList[0];
    state.market = market;
    const sessionResponse = await fetch(`${API}/markets/${encodeURIComponent(market.id)}/sessions?from=${encodeURIComponent(new Date().toISOString().slice(0, 10))}`);
    if (!sessionResponse.ok) throw new Error("ยังไม่มีรอบตลาดที่เปิดให้แสดง");
    const sessions = (await sessionResponse.json()).data;
    const list = sessions || [];
    state.sessions = list;
    if (!list.length) throw new Error("ยังไม่มีรอบตลาดที่เปิดให้แสดง");
    const bookingFilter = byId("booking-session-filter");
    const selectedSession = bookingFilter.value;
    bookingFilter.innerHTML = '<option value="">ทุกรอบ</option>' + list.map((session) => `<option value="${escapeHtml(session.id)}">${escapeHtml(session.name)}</option>`).join("");
    if (list.some((item) => String(item.id) === selectedSession)) bookingFilter.value = selectedSession;
    select.innerHTML = list.map((session) => `<option value="${escapeHtml(session.id)}">${escapeHtml(session.name)} · ${escapeHtml(formatDate(session.startsAt || session.starts_at))}</option>`).join("");
    if (publicMode) {
      const desired = state.requestedPublicSession || state.publicSessionId;
      state.publicSessionId = list.some((item) => String(item.id) === String(desired)) ? String(desired) : String(list[0].id);
      select.value = state.publicSessionId;
      state.requestedPublicSession = "";
    } else {
      if (state.sessionId && list.some((item) => String(item.id) === String(state.sessionId))) select.value = state.sessionId;
      else { state.sessionId = String(list[0].id); select.value = state.sessionId; }
    }
    return list;
  } catch (error) {
    select.innerHTML = `<option value="">${escapeHtml(error.message)}</option>`;
    return [];
  }
}

async function loadMap(sessionId, publicMode = false) {
  const response = await fetch(`${API}/sessions/${encodeURIComponent(sessionId)}/map`, { credentials: "same-origin" });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error?.message || "ไม่สามารถโหลดแผนผังได้");
  const mapData = result.data;
  const data = mapData;
  const session = data.session || {};
  const market = data.market || {};
  const stalls = data.stalls || [];
  if (!publicMode) state.stalls = stalls;
  const mapId = publicMode ? "public-map" : "full-map";
  const map = byId(mapId);
  map.style.display = "block";
  map.innerHTML = stalls.map((stall) => {
    const availability = stall.availability || "available";
    const own = stall.ownBooking || stall.isMine;
    const name = stall.code || stall.stallCode || stall.stall_code || "แผง";
    const bookedShop = stall.shop?.name ? `<small>${escapeHtml(stall.shop.name)}</small>` : "";
    return `<button class="map-stall ${availability === "booked" ? "booked" : ""} ${own ? "mine" : ""} ${!publicMode && state.selected.has(String(stall.id)) ? "selected" : ""}" style="left:${Number(stall.x ?? 0)}%;top:${Number(stall.y ?? 0)}%;width:${Math.max(4, Number(stall.width ?? 6))}%;height:${Math.max(5, Number(stall.height ?? 7))}%" data-stall-id="${escapeHtml(stall.id)}" data-public-shop-id="${escapeHtml(stall.shop?.id || "")}" data-availability="${escapeHtml(availability)}" data-code="${escapeHtml(name)}" data-price="${Number(stall.price ?? stall.basePrice ?? stall.base_price ?? 0)}" ${publicMode ? !stall.shop ? "disabled" : "" : availability !== "available" ? "disabled" : ""} aria-label="แผง ${escapeHtml(name)} ${stall.shop ? `ร้าน ${escapeHtml(stall.shop.name)}` : availability === "available" ? "ว่าง" : availability === "booked" ? "มีผู้จอง" : "ปิดใช้งาน"}"><strong>${escapeHtml(name)}</strong>${publicMode ? bookedShop : `<small>${availability === "available" ? money.format(Number(stall.price ?? stall.basePrice ?? stall.base_price ?? 0)) : own ? "ร้านของฉัน" : "มีผู้จอง"}</small>`}</button>`;
  }).join("");
  if (market.mapImage) map.style.backgroundImage = `linear-gradient(#10221d55,#10221d55),url("${String(market.mapImage).replace(/["\\]/g, "")}")`;
  map.style.backgroundSize = "100% 100%";
  map.style.backgroundRepeat = "no-repeat";
  const title = publicMode ? byId("public-map-title") : byId("stall-map-title");
  title.textContent = `${market.name || "ตลาด"} · ${session.name || "แผนผังแผง"}`;
  if (!publicMode) {
    const available = stalls.filter((item) => item.availability === "available").length;
    updateMarketBanner(market, session);
    document.querySelectorAll(".stat-card strong")[0].textContent = String(stalls.length);
    document.querySelectorAll(".stat-card strong")[1].textContent = String(available);
    document.querySelectorAll(".stat-card strong")[2].textContent = String(state.totalBookings);
    renderMiniStalls(stalls);
  }
  return data;
}

async function loadMarketData() {
  const sessions = await loadSessions("session-select");
  if (!sessions.length) return;
  state.sessionId = byId("session-select").value;
  try { await loadMap(state.sessionId); } catch (error) { byId("map-message").textContent = error.message; }
}

function renderSelection() {
  const selected = [...state.selected].map((id) => state.stalls.find((stall) => String(stall.id) === id)).filter(Boolean);
  byId("selection-count").textContent = String(selected.length);
  byId("selection-list").innerHTML = selected.length ? selected.map((stall) => `<div class="selection-item"><span>แผง ${escapeHtml(stall.code || stall.stallCode || stall.stall_code || "")}</span><span>${money.format(Number(stall.price ?? stall.basePrice ?? stall.base_price ?? 0))} <button type="button" data-remove-stall="${escapeHtml(stall.id)}" aria-label="นำแผงออก">×</button></span></div>`).join("") : '<p class="empty-note">ยังไม่ได้เลือกแผง</p>';
  byId("selection-total").textContent = money.format(selected.reduce((sum, stall) => sum + Number(stall.price ?? stall.basePrice ?? stall.base_price ?? 0), 0));
  byId("confirm-booking").disabled = !selected.length || !state.user;
  if (!state.user && selected.length) byId("map-message").textContent = "เข้าสู่ระบบร้านค้าก่อนยืนยันการจอง";
}

async function loadPublicMarket() {
  const sessions = await loadSessions("public-session-select", true);
  if (!sessions.length) return;
  state.publicSessionId = byId("public-session-select").value;
  await refreshPublic();
}

async function refreshPublic() {
  const sessionId = byId("public-session-select").value;
  if (!sessionId) return;
  state.publicSessionId = sessionId;
  try {
    await loadMap(sessionId, true);
    const query = new URLSearchParams({ page: "1", limit: "100", sort: "stallCode" });
    const text = byId("public-search").value.trim();
    const category = byId("category-filter").value;
    if (text) query.set("q", text);
    if (category) query.set("categoryId", category);
    const result = await request(`/public/sessions/${encodeURIComponent(sessionId)}/shops?${query}`);
    const shops = result || [];
    byId("public-shop-count").textContent = `${shops.length} ร้าน`;
    byId("public-shop-detail").hidden = true;
    byId("public-shop-list").innerHTML = shops.length ? shops.map((shop) => `<button type="button" class="public-shop-card" data-public-shop-id="${escapeHtml(shop.id)}" data-stall-code="${escapeHtml(shop.stallCode || "")}"><span class="public-shop-icon" aria-hidden="true">${shop.logoImage ? `<img src="${escapeHtml(shop.logoImage)}" alt="">` : '<svg class="ui-icon" viewBox="0 0 24 24"><path d="M3 10h18M5 10v10h14V10M4 10l2-6h12l2 6M9 20v-6h6v6"/></svg>'}</span><span><strong>${escapeHtml(shop.name)}</strong><small>${escapeHtml(shop.categories?.join(" · ") || "ร้านค้า")} · ${escapeHtml(shop.contactPhone || "ไม่ระบุเบอร์")}</small></span><span>${escapeHtml(shop.stallCode || "")}</span></button>`).join("") : '<p class="empty-note">ยังไม่พบร้าน ลองเปลี่ยนคำค้นหาหรือตัวกรอง</p>';
  } catch (error) {
    byId("public-shop-list").innerHTML = `<p class="empty-note">${escapeHtml(error.message)}</p>`;
  }
}

async function loadCategories() {
  try {
    const categories = await request("/categories");
    byId("category-filter").innerHTML = '<option value="">ทุกประเภท</option>' + categories.map((item) => `<option value="${escapeHtml(item.id)}">${escapeHtml(item.name)}</option>`).join("");
    byId("profile-categories").innerHTML = categories.map((item) => `<label><input type="checkbox" name="categoryIds" value="${escapeHtml(item.id)}"><span>${escapeHtml(item.name)}</span></label>`).join("");
    return categories;
  } catch (error) {
    console.error("Could not load product categories:", error.message);
    return [];
  }
}

async function loadProfile() {
  if (!state.user) return openAuth("login");
  byId("profile-message").textContent = "กำลังโหลดข้อมูลร้าน...";
  try {
    await loadCategories();
    const profile = await request("/shop/profile");
    const form = byId("profile-form");
    form.elements.namedItem("name").value = profile.name || "";
    form.elements.namedItem("description").value = profile.description || "";
    form.elements.namedItem("contactName").value = profile.contactName || "";
    form.elements.namedItem("contactPhone").value = profile.contactPhone || "";
    form.elements.namedItem("isPublic").checked = profile.isPublic;
    const categories = new Set((profile.categories || []).map((item) => String(item.id)));
    byId("profile-categories").querySelectorAll('input[name="categoryIds"]').forEach((input) => { input.checked = categories.has(input.value); });
    const preview = byId("profile-logo-preview");
    preview.hidden = !profile.logoImage;
    preview.src = profile.logoImage || "";
    byId("profile-logo-placeholder").hidden = Boolean(profile.logoImage);
    byId("profile-message").textContent = "";
  } catch (error) {
    byId("profile-message").textContent = error.message;
    if (error.status === 401) { state.user = null; openAuth("login"); }
  }
}

async function saveProfile(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const data = new FormData(form);
  const payload = {
    name: data.get("name"),
    description: data.get("description"),
    contactName: String(data.get("contactName") || "").trim() || null,
    contactPhone: data.get("contactPhone"),
    isPublic: data.has("isPublic"),
    categoryIds: data.getAll("categoryIds"),
  };
  const button = byId("profile-save");
  button.disabled = true;
  byId("profile-message").textContent = "กำลังบันทึก...";
  try {
    await request("/shop/profile", { method: "PATCH", body: JSON.stringify(payload) });
    const file = byId("profile-logo").files[0];
    if (file) {
      const upload = new FormData();
      upload.append("image", file);
      const result = await request("/shop/logo", { method: "POST", body: upload });
      const preview = byId("profile-logo-preview");
      if (preview.dataset.previewUrl) URL.revokeObjectURL(preview.dataset.previewUrl);
      preview.src = `${result.logoImage}?v=${Date.now()}`;
      delete preview.dataset.previewUrl;
      byId("profile-logo-preview").hidden = false;
      byId("profile-logo-placeholder").hidden = true;
      byId("profile-logo").value = "";
    }
    const savedName = String(payload.name || "").trim();
    state.shop = { ...state.shop, name: savedName };
    document.querySelector(".account-copy b").textContent = savedName;
    document.querySelector(".avatar").textContent = savedName.slice(0, 1) || "ร";
    byId("profile-message").textContent = "บันทึกข้อมูลร้านแล้ว";
    toast("บันทึกโปรไฟล์ร้านแล้ว");
  } catch (error) {
    byId("profile-message").textContent = error.message;
  } finally { button.disabled = false; }
}

async function showQr() {
  if (!state.user) return openAuth("login");
  const sessionId = byId("public-session-select").value;
  if (!sessionId) return toast("เลือกตลาดรอบที่ต้องการแชร์ก่อน");
  const button = byId("copy-market-link");
  button.disabled = true;
  button.textContent = "กำลังสร้าง QR...";
  try {
    const result = await request(`/shop/sessions/${encodeURIComponent(sessionId)}/qr`, { method: "POST", body: "{}" });
    byId("qr-image").src = result.qrDataUrl;
    byId("qr-image").hidden = false;
    byId("qr-link").value = result.url;
    byId("qr-dialog").showModal();
  } catch (error) { toast(error.message); }
  finally { button.disabled = false; button.textContent = "สร้าง QR สำหรับแชร์"; }
}

async function showPublicShop(button) {
  const sessionId = byId("public-session-select").value;
  const panel = byId("public-shop-detail");
  panel.hidden = false;
  panel.textContent = "กำลังโหลดข้อมูลร้าน...";
  try {
    const shop = await request(`/public/sessions/${encodeURIComponent(sessionId)}/shops/${encodeURIComponent(button.dataset.publicShopId)}`);
    const phone = shop.contactPhone || "";
    panel.innerHTML = `<strong>${escapeHtml(shop.name)}</strong><p>${escapeHtml(shop.description || "ร้านนี้ยังไม่ได้เพิ่มคำแนะนำ")}</p><p>แผง ${escapeHtml(shop.stallCode || "—")} · ${escapeHtml(shop.categories?.join(" · ") || "ร้านค้า")}</p>${phone ? `<a href="tel:${escapeHtml(phone)}">โทร ${escapeHtml(phone)}</a>` : "<span>ร้านนี้ยังไม่ได้ระบุเบอร์ติดต่อ</span>"}`;
    byId("public-map").querySelectorAll(".map-stall").forEach((stall) => stall.classList.toggle("selected", stall.dataset.code === button.dataset.stallCode));
  } catch (error) {
    panel.textContent = error.message;
  }
}

async function submitAuth(event) {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  const payload = Object.fromEntries(form.entries());
  const register = state.authMode === "register";
  byId("auth-submit").disabled = true;
  byId("auth-message").textContent = "กำลังดำเนินการ...";
  try {
    const user = await request(`/auth/${register ? "register" : "login"}`, { method: "POST", body: JSON.stringify(payload) });
    state.csrfToken = user.csrfToken || "";
    state.user = user.user || user;
    state.shop = user.shop || null;
    authDialog.close();
    document.querySelector(".account-copy b").textContent = state.shop?.name || payload.shopName || "ร้านของฉัน";
    document.querySelector(".account-copy small").textContent = "บัญชีร้านค้า";
    document.querySelector(".avatar").textContent = (state.shop?.name || payload.shopName || "ร").slice(0, 1);
    toast(register ? "สมัครร้านค้าสำเร็จ" : "เข้าสู่ระบบสำเร็จ");
    await loadDashboard();
    await loadBookings();
    renderSelection();
    if (state.pendingPage) {
      const page = state.pendingPage;
      state.pendingPage = "";
      setPage(page);
    }
  } catch (error) {
    byId("auth-message").textContent = error.message;
  } finally { byId("auth-submit").disabled = false; }
}

async function confirmBooking() {
  if (!state.user) return openAuth("login");
  const ids = [...state.selected];
  const button = byId("confirm-booking");
  button.disabled = true;
  const completed = [];
  let failure = null;
  for (const stallId of ids) {
    try {
      await request("/bookings", { method: "POST", body: JSON.stringify({ sessionId: state.sessionId, stallId }) });
      completed.push(stallId);
    } catch (error) { failure = error; break; }
  }
  state.selected.clear();
  if (failure) toast(completed.length ? `จองสำเร็จ ${completed.length} แผง แต่รายการถัดไปไม่สำเร็จ: ${failure.message}` : failure.message);
  else toast(`จองสำเร็จ ${completed.length} แผง ยืนยันแล้วทันที`);
  await loadMarketData();
  await loadBookings();
  renderSelection();
  button.disabled = state.selected.size === 0;
}

async function bookingAction(button) {
  const id = button.dataset.bookingId;
  if (button.dataset.bookingAction === "cancel") {
    if (!window.confirm("ยกเลิกการจองนี้หรือไม่? สามารถยกเลิกได้ทุกเวลา.")) return;
    try {
      await request(`/bookings/${encodeURIComponent(id)}/cancel`, { method: "POST", body: "{}" });
      toast("ยกเลิกการจองแล้ว");
      await loadBookings();
      await loadMarketData();
    } catch (error) { toast(error.message); }
  } else {
    try {
      const booking = await request(`/bookings/${encodeURIComponent(id)}`);
      const selector = byId("session-select");
      if ([...selector.options].some((option) => option.value === booking.sessionId)) selector.value = booking.sessionId;
      state.sessionId = booking.sessionId;
      await loadMap(booking.sessionId);
      const newStall = window.prompt("ใส่รหัสแผงใหม่เพื่อเปลี่ยนการจอง", booking.stallCode || "");
      if (!newStall) return;
      const stall = state.stalls.find((item) => String(item.code || item.stallCode || item.stall_code).toLowerCase() === newStall.toLowerCase());
      if (!stall || stall.availability !== "available") return toast("ไม่พบแผงว่างนี้ในรอบที่เลือก");
      await request(`/bookings/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify({ stallId: stall.id }) });
      toast("แก้ไขการจองแล้ว");
      await loadBookings();
      await loadMarketData();
    } catch (error) { toast(error.message); }
  }
}

function bindEvents() {
  document.addEventListener("click", (event) => {
    const nav = event.target.closest("[data-view], [data-action='navigate']");
    if (nav) {
      event.preventDefault();
      const page = nav.dataset.view || nav.dataset.target;
      if (["stalls", "bookings"].includes(page) && !state.user) return openAuth("login");
      setPage(page);
      return;
    }
    const authTab = event.target.closest("[data-auth]");
    if (authTab) { state.authMode = authTab.dataset.auth; renderAuthFields(); return; }
    const remove = event.target.closest("[data-remove-stall]");
    if (remove) { state.selected.delete(String(remove.dataset.removeStall)); renderSelection(); return; }
    const stall = event.target.closest(".map-stall:not(:disabled)");
    if (stall?.closest("#public-map")) {
      const card = [...byId("public-shop-list").querySelectorAll("[data-public-shop-id]")].find((item) => item.dataset.publicShopId === stall.dataset.publicShopId);
      if (card && stall.dataset.publicShopId) showPublicShop(card);
      return;
    }
    if (stall) {
      const id = String(stall.dataset.stallId);
      if (state.selected.has(id)) state.selected.delete(id); else state.selected.add(id);
      stall.classList.toggle("selected", state.selected.has(id));
      byId("map-message").textContent = `แผง ${stall.dataset.code} ${state.selected.has(id) ? "ถูกเพิ่มในรายการเลือก" : "นำออกจากรายการเลือก"}`;
      renderSelection();
      return;
    }
    const action = event.target.closest("[data-booking-action]");
    if (action) bookingAction(action);
  });

  document.querySelector(".dialog-close").addEventListener("click", () => authDialog.close());
  authDialog.addEventListener("click", (event) => { if (event.target === authDialog) authDialog.close(); });
  byId("auth-form").addEventListener("submit", submitAuth);
  byId("profile-form").addEventListener("submit", saveProfile);
  byId("logout-button").addEventListener("click", () => {
    if (window.confirm("ออกจากระบบหรือไม่?")) logout();
  });
  byId("profile-logo").addEventListener("change", (event) => {
    const file = event.currentTarget.files[0];
    if (!file) return;
    const preview = byId("profile-logo-preview");
    if (preview.dataset.previewUrl) URL.revokeObjectURL(preview.dataset.previewUrl);
    preview.src = URL.createObjectURL(file);
    preview.dataset.previewUrl = preview.src;
    preview.hidden = false;
    byId("profile-logo-placeholder").hidden = true;
  });
  byId("public-shop-list").addEventListener("click", (event) => {
    const card = event.target.closest("[data-public-shop-id]");
    if (card) showPublicShop(card);
  });
  byId("copy-market-link").addEventListener("click", showQr);
  byId("qr-dialog").querySelector(".dialog-close").addEventListener("click", () => byId("qr-dialog").close());
  byId("qr-dialog").addEventListener("click", (event) => { if (event.target === byId("qr-dialog")) byId("qr-dialog").close(); });
  byId("copy-qr-link").addEventListener("click", async () => {
    try { await navigator.clipboard.writeText(byId("qr-link").value); toast("คัดลอกลิงก์ QR แล้ว"); }
    catch { toast("คัดลอกไม่ได้ กรุณาเลือกและคัดลอกลิงก์ด้วยตนเอง"); }
  });
  byId("download-qr").addEventListener("click", () => {
    const link = document.createElement("a");
    link.href = byId("qr-image").src;
    link.download = "takladnat-market-qr.png";
    link.click();
  });
  byId("account-button").addEventListener("click", async () => {
    if (!state.user) return openAuth("login");
    setPage("profile");
  });
  byId("session-select").addEventListener("change", async (event) => { state.sessionId = event.target.value; state.selected.clear(); await loadMap(state.sessionId); renderSelection(); });
  byId("public-session-select").addEventListener("change", () => {
    state.publicSessionId = byId("public-session-select").value;
    state.requestedPublicSession = "";
    history.replaceState(null, "", `#market-map?session=${encodeURIComponent(state.publicSessionId)}`);
    refreshPublic();
  });
  byId("booking-filter").addEventListener("change", () => { state.page = 1; loadBookings(); });
  byId("booking-session-filter").addEventListener("change", () => { state.page = 1; loadBookings(); });
  byId("booking-pagination").addEventListener("click", (event) => {
    const button = event.target.closest("[data-booking-page]");
    if (!button || button.disabled) return;
    const page = Number(button.dataset.bookingPage);
    if (Number.isInteger(page) && page >= 1 && page <= state.totalPages) { state.page = page; loadBookings(); }
  });
  byId("confirm-booking").addEventListener("click", confirmBooking);
  byId("zoom-in").addEventListener("click", () => { state.zoom = Math.min(1.4, state.zoom + .1); byId("full-map").style.transform = `scale(${state.zoom})`; });
  byId("zoom-out").addEventListener("click", () => { state.zoom = Math.max(.8, state.zoom - .1); byId("full-map").style.transform = `scale(${state.zoom})`; });
  byId("stall-search").addEventListener("input", (event) => { const value = event.target.value.toLowerCase(); document.querySelectorAll("#full-map .map-stall").forEach((node) => { node.hidden = value && !node.dataset.code.toLowerCase().includes(value); }); });
  byId("public-search").addEventListener("input", () => { clearTimeout(state.publicTimer); state.publicTimer = setTimeout(refreshPublic, 250); });
  byId("category-filter").addEventListener("change", refreshPublic);
  window.addEventListener("hashchange", navFromHash);
}

async function start() {
  bindEvents();
  renderMiniStalls();
  renderBookings([]);
  navFromHash();
  try {
    const health = await fetch(`${API}/health`);
    if (!health.ok) throw new Error("ระบบยังไม่พร้อม");
    const healthResult = await health.json();
    if (healthResult.data?.status !== "ok" || healthResult.data?.database !== "ok") throw new Error("ฐานข้อมูลยังไม่พร้อม");
    showHealth(true, "เชื่อมต่อเซิร์ฟเวอร์และฐานข้อมูลแล้ว");
  } catch {
    showHealth(false, "ระบบ API หรือฐานข้อมูลยังไม่พร้อม ข้อมูลตลาดจะแสดงเมื่อเชื่อมต่อได้");
  }
  try {
    const data = await request("/auth/me");
    state.user = data.user || data;
    state.shop = data.shop || null;
    state.csrfToken = data.csrfToken || "";
    if (state.shop?.name) document.querySelector(".account-copy b").textContent = state.shop.name;
    document.querySelector(".avatar").textContent = (state.shop?.name || "ร").slice(0, 1);
  } catch (error) {
    state.user = null;
    document.querySelectorAll(".stat-card strong")[2].textContent = "0";
    if (error.status !== 401) showHealth(false, "ตรวจสอบบัญชีไม่สำเร็จ กรุณาโหลดหน้าใหม่");
  }
  loadCategories();
  if (state.user) { await loadDashboard(); await loadBookings(); }
  await loadMarketData();
  if (!location.hash || location.hash === "#home") loadPublicMarket();
}

start();
