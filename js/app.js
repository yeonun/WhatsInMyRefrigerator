// 우리집 냉장고 - app.js
// Firebase Auth(Google) + Firestore 실시간 동기화로 부부가 냉장고 재고를 함께 관리합니다.

/* ---------------- Firebase 초기화 ---------------- */
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();
const itemsRef = db.collection("items");

// 로그인 상태를 이 기기에 저장해서, 한 번 로그인하면 다음 방문 때 자동으로 로그인되게 함
auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL).catch((err) => console.error(err));

/* ---------------- 상수 ---------------- */
const CATEGORIES = ["채소", "과일", "육류/계란", "유제품", "음료", "조미료/소스", "냉동식품", "가공식품/밀키트", "기타"];
const LOCATION_GROUPS = [
  { label: "냉장", options: ["냉장실", "야채칸", "문칸", "기타"] },
  { label: "냉동실(좌)", options: ["냉동실(좌)-문칸", "냉동실(좌)-상단", "냉동실(좌)-중간", "냉동실(좌)-하단"] },
  { label: "냉동실(우)", options: ["냉동실(우)-문칸", "냉동실(우)-상단", "냉동실(우)-중간", "냉동실(우)-하단"] },
];
const LOCATIONS = LOCATION_GROUPS.flatMap((g) => g.options);
const SOON_THRESHOLD_DAYS = 3;

function isFreezerLeft(loc) { return typeof loc === "string" && loc.startsWith("냉동실(좌)"); }
function isFreezerRight(loc) { return typeof loc === "string" && loc.startsWith("냉동실(우)"); }
function isFrozenLocation(loc) { return isFreezerLeft(loc) || isFreezerRight(loc); }

/* ---------------- DOM 요소 ---------------- */
const $ = (id) => document.getElementById(id);

const loadingScreen = $("loading-screen");
const loginScreen = $("login-screen");
const appScreen = $("app-screen");
const googleLoginBtn = $("google-login-btn");
const loginError = $("login-error");
const logoutBtn = $("logout-btn");
const userPhoto = $("user-photo");
const userName = $("user-name");

const stickyNotesEl = $("sticky-notes");
const MAX_STICKY_NOTES = 5;

let allItems = [];

const tabButtons = document.querySelectorAll(".tab-btn");
const tabPanels = { fridge: $("tab-fridge"), list: $("tab-list") };

const fridgePhotoEl = $("fridge-photo");
const fridgeZoneTop = $("fridge-zone-top");
const fridgeZoneFreezerLeft = $("fridge-zone-freezer-left");
const fridgeZoneFreezerRight = $("fridge-zone-freezer-right");
const fridgeShelfModal = $("fridge-shelf-modal");
const fridgeShelfTitleEl = $("fridge-shelf-title");
const fridgeShelfListEl = $("fridge-shelf-list");
const fridgeShelfEmptyEl = $("fridge-shelf-empty");
const fridgeShelfCloseBtn = $("fridge-shelf-close-btn");

const itemListEl = $("item-list");
const emptyStateEl = $("empty-state");
const countTotalEl = $("count-total");
const countSoonEl = $("count-soon");
const countExpiredEl = $("count-expired");

const searchInput = $("search-input");
const filterCategory = $("filter-category");
const filterLocation = $("filter-location");
const sortSelect = $("sort-select");

const addItemFab = $("add-item-fab");
const itemModal = $("item-modal");
const modalTitle = $("modal-title");
const modalCloseBtn = $("modal-close-btn");
const itemForm = $("item-form");
const itemIdInput = $("item-id");
const itemNameInput = $("item-name");
const itemQuantityInput = $("item-quantity");
const itemExpiryInput = $("item-expiry");
const itemCategoryInput = $("item-category");
const itemLocationInput = $("item-location");
const itemMemoInput = $("item-memo");
const deleteItemBtn = $("delete-item-btn");
const saveItemBtn = $("save-item-btn");
const nameOptionsEl = $("name-options");
const categoryOptionsEl = $("category-options");

const toastEl = $("toast");

