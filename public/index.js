const API = "/api/v1";
const state = { user: null, shop: null, csrfToken: "", sessions: [], sessionId: "", publicSessionId: "", requestedPublicSession: "", pendingPage: "", stalls: [], selected: new Set(), zoom: 1, page: 1, totalPages: 0, totalBookings: 0, authMode: "login", publicTimer: null, publicShops: [], randomShopId: "" };
const statusEl = document.querySelector("#status");
const toastRegion = document.querySelector("#toast-region");
const authDialog = document.querySelector("#auth-dialog");
const money = new Intl.NumberFormat("th-TH", { style: "currency", currency: "THB", maximumFractionDigits: 0 });
const byId = (id) => document.getElementById(id);

function setupCustomSelect(select) {
  if (select.dataset.customized === "true") {
    refreshCustomSelect(select);
    return;
  }
  select.dataset.customized = "true";
  const wrapper = document.createElement("div");
  wrapper.className = "custom-select";
  wrapper.setAttribute("data-custom-select", select.id || "");
  const trigger = document.createElement("button");
  trigger.type = "button";
  trigger.className = "custom-select-trigger";
  trigger.setAttribute("aria-haspopup", "listbox");
  trigger.setAttribute("aria-expanded", "false");
  const menu = document.createElement("div");
  menu.className = "custom-select-menu";
  menu.setAttribute("role", "listbox");
  select.parentNode.insertBefore(wrapper, select);
  wrapper.append(select, trigger, menu);

  const close = () => {
    wrapper.classList.remove("open");
    trigger.setAttribute("aria-expanded", "false");
  };
  trigger.addEventListener("click", () => {
    document.querySelectorAll(".custom-select.open").forEach((open) => {
      if (open !== wrapper) open.classList.remove("open");
    });
    const opening = !wrapper.classList.contains("open");
    wrapper.classList.toggle("open", opening);
    trigger.setAttribute("aria-expanded", String(opening));
  });
  trigger.addEventListener("keydown", (event) => {
    if (event.key === "ArrowDown" || event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      trigger.click();
      menu.querySelector(".custom-select-option")?.focus();
    }
  });
  menu.addEventListener("click", (event) => {
    const option = event.target.closest("[data-select-value]");
    if (!option) return;
    select.value = option.dataset.selectValue;
    select.dispatchEvent(new Event("change", { bubbles: true }));
    refreshCustomSelect(select);
    close();
    trigger.focus();
  });
  menu.addEventListener("keydown", (event) => {
    const options = [...menu.querySelectorAll(".custom-select-option")];
    const current = options.indexOf(document.activeElement);
    if (event.key === "Escape") { close(); trigger.focus(); }
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const next = event.key === "ArrowDown" ? Math.min(current + 1, options.length - 1) : Math.max(current - 1, 0);
      options[next]?.focus();
    }
    if (event.key === "Enter") document.activeElement?.click();
  });
  select.addEventListener("change", () => refreshCustomSelect(select));
  new MutationObserver(() => refreshCustomSelect(select)).observe(select, { childList: true, subtree: true, attributes: true, attributeFilter: ["selected"] });
  refreshCustomSelect(select);
}

function refreshCustomSelect(select) {
  const wrapper = select.closest(".custom-select");
  if (!wrapper) return;
  const trigger = wrapper.querySelector(".custom-select-trigger");
  const menu = wrapper.querySelector(".custom-select-menu");
  const options = [...select.options];
  const selected = options.find((option) => option.value === select.value) || options[0];
  trigger.textContent = selected?.textContent || "เลือก";
  menu.innerHTML = options.map((option) => `<button type="button" role="option" class="custom-select-option${option.selected ? " selected" : ""}" data-select-value="${escapeHtml(option.value)}" aria-selected="${option.value === select.value}"${option.disabled ? " disabled" : ""}>${escapeHtml(option.textContent)}</button>`).join("");
}

document.addEventListener("click", (event) => {
  if (!event.target.closest(".custom-select")) {
    document.querySelectorAll(".custom-select.open").forEach((wrapper) => {
      wrapper.classList.remove("open");
      wrapper.querySelector(".custom-select-trigger")?.setAttribute("aria-expanded", "false");
    });
  }
});

function setupAllCustomSelects(root = document) {
  root.querySelectorAll("select").forEach(setupCustomSelect);
}

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
    if (response.status === 401 && state.user && !path.startsWith("/auth/")) { state.user = null; state.csrfToken = ""; toast("เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่"); openAuth("login"); }
    const error = new Error(result.error?.message || "เกิดข้อผิดพลาด กรุณาลองอีกครั้ง");
    error.status = response.status;
    error.code = result.error?.code;
    error.fields = result.error?.fields || {};
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
  if (["stalls", "bookings", "profile"].includes(page) && state.user?.role === "admin") page = "admin";
  if (["stalls", "bookings", "profile", "admin"].includes(page) && !state.user) {
    state.pendingPage = page;
    openAuth("login");
    page = "home";
  }
  if (page === "admin" && state.user?.role !== "admin") page = "home";
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
  if (page === "admin") loadAdmin();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function navFromHash() {
  const [hash, query = ""] = location.hash.slice(1).split("?", 2);
  state.requestedPublicSession = new URLSearchParams(query).get("session") || "";
  const page = hash === "my-bookings" ? "bookings" : hash === "market-map" ? "market" : hash === "stalls" ? "stalls" : hash === "profile" ? "profile" : hash === "admin" ? "admin" : "home";
  setPage(page);
}

