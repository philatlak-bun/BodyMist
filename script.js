/* ==========================================================
   Body Scent — script.js (ใช้ร่วมกันทุกหน้า)
   - product.html : โหลดสินค้า + กรองตาม mood
   - order.html   : เติมฟอร์มจาก URL + ส่งออเดอร์
   - admin.html   : แสดงออเดอร์จาก Google Sheet (CSV)
   ========================================================== */

const APPS_SCRIPT_URL =
  "https://script.google.com/macros/s/AKfycbzW70G4rP8fbgMwLFw3OW-kUltiub34VKLaVZV4lP0zJGdlpwRpmVUi2hPdV_17AENh/exec";

const SHEET_CSV_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vTB-bY9J7JQ5m9UatWYcfnF02MP4z6SIqoGgefBziFERKyN9Dqe4taPPXmR5bmJPjGxUmG6rd8Z2sb_/pub?gid=0&single=true&output=csv";

const MOODS = [
  { key: "all", label: "ทั้งหมด" },
  { key: "fresh", label: "Fresh" },
  { key: "sweet", label: "Sweet" },
  { key: "confident", label: "Confident" },
  { key: "romance", label: "Romance" },
];

/* ---------- Helpers ---------- */
function formatPrice(n) {
  return Number(n).toLocaleString("th-TH");
}

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

/* ==========================================================
   1) product.html
   ========================================================== */
function initProductPage() {
  const filterBar = document.getElementById("filter-bar");
  const list = document.getElementById("product-list");
  if (!filterBar || !list) return;

  let products = [];
  const params = new URLSearchParams(window.location.search);
  let currentMood = (params.get("mood") || "all").toLowerCase();
  if (!MOODS.some((m) => m.key === currentMood)) currentMood = "all";

  function renderFilters() {
    filterBar.innerHTML = "";
    MOODS.forEach((m) => {
      const btn = el("button", "filter-btn", m.label);
      btn.type = "button";
      btn.dataset.mood = m.key;
      if (m.key === currentMood) btn.classList.add("is-active");
      btn.addEventListener("click", () => {
        currentMood = m.key;
        renderFilters();
        renderProducts();
      });
      filterBar.appendChild(btn);
    });
  }

  function buildCard(p) {
    const card = el("article", "product-card mood-" + p.mood);

    const imgWrap = el("div", "product-card__image");
    const img = document.createElement("img");
    img.src = p.image;
    img.alt = p.name;
    img.loading = "lazy";
    imgWrap.appendChild(img);

    const body = el("div", "product-card__body");

    const mood = el("div", "product-card__mood");
    const label = el("span", "mood-label");
    label.appendChild(el("span", "mood-dot"));
    label.appendChild(document.createTextNode(p.mood));
    mood.appendChild(label);

    const name = el("h3", "product-card__name", p.name);
    const meta = el("div", "product-card__meta", p.size ? p.size : "Roll-on");

    const footer = el("div", "product-card__footer");
    const price = el("span", "price", formatPrice(p.price));
    price.appendChild(el("small", "", "บาท"));

    // ชื่อสินค้าที่ส่งไปหน้า order (รวมไซส์ถ้ามี)
    const itemName = p.size ? p.name + " " + p.size : p.name;
    const buy = el("a", "btn btn--small", "สั่งซื้อ");
    buy.href =
      "order.html?item=" +
      encodeURIComponent(itemName) +
      "&price=" +
      encodeURIComponent(p.price);

    footer.appendChild(price);
    footer.appendChild(buy);

    body.appendChild(mood);
    body.appendChild(name);
    body.appendChild(meta);
    body.appendChild(footer);

    card.appendChild(imgWrap);
    card.appendChild(body);
    return card;
  }

  function renderProducts() {
    list.innerHTML = "";
    const shown =
      currentMood === "all"
        ? products
        : products.filter((p) => p.mood === currentMood);

    if (shown.length === 0) {
      list.appendChild(el("p", "text-muted", "ไม่พบสินค้า"));
      return;
    }
    shown.forEach((p) => list.appendChild(buildCard(p)));
  }

  renderFilters();

  fetch("products.json")
    .then((res) => {
      if (!res.ok) throw new Error("HTTP " + res.status);
      return res.json();
    })
    .then((data) => {
      products = data;
      renderProducts();
    })
    .catch((err) => {
      console.error(err);
      list.innerHTML = "";
      list.appendChild(
        el("p", "text-muted", "โหลดสินค้าไม่สำเร็จ กรุณาลองใหม่อีกครั้ง")
      );
    });
}