/* ---------------- 초기 셀렉트 옵션 채우기 ---------------- */
function fillSelectOptions(selectEl, values, includeEmpty) {
  if (includeEmpty) {
    const opt = document.createElement("option");
    opt.value = "";
    opt.textContent = includeEmpty;
    selectEl.appendChild(opt);
  }
  values.forEach((v) => {
    const opt = document.createElement("option");
    opt.value = v;
    opt.textContent = v;
    selectEl.appendChild(opt);
  });
}
function fillGroupedSelectOptions(selectEl, groups, includeEmpty) {
  if (includeEmpty) {
    const opt = document.createElement("option");
    opt.value = "";
    opt.textContent = includeEmpty;
    selectEl.appendChild(opt);
  }
  groups.forEach((group) => {
    const optgroup = document.createElement("optgroup");
    optgroup.label = group.label;
    group.options.forEach((v) => {
      const opt = document.createElement("option");
      opt.value = v;
      opt.textContent = v;
      optgroup.appendChild(opt);
    });
    selectEl.appendChild(optgroup);
  });
}

fillGroupedSelectOptions(filterLocation, LOCATION_GROUPS);
fillGroupedSelectOptions(itemLocationInput, LOCATION_GROUPS);

// 재료 이름 / 카테고리는 직접 입력이 기본이고, 과거 입력값을 제안으로 보여줌(datalist)
function fillDatalist(datalistEl, values) {
  datalistEl.innerHTML = "";
  values.forEach((v) => {
    const opt = document.createElement("option");
    opt.value = v;
    datalistEl.appendChild(opt);
  });
}

// 지금까지 쓴 값들을 모아 자주 쓴 순 → 이름순으로 정렬
function usedValues(field) {
  const counts = new Map();
  allItems.forEach((it) => {
    const v = (it[field] || "").trim();
    if (v) counts.set(v, (counts.get(v) || 0) + 1);
  });
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "ko"))
    .map(([v]) => v);
}

function refreshSuggestions() {
  fillDatalist(nameOptionsEl, usedValues("name"));

  // 기본 카테고리 + 사용자가 새로 만든 카테고리
  const used = usedValues("category");
  const categories = [...CATEGORIES, ...used.filter((c) => !CATEGORIES.includes(c))];
  fillDatalist(categoryOptionsEl, categories);

  // 전체보기의 카테고리 필터도 같은 목록으로 유지 (선택값은 보존)
  const prev = filterCategory.value;
  filterCategory.innerHTML = "";
  fillSelectOptions(filterCategory, categories, "전체 카테고리");
  filterCategory.value = categories.includes(prev) ? prev : "";
}
refreshSuggestions();

/* ---------------- 인증 ---------------- */
googleLoginBtn.addEventListener("click", () => {
  loginError.classList.add("hidden");
  const provider = new firebase.auth.GoogleAuthProvider();
  auth.signInWithPopup(provider).catch((err) => {
    console.error(err);
    showLoginError("로그인에 실패했습니다. 다시 시도해주세요.");
  });
});

logoutBtn.addEventListener("click", () => {
  auth.signOut();
});

function showLoginError(msg) {
  loginError.textContent = msg;
  loginError.classList.remove("hidden");
}


let unsubscribeItems = null;

auth.onAuthStateChanged((user) => {
  loadingScreen.classList.add("hidden");

  if (unsubscribeItems) {
    unsubscribeItems();
    unsubscribeItems = null;
  }

  if (!user) {
    loginScreen.classList.remove("hidden");
    appScreen.classList.add("hidden");
    return;
  }

  const email = (user.email || "").toLowerCase();
  const allowed = ALLOWED_EMAILS.map((e) => e.toLowerCase()).includes(email);

  if (!allowed) {
    showLoginError(`${user.email} 계정은 이 냉장고에 접근할 수 없어요. 허용된 두 계정으로만 로그인해주세요.`);
    auth.signOut();
    return;
  }

  loginScreen.classList.add("hidden");
  appScreen.classList.remove("hidden");
  userName.textContent = user.displayName || user.email;
  userPhoto.src = user.photoURL || "";

  subscribeToItems();
});

/* ---------------- Firestore 실시간 구독 ---------------- */
function subscribeToItems() {
  unsubscribeItems = itemsRef.orderBy("expiryDate", "asc").onSnapshot(
    (snapshot) => {
      allItems = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      renderItems();
    },
    (err) => {
      console.error(err);
      showToast("데이터를 불러오지 못했어요: " + err.message);
    }
  );
}

/* ---------------- 유통기한 상태 계산 ---------------- */
function getDateOnly(d) {
  const nd = new Date(d);
  nd.setHours(0, 0, 0, 0);
  return nd;
}