async function loadAdmin() {
  if (state.user?.role !== "admin") return;
  byId("admin-content").innerHTML = '<p>กำลังโหลดข้อมูล...</p>';
  let summary, users, markets;
  try {
    [summary, users, markets] = await Promise.all([
      request("/admin/summary"),
      request("/admin/users"),
      request("/admin/markets"),
    ]);
  } catch (error) {
    byId("admin-content").innerHTML = `<p class="empty-note">${escapeHtml(error.message || "โหลดข้อมูลผู้ดูแลไม่สำเร็จ")}</p>`;
    return;
  }
  byId("admin-stats").innerHTML = [
    ["ผู้ใช้", summary.users], ["ตลาด", summary.markets], ["ร้านค้า", summary.shops], ["การจอง", summary.bookings],
  ].map(([label, value]) => `<article class="stat-card"><div><span class="stat-label">${label}</span><strong>${escapeHtml(String(value))}</strong></div></article>`).join("");
  const marketOptions = markets.map((market) => `<option value="${escapeHtml(market.id)}">${escapeHtml(market.name)}</option>`).join("");
  byId("admin-content").innerHTML = `
    <div class="admin-grid">
      <section><h3>ผู้ใช้</h3><div class="table-wrap"><table><thead><tr><th>ชื่อ</th><th>บทบาท</th><th>สถานะ</th></tr></thead><tbody>${users.map((user) => `<tr><td>${escapeHtml(user.name || user.email)}</td><td><select data-admin-user-role="${escapeHtml(user.id)}"><option value="customer"${user.role === "customer" ? " selected" : ""}>ลูกค้า</option><option value="shop"${user.role === "shop" ? " selected" : ""}>ร้านค้า</option><option value="admin"${user.role === "admin" ? " selected" : ""}>แอดมิน</option></select></td><td><select data-admin-user-status="${escapeHtml(user.id)}">      <option value="active"${user.status === "active" ? " selected" : ""}>ใช้งาน</option><option value="disabled"${user.status === "disabled" ? " selected" : ""}>ระงับ</option></select></td></tr>`).join("")}</tbody></table></div></section>
      <section><h3>ตลาด</h3><div class="table-wrap"><table><thead><tr><th>ตลาด</th><th>สถานะ</th></tr></thead><tbody>${markets.map((market) => `<tr><td>${escapeHtml(market.name)}</td><td><select data-admin-market-status="${escapeHtml(market.id)}"><option value="active"${market.status === "active" ? " selected" : ""}>เปิด</option><option value="inactive"${market.status === "inactive" ? " selected" : ""}>ปิด</option></select></td></tr>`).join("")}</tbody></table></div></section>
    </div>`;
  document.querySelectorAll("[data-admin-user-role]").forEach((select) => select.addEventListener("change", async () => { await request(`/admin/users/${select.dataset.adminUserRole}`, { method: "PATCH", body: JSON.stringify({ role: select.value }) }); toast("อัปเดตบทบาทแล้ว"); }));
  document.querySelectorAll("[data-admin-user-status]").forEach((select) => select.addEventListener("change", async () => { await request(`/admin/users/${select.dataset.adminUserStatus}`, { method: "PATCH", body: JSON.stringify({ status: select.value }) }); toast("อัปเดตสถานะแล้ว"); }));
  document.querySelectorAll("[data-admin-market-status]").forEach((select) => select.addEventListener("change", async () => { await request(`/admin/markets/${select.dataset.adminMarketStatus}`, { method: "PATCH", body: JSON.stringify({ status: select.value }) }); toast("อัปเดตตลาดแล้ว"); }));
}

function renderMiniStalls(stalls = []) {
  const container = byId("mini-stalls");
  const hasCoordinates = stalls.length > 0 && stalls.every((stall) => {
    const values = [stall.x, stall.y, stall.width, stall.height].map(Number);
    return [stall.x, stall.y, stall.width, stall.height].every((value) => value != null && value !== "")
      && values.every(Number.isFinite)
      && values[0] >= 0 && values[0] <= 100
      && values[1] >= 0 && values[1] <= 100
      && values[2] > 0 && values[2] <= 100
      && values[3] > 0 && values[3] <= 100
      && values[0] + values[2] <= 100
      && values[1] + values[3] <= 100;
  });
  container.classList.toggle("stall-list-mode", !hasCoordinates);
  container.innerHTML = stalls.length
    ? stalls.slice(0, 24).map((stall) => {
      const style = hasCoordinates ? ` style="left:${Number(stall.x)}%;top:${Number(stall.y)}%;width:${Number(stall.width)}%;height:${Number(stall.height)}%"` : "";
      const name = stall.code || stall.stallCode || stall.stall_code || "ไม่ระบุรหัส";
      return `<span class="stall-chip ${stall.availability === "booked" ? "taken" : ""} ${stall.ownBooking ? "mine" : ""}"${style}>${escapeHtml(name)}</span>`;
    }).join("")
    : '<span class="empty-note">ยังไม่มีข้อมูลแผงในรอบนี้</span>';
  byId("mini-map").setAttribute("aria-label", hasCoordinates ? "แผนผังย่อพร้อมตำแหน่งแผงจากข้อมูลตลาด" : "รายการรหัสแผงจากข้อมูลตลาด");
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
  byId("account-name").textContent = "ผู้เยี่ยมชม";
  byId("account-role").textContent = "ยังไม่ได้เข้าสู่ระบบ";
  byId("account-avatar").textContent = "ผ";
  byId("admin-nav").hidden = true;
  document.querySelectorAll('[data-view="stalls"], [data-view="bookings"], [data-view="profile"]').forEach((link) => { link.hidden = false; });
  state.pendingPage = "";
  byId("current-booking").hidden = true;
  syncAccountMenu();
  toast("ออกจากระบบแล้ว");
  setPage("home");
}

function closeAccountMenu() {
  const menu = byId("account-menu");
  menu.hidden = true;
  byId("account-button").setAttribute("aria-expanded", "false");
  document.querySelector(".account-menu-wrap")?.classList.remove("open");
}