/* ==========================================================
   2) order.html
   ========================================================== */
function initOrderPage() {
  const form = document.getElementById("orderForm");
  if (!form) return;

  // เติม item และ price จาก URL ลงช่อง #items และ #total ทันที
  const params = new URLSearchParams(window.location.search);
  const itemsInput = document.getElementById("items");
  const totalInput = document.getElementById("total");

  const itemParam = params.get("item");
  const priceParam = params.get("price");

  if (itemsInput && itemParam !== null) itemsInput.value = itemParam;
  if (totalInput && priceParam !== null) totalInput.value = priceParam;

  form.addEventListener("submit", function (e) {
    e.preventDefault();

    const payload = {
      customerName: document.getElementById("customerName").value,
      contact: document.getElementById("contact").value,
      items: document.getElementById("items").value,
      total: document.getElementById("total").value,
      note: document.getElementById("note").value,
    };

    fetch(APPS_SCRIPT_URL, {
      method: "POST",
      body: JSON.stringify(payload)
    })
    .then(() => { window.location.href = 'thankyou.html'; })
    .catch(error => {
      console.error(error);
      alert('เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง');
    });
  });
}

/* ==========================================================
   3) admin.html
   ========================================================== */

// parse CSV เอง: รองรับ field ที่อยู่ใน "..." , เครื่องหมาย "" และขึ้นบรรทัดใหม่ใน field
function parseCSV(text) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;

  // ตัด BOM ถ้ามี
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);

  for (let i = 0; i < text.length; i++) {
    const c = text[i];

    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      field = "";
      rows.push(row);
      row = [];
    } else {
      field += c;
    }
  }

  // แถวสุดท้ายที่ไม่มี newline ปิดท้าย
  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  // ตัดแถวว่างทิ้ง
  return rows.filter((r) => r.some((cell) => cell.trim() !== ""));
}

function initAdminPage() {
  const tbody = document.querySelector("#ordersTable tbody");
  if (!tbody) return;

  const COLS = 6; // วันเวลา, ชื่อ, เบอร์/Line, รายการ, ยอดรวม, หมายเหตุ

  function showMessage(msg) {
    tbody.innerHTML = "";
    const tr = document.createElement("tr");
    const td = el("td", "text-muted", msg);
    td.colSpan = COLS;
    td.style.textAlign = "center";
    tr.appendChild(td);
    tbody.appendChild(tr);
  }

  showMessage("กำลังโหลดข้อมูล...");

  fetch(SHEET_CSV_URL)
    .then((res) => {
      if (!res.ok) throw new Error("HTTP " + res.status);
      return res.text();
    })
    .then((csv) => {
      const rows = parseCSV(csv);
      const dataRows = rows.slice(1); // ข้ามแถวหัวตาราง

      if (dataRows.length === 0) {
        showMessage("ยังไม่มีออเดอร์");
        return;
      }

      // รายการล่าสุดขึ้นก่อน (ชีตเพิ่มแถวใหม่ต่อท้าย จึงกลับลำดับ)
      dataRows.reverse();

      tbody.innerHTML = "";
      dataRows.forEach((r) => {
        const tr = document.createElement("tr");
        for (let i = 0; i < COLS; i++) {
          let value = r[i] !== undefined ? r[i] : "";
          if (i === 4 && value !== "" && !isNaN(Number(value))) {
            value = formatPrice(value);
          }
          tr.appendChild(el("td", "", value));
        }
        tbody.appendChild(tr);
      });
    })
    .catch((err) => {
      console.error(err);
      showMessage("โหลดข้อมูลไม่สำเร็จ กรุณาลองใหม่อีกครั้ง");
    });
}

/* ---------- Init ---------- */
document.addEventListener("DOMContentLoaded", function () {
  initProductPage();
  initOrderPage();
  initAdminPage();
});