function getExpiryStatus(expiryDate) {
  if (!expiryDate) return "none";
  const today = getDateOnly(new Date());
  const expiry = getDateOnly(expiryDate);
  const diffDays = Math.round((expiry - today) / (1000 * 60 * 60 * 24));
  if (diffDays < 0) return "expired";
  if (diffDays <= SOON_THRESHOLD_DAYS) return "soon";
  return "ok";
}

function formatExpiryLabel(expiryDate) {
  if (!expiryDate) return "유통기한 미입력";
  const today = getDateOnly(new Date());
  const expiry = getDateOnly(expiryDate);
  const diffDays = Math.round((expiry - today) / (1000 * 60 * 60 * 24));
  const dateStr = `${expiry.getFullYear()}.${String(expiry.getMonth() + 1).padStart(2, "0")}.${String(expiry.getDate()).padStart(2, "0")}`;
  if (diffDays < 0) return `${dateStr} (${Math.abs(diffDays)}일 지남)`;
  if (diffDays === 0) return `${dateStr} (오늘까지)`;
  return `${dateStr} (D-${diffDays})`;
}

/* ---------------- 렌더링 ---------------- */
function withStatus(items) {
  return items.map((it) => {
    const expiryDate = it.expiryDate ? new Date(it.expiryDate) : null;
    return { ...it, _expiryDate: expiryDate, _status: getExpiryStatus(expiryDate) };
  });
}

function renderItems() {
  const search = searchInput.value.trim().toLowerCase();
  const catFilter = filterCategory.value;
  const locFilter = filterLocation.value;
  const sortBy = sortSelect.value;

  let items = withStatus(allItems);

  if (search) {
    items = items.filter((it) => (it.name || "").toLowerCase().includes(search));
  }
  if (catFilter) {
    items = items.filter((it) => it.category === catFilter);
  }
  if (locFilter) {
    items = items.filter((it) => it.location === locFilter);
  }

  items.sort((a, b) => {
    if (sortBy === "name") {
      return (a.name || "").localeCompare(b.name || "", "ko");
    }
    if (sortBy === "createdAt") {
      const aT = a.createdAt && a.createdAt.toMillis ? a.createdAt.toMillis() : 0;
      const bT = b.createdAt && b.createdAt.toMillis ? b.createdAt.toMillis() : 0;
      return bT - aT;
    }
    // expiry: 유통기한 없는 항목은 맨 뒤로
    if (!a._expiryDate && !b._expiryDate) return 0;
    if (!a._expiryDate) return 1;
    if (!b._expiryDate) return -1;
    return a._expiryDate - b._expiryDate;
  });

  // 요약 카운트는 필터와 무관하게 전체 기준
  const soonCount = allItems.filter((it) => getExpiryStatus(it.expiryDate ? new Date(it.expiryDate) : null) === "soon").length;
  const expiredCount = allItems.filter((it) => getExpiryStatus(it.expiryDate ? new Date(it.expiryDate) : null) === "expired").length;
  countTotalEl.textContent = allItems.length;
  countSoonEl.textContent = soonCount;
  countExpiredEl.textContent = expiredCount;

  itemListEl.innerHTML = "";
  if (items.length === 0) {
    emptyStateEl.classList.remove("hidden");
  } else {
    emptyStateEl.classList.add("hidden");
    items.forEach((it) => itemListEl.appendChild(renderSwipeableItem(it)));
  }

  renderStickyNotes();
  if (openSection) renderFridgeShelf();
  refreshSuggestions();
}

/* ---------------- 냉장고 문 포스트잇 ---------------- */
// 문자열을 안정적인 각도(-6deg ~ 6deg)로 매핑 (매 렌더마다 같은 아이템은 같은 각도 유지)
function hashRotation(id) {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) % 1000;
  }
  return (hash % 13) - 6;
}