function syncAccountMenu() {
  const menu = byId("account-menu");
  const loggedIn = Boolean(state.user);
  menu.querySelector('[data-account-action="profile"]').hidden = !loggedIn || state.user?.role === "admin";
  menu.querySelector('[data-account-action="admin"]').hidden = !loggedIn || state.user?.role !== "admin";
  menu.querySelector('[data-account-action="logout"]').hidden = !loggedIn;
  menu.querySelector('[data-account-action="login"]').hidden = loggedIn;
  closeAccountMenu();
}

function formatDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? "—" : new Intl.DateTimeFormat("th-TH", { day: "numeric", month: "short", year: "numeric" }).format(date);
}

function formatTime(value) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? "—" : new Intl.DateTimeFormat("th-TH", { hour: "2-digit", minute: "2-digit", hour12: false }).format(date);
}

function updateMarketBanner(market, session) {
  const now = new Date();
  const opensAt = session.bookingOpensAt ? new Date(session.bookingOpensAt) : null;
  const closesAt = session.bookingClosesAt ? new Date(session.bookingClosesAt) : null;
  const acceptingBookings = session.status === "open"
    && (!opensAt || now >= opensAt)
    && (!closesAt || now <= closesAt);
  byId("banner-status").textContent = acceptingBookings ? "เปิดรับจอง" : "ปิดรับจอง";
  byId("market-live-label").textContent = acceptingBookings ? "เปิดรับจอง" : "ปิดรับจอง";
  document.querySelector(".market-live").classList.toggle("closed", !acceptingBookings);
  byId("banner-market-name").textContent = market.name || "ไม่มีชื่อตลาด";
  byId("banner-address").textContent = market.address || "—";
  byId("banner-date").textContent = formatDate(session.startsAt);
  byId("banner-time").textContent = `${formatTime(session.startsAt)}–${formatTime(session.endsAt)}`;
  const startsAt = new Date(session.startsAt);
  const days = Number.isNaN(startsAt.valueOf()) ? null : Math.max(0, Math.floor((startsAt - Date.now()) / 86400000));
  byId("banner-countdown").innerHTML = days == null ? "—" : `${days} <small>วัน</small>`;
  byId("home-map-summary").textContent = `${market.name || "ตลาด"} · ${state.stalls.length} แผง`;
  byId("home-map-updated").textContent = market.description || "—";
}

function clearMarketData(message = "ยังไม่มีข้อมูลตลาดที่เปิดให้บริการ") {
  state.market = null;
  state.sessionId = "";
  state.stalls = [];
  byId("banner-status").textContent = message;
  byId("market-live-label").textContent = "ไม่มีข้อมูลตลาด";
  document.querySelector(".market-live").classList.add("closed");
  byId("banner-market-name").textContent = message;
  byId("banner-date").textContent = "—";
  byId("banner-time").textContent = "—";
  byId("banner-address").textContent = "—";
  byId("banner-countdown").textContent = "—";
  byId("home-map-summary").textContent = message;
  byId("home-map-updated").textContent = "—";
  document.querySelectorAll(".stat-card strong").forEach((item, index) => {
    if (index < 2) item.textContent = "—";
  });
  byId("full-map").classList.add("stall-list-mode");
  byId("full-map").style.backgroundImage = "none";
  byId("full-map").innerHTML = `<p class="empty-note">${escapeHtml(message)}</p> <button class="button button-outline" type="button" data-action="retry">ลองอีกครั้ง</button>`;
  byId("mini-map").style.backgroundImage = "none";
  byId("stall-map-title").textContent = "แผนผังแผงร้านค้า";
  byId("map-message").textContent = message;
  renderMiniStalls();
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
  rows.innerHTML = '<div class="booking-table-row header"><span>แผง / รอบตลาด</span><span>วันตลาด</span><span>สถานะ</span><span>ค่าเช่า</span><span>จัดการ</span></div>' + (filtered.length ? filtered.map((item) => `<div class="booking-table-row"><strong>แผง ${escapeHtml(item.stallCode || item.stall_code || "—")}<small>${escapeHtml(item.sessionName || item.session_name || "รอบตลาด")} · จองเมื่อ ${escapeHtml(formatDate(item.createdAt))}</small></strong><span>${escapeHtml(formatDate(item.startsAt || item.starts_at))} ${escapeHtml(formatTime(item.startsAt || item.starts_at))} น.</span><span class="status-badge ${statusClass(item.status)}">${statusLabel(item.status)}</span><strong>${money.format(Number(item.priceAtBooking ?? item.price_at_booking ?? 0))}</strong><div class="row-actions">${["confirmed", "pending"].includes(item.status) ? `<button class="small-action" data-booking-action="edit" data-booking-id="${escapeHtml(item.id)}">แก้ไข</button>` : ""}${item.status !== "cancelled" ? `<button class="small-action danger" data-booking-action="cancel" data-booking-id="${escapeHtml(item.id)}">ยกเลิก</button>` : ""}</div></div>`).join("") : '<p class="empty-note">ไม่พบรายการจองในตัวกรองนี้</p>');
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
    const list = result || [];
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
    if (result?.shop?.name) {
      byId("account-name").textContent = result.shop.name;
      byId("account-avatar").textContent = result.shop.name.slice(0, 1);
      byId("account-role").textContent = "บัญชีร้านค้า";
    }
    if (result?.confirmedCount != null) {
      state.totalBookings = Number(result.confirmedCount);
      document.querySelectorAll(".stat-card strong")[2].textContent = String(result.confirmedCount);
    }
    const cb = result?.currentBooking, box = byId("current-booking");
    box.hidden = false;
    box.innerHTML = cb ? `<span class="status-badge status-confirmed">การจองที่ใกล้ที่สุด</span><strong>แผง ${escapeHtml(cb.stallCode)}</strong><span>${escapeHtml(cb.sessionName)} · ${escapeHtml(formatDate(cb.startsAt))} ${escapeHtml(formatTime(cb.startsAt))} น.</span>` : "<strong>ยังไม่มีแผงที่ยืนยันสำหรับรอบถัดไป</strong><span>เลือกแผงว่าง แล้วกดยืนยัน ระบบจะจองให้ทันที</span>";
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
    const marketPayload = await marketResponse.json().catch(() => ({}));
    if (!marketResponse.ok) throw new Error(marketPayload.error?.message || "โหลดข้อมูลตลาดไม่สำเร็จ");
    const markets = marketPayload.data;
    const marketList = markets || [];
    if (!marketList.length) throw new Error("ยังไม่มีตลาดที่เปิดให้บริการ");
    const publicMarketSelect = byId("public-market-select");
    if (publicMode && publicMarketSelect) {
      publicMarketSelect.innerHTML = marketList.map((item) => `<option value="${escapeHtml(item.id)}">${escapeHtml(item.name)}</option>`).join("");
      if (publicMarketSelect.dataset.selected && marketList.some((item) => String(item.id) === publicMarketSelect.dataset.selected)) publicMarketSelect.value = publicMarketSelect.dataset.selected;
      publicMarketSelect.dataset.selected = publicMarketSelect.value;
    }
    const market = publicMode && publicMarketSelect?.value
      ? marketList.find((item) => String(item.id) === String(publicMarketSelect.value)) || marketList[0]
      : marketList[0];
    state.market = market;
    const sessionResponse = await fetch(`${API}/markets/${encodeURIComponent(market.id)}/sessions?from=${encodeURIComponent(new Date().toISOString().slice(0, 10))}`);
    const sessionPayload = await sessionResponse.json().catch(() => ({}));
    if (!sessionResponse.ok) throw new Error(sessionPayload.error?.message || "โหลดรอบตลาดไม่สำเร็จ");
    const sessions = sessionPayload.data;
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
      const found = list.some((item) => String(item.id) === String(desired));
      if (state.requestedPublicSession && !found) toast("ไม่พบรอบตลาดจากลิงก์หรือ QR นี้ จึงแสดงรอบล่าสุดแทน");
      state.publicSessionId = found ? String(desired) : String(list[0].id);
      select.value = state.publicSessionId;
      state.requestedPublicSession = "";
    } else {
      if (state.sessionId && list.some((item) => String(item.id) === String(state.sessionId))) select.value = state.sessionId;
      else { state.sessionId = String(list[0].id); select.value = state.sessionId; }
    }
    return list;
  } catch (error) {
    select.innerHTML = `<option value="">${escapeHtml(error.message)}</option>`;
    state.sessions = [];
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
  const hasCoordinates = stalls.length > 0 && stalls.every((stall) => {
    const values = [stall.x, stall.y, stall.width, stall.height].map(Number);
    return [stall.x, stall.y, stall.width, stall.height].every((value) => value != null && value !== "")
      && values.every(Number.isFinite)
      && values[0] >= 0 && values[0] <= 100
      && values[1] >= 0 && values[1] <= 100
      && values[2] > 0 && values[2] <= 100
      && values[3] > 0 && values[3] <= 100
      && values[0] + values[2] <= 100
      && values[1] + values[3] <= 100;
  });
  map.classList.toggle("stall-list-mode", !hasCoordinates);
  map.innerHTML = stalls.length ? stalls.map((stall) => {
    const availability = stall.availability || "available";
    const own = stall.ownBooking || stall.isMine;
    const name = stall.code || stall.stallCode || stall.stall_code || "แผง";
    const bookedShop = stall.shop?.name ? `<small>${escapeHtml(stall.shop.name)}</small>` : "";
    const style = hasCoordinates ? ` style="left:${Number(stall.x)}%;top:${Number(stall.y)}%;width:${Number(stall.width)}%;height:${Number(stall.height)}%"` : "";
    return `<button class="map-stall ${availability === "booked" ? "booked" : ""} ${own ? "mine" : ""} ${!publicMode && state.selected.has(String(stall.id)) ? "selected" : ""}"${style} data-stall-id="${escapeHtml(stall.id)}" data-public-shop-id="${escapeHtml(stall.shop?.id || "")}" data-availability="${escapeHtml(availability)}" data-code="${escapeHtml(name)}" data-price="${Number(stall.price ?? stall.basePrice ?? stall.base_price ?? 0)}" ${publicMode ? !stall.shop ? "disabled" : "" : availability !== "available" ? "disabled" : ""} aria-label="แผง ${escapeHtml(name)} ${stall.shop ? `ร้าน ${escapeHtml(stall.shop.name)}` : availability === "available" ? "ว่าง" : availability === "booked" ? "มีผู้จอง" : "ปิดใช้งาน"}"><strong>${escapeHtml(name)}</strong>${publicMode ? bookedShop : `<small>${availability === "available" ? money.format(Number(stall.price ?? stall.basePrice ?? stall.base_price ?? 0)) : own ? "ร้านของฉัน" : "มีผู้จอง"}</small>`}</button>`;
  }).join("") : '<p class="empty-note">รอบนี้ยังไม่มีข้อมูลแผง</p>';
  map.style.backgroundImage = market.mapImage ? `url("${String(market.mapImage).replace(/["\\]/g, "")}")` : "";
  map.style.backgroundSize = "100% 100%";
  map.style.backgroundRepeat = "no-repeat";
  const title = publicMode ? byId("public-map-title") : byId("stall-map-title");
  title.textContent = `${market.name || "ไม่มีชื่อ"} · ${session.name || "รอบตลาด"}`;
  if (!publicMode) {
    const available = stalls.filter((item) => item.availability === "available").length;
    updateMarketBanner(market, session);
    document.querySelectorAll(".stat-card strong")[0].textContent = String(stalls.length);
    document.querySelectorAll(".stat-card strong")[1].textContent = String(available);
    document.querySelectorAll(".stat-card strong")[2].textContent = state.user ? String(state.totalBookings) : "—";
    renderMiniStalls(stalls);
    const miniMap = byId("mini-map");
    miniMap.style.backgroundImage = market.mapImage ? `url("${String(market.mapImage).replace(/["\\]/g, "")}")` : "";
  }
  if (!publicMode) applyStallFilter();
  return data;
}