function renderStickyNotes() {
  const urgent = withStatus(allItems)
    .filter((it) => it._status === "soon" || it._status === "expired")
    .sort((a, b) => a._expiryDate - b._expiryDate);

  stickyNotesEl.innerHTML = "";

  if (urgent.length === 0) {
    const empty = document.createElement("div");
    empty.className = "sticky-note status-empty";
    empty.textContent = "빨리 먹어야 할\n재료가 없어요";
    empty.style.whiteSpace = "pre-line";
    stickyNotesEl.appendChild(empty);
    return;
  }

  const shown = urgent.slice(0, MAX_STICKY_NOTES);
  shown.forEach((it) => {
    // 포스트잇을 누르면 그 재료가 들어있는 칸의 문이 열리고 해당 재료가 강조됨
    const note = document.createElement("button");
    note.type = "button";
    note.className = `sticky-note status-${it._status}`;
    note.style.setProperty("--rot", `${hashRotation(it.id)}deg`);
    note.addEventListener("click", () => openFridgeSection(sectionOfLocation(it.location), it.id));

    const name = document.createElement("span");
    name.className = "note-name";
    name.textContent = it.name || "(이름 없음)";

    const day = document.createElement("span");
    day.className = "note-day";
    const dateLabel = formatExpiryLabel(it._expiryDate);
    day.textContent = dateLabel.substring(dateLabel.indexOf("(") + 1).replace(")", "");

    note.appendChild(name);
    note.appendChild(day);
    stickyNotesEl.appendChild(note);
  });

  const remaining = urgent.length - shown.length;
  if (remaining > 0) {
    const more = document.createElement("div");
    more.className = "sticky-note status-more";
    more.textContent = `+${remaining}개 더`;
    stickyNotesEl.appendChild(more);
  }
}

function renderItemCard(item) {
  const card = document.createElement("div");
  card.className = `item-card status-${item._status === "none" ? "ok" : item._status}`;
  card.dataset.itemId = item.id;
  card.addEventListener("click", () => {
    // 스와이프 중이었거나 삭제 버튼이 열려있으면 수정창을 열지 않음
    if (card.dataset.suppressClick === "1") {
      card.dataset.suppressClick = "0";
      return;
    }
    const wrap = card.closest(".item-swipe");
    if (wrap && wrap.classList.contains("swipe-open")) {
      closeOpenSwipe();
      return;
    }
    openEditModal(item);
  });

  const main = document.createElement("div");
  main.className = "item-main";

  const name = document.createElement("p");
  name.className = "item-name";
  name.textContent = item.name || "(이름 없음)";
  main.appendChild(name);

  const meta = document.createElement("div");
  meta.className = "item-meta";
  if (item.quantity) meta.appendChild(makeTag(item.quantity));
  if (item.category) meta.appendChild(makeTag(item.category));
  if (item.location) meta.appendChild(makeTag(item.location));
  main.appendChild(meta);

  card.appendChild(main);

  const expiry = document.createElement("div");
  expiry.className = "item-expiry";
  const strong = document.createElement("strong");
  strong.textContent = item._expiryDate
    ? formatExpiryLabel(item._expiryDate).split(" (")[0]
    : "미입력";
  const sub = document.createElement("span");
  sub.textContent = item._expiryDate
    ? "(" + formatExpiryLabel(item._expiryDate).split(" (")[1]
    : "";
  expiry.appendChild(strong);
  expiry.appendChild(document.createElement("br"));
  expiry.appendChild(sub);
  card.appendChild(expiry);

  return card;
}

function makeTag(text) {
  const span = document.createElement("span");
  span.className = "item-tag";
  span.textContent = text;
  return span;
}

/* ---------------- 전체보기: 좌측 스와이프로 삭제 ---------------- */
const SWIPE_WIDTH = 84;
let openSwipeWrap = null;

function closeOpenSwipe() {
  if (openSwipeWrap) {
    openSwipeWrap.classList.remove("swipe-open");
    const c = openSwipeWrap.querySelector(".item-card");
    if (c) c.style.transform = "";
    openSwipeWrap = null;
  }
}

function setSwipeOpen(wrap, card, open) {
  card.style.transform = "";
  wrap.classList.toggle("swipe-open", open);
  if (open) {
    if (openSwipeWrap && openSwipeWrap !== wrap) closeOpenSwipe();
    openSwipeWrap = wrap;
  } else if (openSwipeWrap === wrap) {
    openSwipeWrap = null;
  }
}

function renderSwipeableItem(item) {
  const wrap = document.createElement("div");
  wrap.className = "item-swipe";

  const delBtn = document.createElement("button");
  delBtn.type = "button";
  delBtn.className = "item-swipe-delete";
  delBtn.textContent = "삭제";
  delBtn.addEventListener("click", () => deleteItem(item));

  const card = renderItemCard(item);
  wrap.appendChild(delBtn);
  wrap.appendChild(card);
  attachSwipe(wrap, card);
  return wrap;
}