function applyStallFilter() {
  const q = byId("stall-search").value.trim().toLowerCase(), st = byId("stall-status").value;
  document.querySelectorAll("#full-map .map-stall").forEach((n) => {
    const mine = n.classList.contains("mine"), av = n.dataset.availability;
    const okStatus = !st || (st === "available" && av === "available") || (st === "mine" && mine) || (st === "booked" && av !== "available" && !mine);
    n.hidden = !(okStatus && (!q || n.dataset.code.toLowerCase().includes(q)));
  });
  const shown = document.querySelectorAll("#full-map .map-stall:not([hidden])").length;
  if (q || st) byId("map-message").textContent = shown ? `แสดง ${shown} แผงตามตัวกรอง` : "ไม่พบแผงตามตัวกรอง ลองล้างคำค้นหาหรือเลือก \"ทุกสถานะ\"";
}

async function loadMarketData() {
  const sessions = await loadSessions("session-select");
  if (!sessions.length) {
    clearMarketData(byId("session-select").options[0]?.textContent || "ยังไม่มีรอบตลาดที่เปิดให้แสดง");
    return;
  }
  state.sessionId = byId("session-select").value;
  try { await loadMap(state.sessionId); }
  catch (error) { clearMarketData(error.message); }
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
  if (!sessions.length) {
    byId("public-map").innerHTML = `<p class="empty-note">${escapeHtml(byId("public-session-select").options[0]?.textContent || "ยังไม่มีรอบตลาดที่เปิดให้แสดง")}</p> <button class="button button-outline" type="button" data-action="retry">ลองอีกครั้ง</button>`;
    byId("public-map").classList.add("stall-list-mode");
    byId("public-map").style.backgroundImage = "none";
    byId("public-map-title").textContent = "ไม่มีข้อมูลรอบตลาด";
    byId("public-shop-count").textContent = "—";
    byId("public-shop-list").innerHTML = '<p class="empty-note">ยังไม่มีข้อมูลร้านค้าให้แสดง</p>';
    return;
  }
  state.publicSessionId = byId("public-session-select").value;
  await refreshPublic();
}

async function refreshPublic() {
  const sessionId = byId("public-session-select").value;
  if (!sessionId) return;
  state.publicSessionId = sessionId;
  state.publicShops = [];
  state.randomShopId = "";
  try {
    await loadMap(sessionId, true);
    const query = new URLSearchParams({ page: "1", limit: "100", sort: "stallCode" });
    const text = byId("public-search").value.trim();
    const category = byId("category-filter").value;
    if (text) query.set("q", text);
    if (category) query.set("categoryId", category);
    const result = await request(`/public/sessions/${encodeURIComponent(sessionId)}/shops?${query}`);
    const shops = result || [];
    state.publicShops = shops;
    byId("public-shop-count").textContent = `${shops.length} ร้าน`;
    byId("random-shop-button").disabled = shops.length === 0;
    byId("public-shop-detail").hidden = true;
    byId("public-detail-empty").hidden = false;
    byId("public-shop-list").innerHTML = shops.length ? shops.map((shop) => {
      const stallCodes = shop.stallCodes?.length ? shop.stallCodes : (shop.stallCode ? [shop.stallCode] : []);
      return `<button type="button" class="public-shop-card" data-public-shop-id="${escapeHtml(shop.id)}" data-stall-codes="${escapeHtml(stallCodes.join(","))}"><span class="public-shop-icon" aria-hidden="true">${shop.logoImage ? `<img src="${escapeHtml(shop.logoImage)}" alt="">` : '<svg class="ui-icon" viewBox="0 0 24 24"><path d="M3 10h18M5 10v10h14V10M4 10l2-6h12l2 6M9 20v-6h6v6"/></svg>'}</span><span><strong>${escapeHtml(shop.name)}</strong><small>${escapeHtml(shop.categories?.join(" · ") || "ร้านค้า")} · ${escapeHtml(shop.contactPhone || "ไม่ระบุเบอร์")}</small></span><span>${escapeHtml(stallCodes.join(", "))}</span></button>`;
    }).join("") : '<p class="empty-note">ยังไม่พบร้าน ลองเปลี่ยนคำค้นหาหรือตัวกรอง</p>';
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
    form.elements.namedItem("lineId").value = profile.lineId || "";
    form.elements.namedItem("isPublic").checked = profile.isPublic;
    const categories = new Set((profile.categories || []).map((item) => String(item.id)));
    byId("profile-categories").querySelectorAll('input[name="categoryIds"]').forEach((input) => { input.checked = categories.has(input.value); });
    const preview = byId("profile-logo-preview");
    preview.hidden = !profile.logoImage;
    preview.src = profile.logoImage || "";
    byId("profile-logo-placeholder").hidden = Boolean(profile.logoImage);
    byId("profile-message").textContent = "";
    renderPreview();
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
    lineId: String(data.get("lineId") || "").trim() || null,
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
  const shopId = String(button.dataset.publicShopId || "");
  state.selectedPublicShopId = shopId;
  const card = [...byId("public-shop-list").querySelectorAll("[data-public-shop-id]")]
    .find((item) => String(item.dataset.publicShopId) === shopId);
  if (card) {
    document.querySelectorAll(".public-shop-card[data-public-shop-id]").forEach((shopCard) => {
      shopCard.classList.toggle("active", shopCard === card);
      shopCard.setAttribute("aria-pressed", String(shopCard === card));
    });
  }
  byId("public-detail-empty").hidden = true;
  panel.hidden = false;
  panel.textContent = "กำลังโหลดข้อมูลร้าน...";
  try {
    const shop = await request(`/public/sessions/${encodeURIComponent(sessionId)}/shops/${encodeURIComponent(button.dataset.publicShopId)}`);
    if (state.selectedPublicShopId !== String(shop.id)) return;
    document.querySelectorAll(".public-shop-card[data-public-shop-id]").forEach((shopCard) => {
      const selected = String(shopCard.dataset.publicShopId) === String(shop.id);
      shopCard.classList.toggle("active", selected);
      shopCard.setAttribute("aria-pressed", String(selected));
    });
    const phone = shop.contactPhone || "";
    const reviews = await request(`/shops/${encodeURIComponent(shop.id)}/reviews`);
    const lineLink = shop.lineId ? (shop.lineId.startsWith("http") ? shop.lineId : `https://line.me/R/ti/p/${encodeURIComponent(shop.lineId.replace(/^@/, ""))}`) : "";
    const lineId = String(shop.lineId || "").trim();
    const contactActions = `${phone ? `<a class="shop-contact-button shop-phone-button" href="tel:${escapeHtml(phone)}">โทร ${escapeHtml(phone)}</a>` : "<span>ร้านนี้ยังไม่ได้ระบุเบอร์ติดต่อ</span>"}${lineLink ? `<a class="shop-contact-button shop-line-button" href="${escapeHtml(lineLink)}" target="_blank" rel="noopener noreferrer">แอดไลน์ ${escapeHtml(lineId)}</a>` : ""}`;
    const reviewList = reviews.reviews?.length ? reviews.reviews.map((review) => `<article class="shop-review-item"><div class="shop-review-head"><strong>${escapeHtml(review.reviewerName || "ผู้เยี่ยมชม")}</strong><span>${formatDate(review.createdAt)}</span></div><div class="review-stars" aria-label="${review.rating} จาก 5 ดาว">${"★".repeat(Number(review.rating))}<span>${"☆".repeat(5 - Number(review.rating))}</span></div>${review.comment ? `<p>${escapeHtml(review.comment)}</p>` : ""}</article>`).join("") : '<p class="empty-note">ยังไม่มีรีวิว เป็นคนแรกที่ให้คะแนนร้านนี้</p>';
    const stallCodesLabel = (shop.stallCodes?.length ? shop.stallCodes : (shop.stallCode ? [shop.stallCode] : [])).join(" · ");
    panel.innerHTML = `<strong>${escapeHtml(shop.name)}</strong><p>${escapeHtml(shop.description || "ร้านนี้ยังไม่ได้เพิ่มคำแนะนำ")}</p><p>แผง ${escapeHtml(stallCodesLabel || "—")} · ${escapeHtml(shop.categories?.join(" · ") || "ร้านค้า")}</p><div class="shop-rating-summary"><span class="shop-rating-score">${reviews.count ? escapeHtml(String(reviews.average)) : "—"}</span><span><span class="review-stars">${"★".repeat(Math.round(Number(reviews.average) || 0))}<span>${"☆".repeat(5 - Math.round(Number(reviews.average) || 0))}</span></span><small>${reviews.count ? `จาก ${reviews.count} รีวิว` : "ยังไม่มีคะแนน"}</small></span></div><div class="shop-contact-actions">${contactActions}</div><section class="shop-reviews"><div class="shop-reviews-heading"><h3>รีวิวจากลูกค้า</h3></div><div class="shop-review-list">${reviewList}</div></section><form id="shop-review-form" class="shop-review-form"><h3>ให้คะแนนร้านนี้</h3><label>ชื่อ<input name="reviewerName" maxlength="80" value="ผู้เยี่ยมชม" required></label><fieldset class="star-rating"><legend>คะแนน</legend><div>${[5,4,3,2,1].map((rating) => `<input type="radio" name="rating" id="rating-${rating}" value="${rating}"${rating === 5 ? " checked" : ""}><label for="rating-${rating}" aria-label="${rating} ดาว">★</label>`).join("")}</div></fieldset><label>ความคิดเห็น<textarea name="comment" maxlength="1000" rows="3" placeholder="เล่าประสบการณ์ที่นี่ (ไม่บังคับ)"></textarea></label><button class="button button-outline" type="submit">ส่งรีวิว</button></form>`;
    byId("shop-review-form").addEventListener("submit", async (event) => {
      event.preventDefault();
      const form = new FormData(event.currentTarget);
      try {
        await request(`/shops/${encodeURIComponent(shop.id)}/reviews`, { method: "POST", body: JSON.stringify({ reviewerName: form.get("reviewerName"), rating: Number(form.get("rating")), comment: form.get("comment") }) });
        toast("ขอบคุณสำหรับรีวิว");
        showPublicShop(button);
      } catch (error) { toast(error.message); }
    });
    byId("public-map").querySelectorAll(".map-stall").forEach((stall) => {
      stall.classList.toggle("selected", String(stall.dataset.publicShopId) === String(shop.id));
      stall.setAttribute("aria-pressed", String(String(stall.dataset.publicShopId) === String(shop.id)));
    });
  } catch (error) {
    panel.textContent = error.message;
  }

}

async function pickRandomShop() {
  const shops = state.publicShops;
  if (!shops.length) return toast("ยังไม่มีร้านให้สุ่มในรอบตลาดนี้");
  let candidates = shops;
  if (shops.length > 1) candidates = shops.filter((shop) => String(shop.id) !== String(state.randomShopId));
  const shop = candidates[Math.floor(Math.random() * candidates.length)];
  state.randomShopId = String(shop.id);
  const button = document.createElement("button");
  button.dataset.publicShopId = String(shop.id);
  button.dataset.stallCode = shop.stallCode || "";
  await showPublicShop(button);
  document.querySelectorAll(".public-shop-card[data-public-shop-id]").forEach((card) => card.classList.toggle("active", card.dataset.publicShopId === String(shop.id)));
  document.querySelector(`.public-shop-card[data-public-shop-id="${CSS.escape(String(shop.id))}"]`)?.scrollIntoView({ behavior: "smooth", block: "nearest" });
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
    const admin = state.user.role === "admin";
    const shopName = admin ? "ผู้ดูแลระบบ" : state.shop?.name || payload.shopName || "ยังไม่มีชื่อร้าน";
    byId("account-name").textContent = shopName;
    byId("account-role").textContent = admin ? "ผู้ดูแลระบบ" : "บัญชีร้านค้า";
    byId("account-avatar").textContent = shopName.slice(0, 1);
    byId("admin-nav").hidden = !admin;
    document.querySelectorAll('[data-view="stalls"], [data-view="bookings"], [data-view="profile"]').forEach((link) => { link.hidden = admin; });
    syncAccountMenu();
    toast(register ? "สมัครร้านค้าสำเร็จ" : "เข้าสู่ระบบสำเร็จ");
    if (!admin) {
      await loadDashboard();
      await loadBookings();
    }
    await loadMarketData();
    renderSelection();
    if (admin) setPage(state.pendingPage === "admin" ? "admin" : "admin");
    if (state.pendingPage) {
      const page = state.pendingPage;
      state.pendingPage = "";
      setPage(page);
    }
  } catch (error) {
    byId("auth-message").textContent = [error.message, ...Object.values(error.fields || {})].filter((v, i, a) => typeof v === "string" && a.indexOf(v) === i).join(" · ");
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
    if (!(await askConfirm("ยกเลิกการจองนี้หรือไม่? ยกเลิกได้ทุกเวลา และแผงจะกลับมาว่างทันที", "ยกเลิกการจอง"))) return;
    try {
      await request(`/bookings/${encodeURIComponent(id)}/cancel`, { method: "POST", body: "{}" });
      toast("ยกเลิกการจองแล้ว");
      await loadBookings();
      await loadMarketData();
    } catch (error) { toast(error.message); }
  } else openEdit(id);
}