function attachSwipe(wrap, card) {
  let startX = 0, startY = 0, tracking = false, moved = false, wasOpen = false;

  card.addEventListener("pointerdown", (e) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    startX = e.clientX;
    startY = e.clientY;
    tracking = true;
    moved = false;
    wasOpen = wrap.classList.contains("swipe-open");
    card.style.transition = "none";
  });

  card.addEventListener("pointermove", (e) => {
    if (!tracking) return;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    if (!moved) {
      // 세로로 움직이면 스와이프가 아니라 스크롤로 넘김
      if (Math.abs(dy) > Math.abs(dx) && Math.abs(dy) > 8) { tracking = false; card.style.transition = ""; return; }
      if (Math.abs(dx) < 8) return;
      moved = true;
    }
    const base = wasOpen ? -SWIPE_WIDTH : 0;
    const offset = Math.min(0, Math.max(-SWIPE_WIDTH, base + dx));
    card.style.transform = `translateX(${offset}px)`;
  });

  const finish = (e) => {
    if (!tracking) return;
    tracking = false;
    card.style.transition = "";
    if (!moved) return;
    card.dataset.suppressClick = "1";
    const base = wasOpen ? -SWIPE_WIDTH : 0;
    const offset = base + (e.clientX - startX);
    setSwipeOpen(wrap, card, offset < -SWIPE_WIDTH / 2);
  };

  card.addEventListener("pointerup", finish);
  card.addEventListener("pointercancel", () => {
    tracking = false;
    card.style.transition = "";
    setSwipeOpen(wrap, card, wasOpen);
  });
}

// 목록 밖을 누르면 열려있던 삭제 버튼을 닫음
document.addEventListener("pointerdown", (e) => {
  if (openSwipeWrap && !openSwipeWrap.contains(e.target)) closeOpenSwipe();
});

async function deleteItem(item) {
  if (!confirm(`'${item.name || "이 재료"}'를 삭제할까요?`)) return;
  try {
    await itemsRef.doc(item.id).delete();
    closeOpenSwipe();
    showToast("삭제했어요.");
  } catch (err) {
    console.error(err);
    showToast("삭제에 실패했어요: " + err.message);
  }
}

[searchInput, filterCategory, filterLocation, sortSelect].forEach((el) => {
  el.addEventListener("input", renderItems);
  el.addEventListener("change", renderItems);
});

/* ---------------- 하단 탭 (냉장고 / 전체보기) ---------------- */
tabButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    const tab = btn.dataset.tab;
    Object.entries(tabPanels).forEach(([key, el]) => el.classList.toggle("hidden", key !== tab));
    tabButtons.forEach((b) => b.classList.toggle("active", b === btn));
  });
});

/* ---------------- 냉장고 문 열기/닫기 (팝업) ---------------- */
const FRIDGE_ZONE_CLASSES = ["zone-cold", "zone-freezer-left", "zone-freezer-right"];
const FRIDGE_SECTION_TITLES = {
  cold: "🥬 냉장실 칸",
  freezerLeft: "🧊 냉동실 (좌)",
  freezerRight: "🧊 냉동실 (우)",
};

let openSection = null; // null | "cold" | "freezerLeft" | "freezerRight"
let highlightItemId = null;

// 보관 위치로 어느 칸에 속하는지 판별
function sectionOfLocation(loc) {
  if (isFreezerLeft(loc)) return "freezerLeft";
  if (isFreezerRight(loc)) return "freezerRight";
  return "cold";
}

function openFridgeSection(section, itemIdToHighlight) {
  openSection = section;
  highlightItemId = itemIdToHighlight || null;
  fridgePhotoEl.classList.remove(...FRIDGE_ZONE_CLASSES);
  fridgePhotoEl.classList.add(
    section === "freezerLeft" ? "zone-freezer-left" : section === "freezerRight" ? "zone-freezer-right" : "zone-cold"
  );
  // 문이 열린 상태에서는 닫힌 문에 붙어있던 포스트잇을 숨김
  stickyNotesEl.classList.add("hidden");
  fridgeShelfTitleEl.textContent = FRIDGE_SECTION_TITLES[section];
  renderFridgeShelf();
  fridgeShelfModal.classList.remove("hidden");

  if (highlightItemId) {
    const card = fridgeShelfListEl.querySelector(`[data-item-id="${highlightItemId}"]`);
    if (card) card.scrollIntoView({ block: "nearest" });
  }
}

function closeFridgeSection() {
  openSection = null;
  highlightItemId = null;
  fridgePhotoEl.classList.remove(...FRIDGE_ZONE_CLASSES);
  stickyNotesEl.classList.remove("hidden");
  fridgeShelfModal.classList.add("hidden");
}