async function openEdit(id) {
  try {
    const booking = await request(`/bookings/${encodeURIComponent(id)}`);
    const data = await loadMap(booking.sessionId);
    const free = data.stalls.filter((s) => s.availability === "available" || s.code === booking.stallCode);
    const dialog = byId("edit-dialog");
    dialog.dataset.bookingId = id;
    byId("edit-stall").innerHTML = free.map((s) => `<option value="${escapeHtml(s.id)}">แผง ${escapeHtml(s.code)}${s.price ? ` · ${money.format(s.price)}` : ""}</option>`).join("");
    byId("edit-stall").value = String(free.find((s) => s.code === booking.stallCode)?.id || "");
    byId("edit-note").value = booking.shopNote || "";
    byId("edit-message").textContent = "";
    dialog.showModal();
  } catch (error) { toast(error.message); }
}

function askConfirm(message, label) {
  return new Promise((resolve) => {
    const d = byId("confirm-dialog");
    byId("confirm-text").textContent = message;
    byId("confirm-yes").textContent = label;
    d.returnValue = "";
    d.addEventListener("close", () => resolve(d.returnValue === "yes"), { once: true });
    d.showModal();
  });
}

function renderPreview() {
  const f = byId("profile-form"), v = (n) => f.elements.namedItem(n).value.trim();
  const cats = [...byId("profile-categories").querySelectorAll("input:checked")].map((i) => i.nextElementSibling.textContent).join(" · ") || "ยังไม่ได้เลือกประเภท";
  const pub = f.elements.namedItem("isPublic").checked;
  byId("profile-preview").innerHTML = `<strong>${escapeHtml(v("name") || "ชื่อร้านของคุณ")}</strong><p>${escapeHtml(v("description") || "ร้านนี้ยังไม่ได้เพิ่มคำแนะนำ")}</p><p>${escapeHtml(cats)}</p><p>${pub ? (v("contactPhone") ? `โทร ${escapeHtml(v("contactPhone"))}` : "ยังไม่ได้ระบุเบอร์ติดต่อ") : "ปิดการแสดงผล: ลูกค้าจะไม่เห็นร้านนี้ในแผนผัง"}</p>`;
}

function bindExtra() {
  const pf = byId("profile-form");
  pf.addEventListener("input", renderPreview); pf.addEventListener("change", renderPreview);
  document.addEventListener("click", (e) => {
    if (!e.target.closest("[data-action='retry']")) return;
    if (!byId("market-view").hidden) loadPublicMarket(); else loadMarketData();
  });
  document.querySelectorAll("[data-view-toggle]").forEach((btn) => {
    const map = byId(btn.dataset.viewToggle);
    const sync = () => { const list = map.classList.contains("list-view"); btn.setAttribute("aria-pressed", String(list)); btn.textContent = list ? "ดูแบบผัง" : "ดูแบบรายการ"; };
    if (matchMedia("(max-width:760px)").matches) map.classList.add("list-view");
    sync();
    btn.addEventListener("click", () => { map.classList.toggle("list-view"); sync(); });
  });
  byId("confirm-dialog").addEventListener("click", (e) => { const a = e.target.dataset?.answer; if (a) byId("confirm-dialog").close(a); });
  byId("edit-dialog").querySelectorAll("[data-close]").forEach((b) => b.addEventListener("click", () => byId("edit-dialog").close()));
  byId("edit-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const note = byId("edit-note").value.trim();
    byId("edit-message").textContent = "กำลังบันทึก...";
    try {
      await request(`/bookings/${encodeURIComponent(byId("edit-dialog").dataset.bookingId)}`, { method: "PATCH", body: JSON.stringify({ stallId: byId("edit-stall").value, shopNote: note || null }) });
      byId("edit-dialog").close();
      toast("แก้ไขการจองแล้ว");
      await loadBookings();
      await loadMarketData();
    } catch (error) { byId("edit-message").textContent = error.message; }
  });
}

function bindEvents() {
  document.addEventListener("click", (event) => {
    if (!event.target.closest(".account-menu-wrap")) closeAccountMenu();
    const nav = event.target.closest("[data-view], [data-action='navigate']");
    if (nav) {
      event.preventDefault();
      const page = nav.dataset.view || nav.dataset.target;
      if (["stalls", "bookings", "profile"].includes(page) && !state.user) { state.pendingPage = page; return openAuth("login"); }
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
      const info = state.stalls.find((s) => String(s.id) === id);
      byId("map-message").textContent = `แผง ${stall.dataset.code} ${state.selected.has(id) ? "เพิ่มในรายการเลือกแล้ว" : "นำออกจากรายการเลือกแล้ว"}${info?.description ? ` · ${info.description}` : ""}`;
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
  byId("logout-button").addEventListener("click", async () => { if (await askConfirm("ออกจากระบบหรือไม่?", "ออกจากระบบ")) logout(); });
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
  byId("account-button").addEventListener("click", () => {
    const menu = byId("account-menu");
    if (!menu.hidden) return closeAccountMenu();
    syncAccountMenu();
    menu.hidden = false;
    byId("account-button").setAttribute("aria-expanded", "true");
    document.querySelector(".account-menu-wrap")?.classList.add("open");
    menu.querySelector('[role="menuitem"]:not([hidden])')?.focus();
  });
  byId("account-menu").addEventListener("click", async (event) => {
    const action = event.target.closest("[data-account-action]")?.dataset.accountAction;
    if (!action) return;
    closeAccountMenu();
    if (action === "login") openAuth("login");
    if (action === "profile") setPage("profile");
    if (action === "admin") setPage("admin");
    if (action === "logout" && await askConfirm("ออกจากระบบหรือไม่?", "ออกจากระบบ")) await logout();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !byId("account-menu").hidden) {
      closeAccountMenu();
      byId("account-button").focus();
    }
  });
  byId("admin-logout-button").addEventListener("click", async () => {
    if (await askConfirm("ออกจากระบบหรือไม่?", "ออกจากระบบ")) await logout();
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
  byId("zoom-in").addEventListener("click", () => { state.zoom = Math.min(2.5, state.zoom + .25); byId("full-map").style.width = `${state.zoom * 100}%`; });
  byId("zoom-out").addEventListener("click", () => { state.zoom = Math.max(1, state.zoom - .25); byId("full-map").style.width = `${state.zoom * 100}%`; });
  byId("stall-search").addEventListener("input", applyStallFilter);
  byId("stall-status").addEventListener("change", applyStallFilter);
  byId("public-search").addEventListener("input", () => { clearTimeout(state.publicTimer); state.publicTimer = setTimeout(refreshPublic, 250); });
  byId("category-filter").addEventListener("change", refreshPublic);
  byId("random-shop-button").addEventListener("click", pickRandomShop);
  window.addEventListener("hashchange", navFromHash);
}

async function start() {
  bindEvents();
  bindExtra();
  syncAccountMenu();
  setupAllCustomSelects();
  new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      mutation.addedNodes.forEach((node) => {
        if (!(node instanceof Element)) return;
        if (node.matches("select")) setupCustomSelect(node);
        setupAllCustomSelects(node);
      });
    }
  }).observe(document.body, { childList: true, subtree: true });
  const savedTheme = localStorage.getItem("taklat-theme") || "light";
  document.documentElement.dataset.theme = savedTheme;
  const themeToggle = byId("theme-toggle");
  const themeMeta = document.querySelector('meta[name="theme-color"]');
  const syncTheme = () => {
    const dark = document.documentElement.dataset.theme === "dark";
    themeToggle.textContent = dark ? "☀" : "☾";
    themeToggle.setAttribute("aria-label", dark ? "สลับเป็น Light mode" : "สลับเป็น Dark mode");
    themeMeta?.setAttribute("content", dark ? "#111423" : "#ffffff");
  };
  syncTheme();
  themeToggle.addEventListener("click", () => {
    document.documentElement.dataset.theme = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    localStorage.setItem("taklat-theme", document.documentElement.dataset.theme);
    syncTheme();
  });
  byId("public-market-select").addEventListener("change", () => {
    byId("public-market-select").dataset.selected = byId("public-market-select").value;
    loadPublicMarket();
  });
  byId("recent-bookings").innerHTML = '<p class="empty-note">เข้าสู่ระบบเพื่อดูการจองของร้าน</p>';
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
    byId("admin-nav").hidden = state.user?.role !== "admin";
    const adminSession = state.user?.role === "admin";
    document.querySelectorAll('[data-view="stalls"], [data-view="bookings"], [data-view="profile"]').forEach((link) => { link.hidden = adminSession; });
    if (adminSession) {
      byId("account-name").textContent = "ผู้ดูแลระบบ";
      byId("account-role").textContent = "ผู้ดูแลระบบ";
      byId("account-avatar").textContent = "ผ";
    } else if (state.shop?.name) {
      byId("account-name").textContent = state.shop.name;
      byId("account-role").textContent = "บัญชีร้านค้า";
      byId("account-avatar").textContent = state.shop.name.slice(0, 1);
    }
    syncAccountMenu();
  } catch (error) {
    state.user = null;
    byId("account-name").textContent = "ผู้เยี่ยมชม";
    byId("account-role").textContent = "ยังไม่ได้เข้าสู่ระบบ";
    byId("account-avatar").textContent = "ผ";
    document.querySelectorAll(".stat-card strong")[2].textContent = "—";
    if (error.status !== 401) showHealth(false, "ตรวจสอบบัญชีไม่สำเร็จ กรุณาโหลดหน้าใหม่");
    syncAccountMenu();
  }
  loadCategories();
  if (state.user) { await loadDashboard(); await loadBookings(); }
  navFromHash();
  await loadMarketData();
  if (!location.hash || location.hash === "#home") loadPublicMarket();
}

start();