function renderFridgeShelf() {
  if (!openSection) return;
  const filtered = allItems.filter((it) => {
    if (openSection === "freezerLeft") return isFreezerLeft(it.location);
    if (openSection === "freezerRight") return isFreezerRight(it.location);
    return !isFrozenLocation(it.location);
  });
  const items = withStatus(filtered).sort((a, b) => {
    if (!a._expiryDate && !b._expiryDate) return 0;
    if (!a._expiryDate) return 1;
    if (!b._expiryDate) return -1;
    return a._expiryDate - b._expiryDate;
  });

  fridgeShelfListEl.innerHTML = "";
  if (items.length === 0) {
    fridgeShelfEmptyEl.classList.remove("hidden");
  } else {
    fridgeShelfEmptyEl.classList.add("hidden");
    items.forEach((it) => {
      const card = renderItemCard(it);
      if (highlightItemId && it.id === highlightItemId) card.classList.add("item-card-highlight");
      fridgeShelfListEl.appendChild(card);
    });
  }
}

fridgeZoneTop.addEventListener("click", () => openFridgeSection("cold"));
fridgeZoneFreezerLeft.addEventListener("click", () => openFridgeSection("freezerLeft"));
fridgeZoneFreezerRight.addEventListener("click", () => openFridgeSection("freezerRight"));
fridgeShelfCloseBtn.addEventListener("click", closeFridgeSection);
fridgeShelfModal.addEventListener("click", (e) => {
  if (e.target === fridgeShelfModal) closeFridgeSection();
});

/* ---------------- 모달: 추가 / 수정 ---------------- */
function openAddModal() {
  modalTitle.textContent = "재료 추가";
  itemForm.reset();
  itemIdInput.value = "";
  deleteItemBtn.classList.add("hidden");
  itemModal.classList.remove("hidden");
}

function openEditModal(item) {
  modalTitle.textContent = "재료 수정";
  itemIdInput.value = item.id;
  itemNameInput.value = item.name || "";
  itemQuantityInput.value = item.quantity || "";
  itemExpiryInput.value = item.expiryDate || "";
  itemCategoryInput.value = item.category || "";
  itemLocationInput.value = item.location || "";
  itemMemoInput.value = item.memo || "";
  deleteItemBtn.classList.remove("hidden");
  itemModal.classList.remove("hidden");
}

function closeModal() {
  itemModal.classList.add("hidden");
}

addItemFab.addEventListener("click", openAddModal);
modalCloseBtn.addEventListener("click", closeModal);
itemModal.addEventListener("click", (e) => {
  if (e.target === itemModal) closeModal();
});

// 저장 버튼을 연타해도 중복 등록되지 않도록 잠금
let isSaving = false;

itemForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (isSaving) return;
  const user = auth.currentUser;
  if (!user) return;

  const data = {
    name: itemNameInput.value.trim(),
    quantity: itemQuantityInput.value.trim(),
    expiryDate: itemExpiryInput.value || null,
    category: itemCategoryInput.value || "",
    location: itemLocationInput.value || "",
    memo: itemMemoInput.value.trim(),
    updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    updatedBy: user.email,
  };

  if (!data.name) {
    showToast("재료 이름을 입력해주세요.");
    return;
  }

  const id = itemIdInput.value;
  isSaving = true;
  saveItemBtn.disabled = true;
  try {
    if (id) {
      await itemsRef.doc(id).update(data);
      showToast("수정했어요.");
    } else {
      data.createdAt = firebase.firestore.FieldValue.serverTimestamp();
      data.createdBy = user.email;
      await itemsRef.add(data);
      showToast("추가했어요.");
    }
    closeModal();
  } catch (err) {
    console.error(err);
    showToast("저장에 실패했어요: " + err.message);
  } finally {
    isSaving = false;
    saveItemBtn.disabled = false;
  }
});

deleteItemBtn.addEventListener("click", async () => {
  const id = itemIdInput.value;
  if (!id) return;
  if (!confirm("이 재료를 삭제할까요?")) return;
  try {
    await itemsRef.doc(id).delete();
    showToast("삭제했어요.");
    closeModal();
  } catch (err) {
    console.error(err);
    showToast("삭제에 실패했어요: " + err.message);
  }
});

/* ---------------- 토스트 ---------------- */
let toastTimer = null;
function showToast(msg) {
  toastEl.textContent = msg;
  toastEl.classList.remove("hidden");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.add("hidden"), 2200);
}
