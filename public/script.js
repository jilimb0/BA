let allData = []
let filtered = []
let favorites = new Set(
  JSON.parse(localStorage.getItem("tbilisi_favs") || "[]"),
)
let edits = JSON.parse(localStorage.getItem("tbilisi_edits") || "{}")
let sortCol = "location_score"
let sortDir = -1
let page = 1
const PAGE_SIZE = 100

const GROUP_EMOJI = {
  food: "🍽",
  retail: "🛍",
  health: "🏥",
  finance: "🏦",
  services: "✂️",
  tourism: "🏨",
  transport: "🚗",
  education: "📚",
  leisure: "🏋️",
  entertainment: "🎭",
  religious: "⛪",
  other: "📦",
}

const GROUP_COLORS = {
  food: "#d97706",
  retail: "#2563eb",
  health: "#059669",
  finance: "#7c3aed",
  services: "#db2777",
  tourism: "#ea580c",
  transport: "#0284c7",
  education: "#16a34a",
  leisure: "#0d9488",
  entertainment: "#9333ea",
  religious: "#525252",
  other: "#6b7280",
}

let map = null
let markersLayer = null
let circlesLayer = null

function getGrade(score) {
  const s = Number(score) || 0
  if (s >= 80) return "a"
  if (s >= 60) return "b"
  if (s >= 40) return "c"
  return "d"
}

async function loadCSV() {
  try {
    const response = await fetch("/businesses.csv", { cache: "no-store" })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    const text = await response.text()
    parseCSV(text)
  } catch (err) {
    document.getElementById("status").textContent =
      `❌ Failed to load CSV: ${err.message}`
  }
}

function splitCSVLine(line) {
  const out = []
  let cur = ""
  let q = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      if (q && line[i + 1] === '"') {
        cur += '"'
        i++
      } else q = !q
    } else if (ch === "," && !q) {
      out.push(cur)
      cur = ""
    } else {
      cur += ch
    }
  }
  out.push(cur)
  return out
}

function parseCSV(text) {
  const lines = text.replace(/\r/g, "").split("\n").filter(Boolean)
  if (!lines.length) throw new Error("CSV is empty")
  const header = splitCSVLine(lines[0])
  allData = lines.slice(1).map((line) => {
    const vals = splitCSVLine(line)
    const obj = {}
    header.forEach((h, i) => (obj[h] = vals[i] ?? ""))
    applyEdits(obj)
    return obj
  })
  document.getElementById("status").textContent = ""
  buildCategoryFilter()
  renderStats()
  applyFilters()
}

function applyEdits(obj) {
  const e = edits[obj.osm_id]
  if (!e) return
  Object.assign(obj, e)
}

function saveState() {
  localStorage.setItem("tbilisi_favs", JSON.stringify([...favorites]))
  localStorage.setItem("tbilisi_edits", JSON.stringify(edits))
}

function renderStats() {
  const total = allData.length
  const named = allData.filter((r) => r.name).length
  const phones = allData.filter((r) => r.phone).length
  const webs = allData.filter((r) => r.website).length
  document.getElementById("stats").innerHTML = `
    <div class="stat-card"><div class="num">${total.toLocaleString()}</div><div class="label">Total POIs</div></div>
    <div class="stat-card"><div class="num">${named.toLocaleString()}</div><div class="label">Named</div></div>
    <div class="stat-card"><div class="num">${phones.toLocaleString()}</div><div class="label">Has phone</div></div>
    <div class="stat-card"><div class="num">${webs.toLocaleString()}</div><div class="label">Has website</div></div>`
}

function buildCategoryFilter() {
  const group = document.getElementById("filterGroup").value
  const categorySelect = document.getElementById("filterCategory")
  const categoryField = document.getElementById("filterCategoryField")
  const counts = new Map()

  allData
    .filter((r) => !group || r.group === group)
    .forEach((r) => {
      const key = r.category || ""
      if (!key) return
      counts.set(key, (counts.get(key) || 0) + 1)
    })

  const cats = [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([name]) => name)

  categorySelect.innerHTML = '<option value="">All categories</option>'
  cats.forEach((c) => {
    const o = document.createElement("option")
    o.value = c
    o.textContent = c
    categorySelect.appendChild(o)
  })

  categoryField.style.display = group ? "flex" : "none"
}

function applyFilters() {
  const group = document.getElementById("filterGroup").value
  const cat = document.getElementById("filterCategory").value
  const states = {
    phone:
      document.querySelector('[data-field="phone"]').dataset.state || "any",
    hours:
      document.querySelector('[data-field="hours"]').dataset.state || "any",
    website:
      document.querySelector('[data-field="website"]').dataset.state || "any",
    address:
      document.querySelector('[data-field="address"]').dataset.state || "any",
    name: document.querySelector('[data-field="name"]').dataset.state || "any",
    favorite:
      document.querySelector('[data-field="favorite"]').dataset.state || "any",
  }

  filtered = allData.filter((r) => {
    const favPresent = favorites.has(r.osm_id)
    return (
      (!group || r.group === group) &&
      (!group || !cat || r.category === cat) &&
      fieldStateMatch(r.phone, states.phone, undefined, r.osm_id) &&
      fieldStateMatch(r.opening_hours, states.hours, undefined, r.osm_id) &&
      fieldStateMatch(r.website, states.website, undefined, r.osm_id) &&
      fieldStateMatch(getAddress(r), states.address, undefined, r.osm_id) &&
      fieldStateMatch(r.name, states.name, undefined, r.osm_id) &&
      fieldStateMatch(null, states.favorite, favPresent, r.osm_id)
    )
  })

  // Apply active sort
  applyCurrentSort()

  page = 1
  render()
  updateMapMarkers()
}

function applyCurrentSort() {
  if (!sortCol) return
  const isNumeric = sortCol === "density_500m" || sortCol === "location_score"
  filtered.sort((a, b) => {
    if (isNumeric) {
      const valA = Number(a[sortCol]) || 0
      const valB = Number(b[sortCol]) || 0
      return (valA - valB) * sortDir
    }
    const strA = (a[sortCol] || "").toLowerCase()
    const strB = (b[sortCol] || "").toLowerCase()
    return strA.localeCompare(strB) * sortDir
  })
}

function setupFilters() {
  const groupSelect = document.getElementById("filterGroup")
  const categorySelect = document.getElementById("filterCategory")
  const categoryField = document.getElementById("filterCategoryField")

  const refresh = () => {
    categorySelect.value = ""
    buildCategoryFilter()
    applyFilters()
  }

  groupSelect.addEventListener("change", refresh)
  categorySelect.addEventListener("change", applyFilters)
  categoryField.style.display = "none"
}

function getAddress(r) {
  return [r.street, r.housenumber].filter(Boolean).join(" ")
}

function fieldStateMatch(value, state, isFavorite, _osmId) {
  if (state === "any") return true
  const present = isFavorite !== undefined ? isFavorite : !!value
  return state === "has" ? present : !present
}

function toggleFavorite(id) {
  favorites.has(id) ? favorites.delete(id) : favorites.add(id)
  saveState()
  applyFilters()
}

function editItem(id) {
  const current = allData.find((r) => r.osm_id === id)
  if (!current) return
  const name = prompt("Name", current.name || "")
  if (name === null) return
  const phone = prompt("Phone", current.phone || "")
  if (phone === null) return
  const website = prompt("Website", current.website || "")
  if (website === null) return
  const opening_hours = prompt("Hours", current.opening_hours || "")
  if (opening_hours === null) return
  const address = prompt("Address", getAddress(current))
  if (address === null) return
  edits[id] = { name, phone, website, opening_hours, address }
  saveState()
  applyEdits(current)
  applyFilters()
}

function badge(group) {
  const g = group || "other"
  return `<span class="badge group-${g}">${GROUP_EMOJI[g] || "📦"} ${g}</span>`
}

function render() {
  const start = (page - 1) * PAGE_SIZE
  const items = filtered.slice(start, start + PAGE_SIZE)
  const group = document.getElementById("filterGroup").value
  const showCuisine = group === "food"
  const tbody = document.getElementById("tableBody")
  const table = document.getElementById("mainTable")
  const cuisineHead = document.getElementById("th-cuisine")
  cuisineHead.style.display = showCuisine ? "" : "none"

  tbody.innerHTML = items
    .map((r) => {
      const fav = favorites.has(r.osm_id) ? "⭐" : "☆"
      const cuisines = showCuisine
        ? (r.cuisine || "")
            .split(";")
            .filter(Boolean)
            .slice(0, 3)
            .map((c) => `<span class="cuisine-tag">${c}</span>`)
            .join("")
        : ""
      const addr = getAddress(r)
      const coordsLink =
        r.lat && r.lon
          ? `<a href="javascript:void(0)" onclick="focusOnMap(${Number(r.lat)}, ${Number(r.lon)}, '${r.osm_id}')">${Number(r.lat).toFixed(4)}, ${Number(r.lon).toFixed(4)}</a>`
          : "—"
      const hoursDisplay = r.opening_hours || ""
      const website = r.website
        ? `<a class="link" href="${/^https?:\/\//i.test(r.website) ? r.website : "https://" + r.website}" target="_blank" rel="noopener noreferrer">${r.website}</a>`
        : "—"
      const score = Number(r.location_score) || 0
      const grade = getGrade(score)

      return `<tr>
      <td>${badge(r.group)}</td>
      <td>${r.category || ""}</td>
      <td class="name-cell ${r.name ? "" : "no-name"}">${r.name || "—"}</td>
      <td style="font-weight:600; text-align:center;">${r.density_500m || 0}</td>
      <td style="text-align:center;"><span class="score-badge grade-${grade}">${score}</span></td>
      <td class="address">${addr || "—"}</td>
      <td class="phone">${r.phone || "—"}</td>
      <td class="website">${website}</td>
      <td class="hours">${hoursDisplay || "—"}</td>
      <td class="coords">${coordsLink}</td>
      ${showCuisine ? `<td>${cuisines}</td>` : ""}
      <td class="action-cell">
        <button class="action-btn report" style="background:#eef2ff; color:#4338ca; border:1px solid #c7d2fe; padding:2px 8px; border-radius:4px; cursor:pointer;" onclick="openReportModal('${r.osm_id}')">Report</button>
        <button class="action-btn fav" onclick="toggleFavorite('${r.osm_id}')">${fav}</button>
        <button class="action-btn edit" onclick="editItem('${r.osm_id}')">Edit</button>
      </td>
    </tr>`
    })
    .join("")

  table.style.display = "table"
  renderPagination()
}

function goToPage(p) {
  page = p
  render()
}

function renderPagination() {
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const start = filtered.length ? (page - 1) * PAGE_SIZE + 1 : 0
  const end = Math.min(page * PAGE_SIZE, filtered.length)
  let btns = ""
  const from = Math.max(1, page - 2)
  const to = Math.min(totalPages, page + 2)
  for (let p = from; p <= to; p++)
    btns += `<button class="page-btn ${p === page ? "active" : ""}" onclick="goToPage(${p})">${p}</button>`
  document.getElementById("pagination").innerHTML =
    `<div class="info">${filtered.length ? `Showing ${start}-${end} of ${filtered.length}` : "No rows match filters"}</div><div class="page-btns">${btns}</div>`
}

// --- Map Functions (Sprint 1) ---

function initMap() {
  if (typeof L === "undefined") return
  const mapEl = document.getElementById("map")
  if (!mapEl) return

  map = L.map("map").setView([41.7151, 44.8271], 13)
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: "© OpenStreetMap contributors",
  }).addTo(map)

  markersLayer = L.layerGroup().addTo(map)
  circlesLayer = L.layerGroup().addTo(map)
}

function updateMapMarkers() {
  if (!map || !markersLayer) return
  markersLayer.clearLayers()
  circlesLayer.clearLayers()

  const validPoints = filtered.filter(
    (r) => r.lat && r.lon && !Number.isNaN(Number(r.lat)) && !Number.isNaN(Number(r.lon)),
  )
  const renderLimit = Math.min(validPoints.length, 600)

  for (let i = 0; i < renderLimit; i++) {
    const r = validPoints[i]
    const lat = Number(r.lat)
    const lon = Number(r.lon)
    const color = GROUP_COLORS[r.group] || "#6b7280"

    const marker = L.circleMarker([lat, lon], {
      radius: 6,
      fillColor: color,
      color: "#ffffff",
      weight: 1.5,
      opacity: 1,
      fillOpacity: 0.85,
    })

    const grade = getGrade(r.location_score)
    const popupContent = `
      <div style="font-family: sans-serif; font-size: 13px; line-height: 1.4; min-width: 180px;">
        <strong style="font-size:14px; color:#1e1b4b;">${r.name || "Unnamed Business"}</strong><br/>
        <span style="color:#64748b;">${r.category} (${r.group})</span>
        <div style="margin: 8px 0; display:flex; gap: 6px; flex-wrap:wrap;">
          <span style="background:#f1f5f9; padding:3px 6px; border-radius:4px; font-size:11px;">
            🚶 500m: <strong>${r.density_500m || 0}</strong>
          </span>
          <span style="background:#eef2ff; color:#4338ca; padding:3px 6px; border-radius:4px; font-size:11px; font-weight:bold;">
            ⭐ Score: ${r.location_score || 0} (${grade.toUpperCase()})
          </span>
        </div>
        <button style="width:100%; margin-top:6px; background:#4f46e5; color:white; border:none; padding:5px 8px; border-radius:4px; cursor:pointer; font-size:11px; font-weight:600;" onclick="openReportModal('${r.osm_id}')">
          📊 Location Report
        </button>
      </div>
    `
    marker.bindPopup(popupContent)

    marker.on("click", () => {
      drawCatchmentCircles(lat, lon)
    })

    markersLayer.addLayer(marker)
  }

  if (validPoints.length > 0 && map) {
    const first = validPoints[0]
    map.panTo([Number(first.lat), Number(first.lon)])
  }
}

function drawCatchmentCircles(lat, lon) {
  if (!map || !circlesLayer) return
  circlesLayer.clearLayers()

  // 500m circle (walking catchment)
  L.circle([lat, lon], {
    radius: 500,
    color: "#3b82f6",
    fillColor: "#3b82f6",
    fillOpacity: 0.12,
    weight: 2,
  }).addTo(circlesLayer)

  // 1000m circle (extended catchment)
  L.circle([lat, lon], {
    radius: 1000,
    color: "#8b5cf6",
    fillColor: "#8b5cf6",
    fillOpacity: 0.05,
    weight: 1.5,
    dashArray: "4, 4",
  }).addTo(circlesLayer)
}

function focusOnMap(lat, lon, osmId) {
  if (!map) return
  map.setView([lat, lon], 16)
  drawCatchmentCircles(lat, lon)
  openReportModal(osmId)
}

// --- Report Modal & B2B Pay-per-report ---

function openReportModal(osmId) {
  const item = allData.find((r) => r.osm_id === osmId)
  if (!item) return

  const score = Number(item.location_score) || 0
  const grade = getGrade(score).toUpperCase()
  const title = item.name || "Commercial POI"

  document.getElementById("reportModalTitle").textContent =
    `Location Intelligence Report`
  document.getElementById("btnOpenFullReport").href =
    `/api/report?osm_id=${encodeURIComponent(osmId)}`

  const bodyEl = document.getElementById("reportModalBody")
  bodyEl.innerHTML = `
    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
      <div>
        <div style="font-size:17px; font-weight:700; color:#0f172a;">${title}</div>
        <div style="color:#64748b; font-size:13px; margin-top:2px;">Category: <strong>${item.category || "N/A"}</strong> · Group: <strong>${item.group || "N/A"}</strong></div>
      </div>
      <div style="text-align:right;">
        <span class="score-badge grade-${grade.toLowerCase()}" style="font-size:15px; padding:4px 12px;">Grade ${grade}</span>
        <div style="font-size:12px; color:#64748b; margin-top:3px;">Score: ${score}/100</div>
      </div>
    </div>

    <div class="report-metric-grid">
      <div class="report-metric-box">
        <div class="metric-num">${item.density_500m || 0}</div>
        <div class="metric-label">Businesses in 500m Walking Zone</div>
      </div>
      <div class="report-metric-box">
        <div class="metric-num">${item.density_1000m || 0}</div>
        <div class="metric-label">Businesses in 1000m Catchment</div>
      </div>
    </div>

    <div class="report-rec-box">
      <strong>Strategic Location Viability:</strong>
      <p style="margin:4px 0 0; line-height:1.4;">
        ${
          score >= 75
            ? "Prime commercial cluster: strong footfall attractors, excellent pedestrian density, proven commercial demand."
            : score >= 50
              ? "Good viability: active commercial district, monitor direct competitor differentiation and brand strength."
              : "Moderate or developing commercial density: suitable for destination retail or specialty services."
        }
      </p>
    </div>

    <div style="border-top:1px solid #e2e8f0; padding-top:10px; font-size:12px; color:#64748b; display:flex; justify-content:space-between; align-items:center;">
      <span>📍 Coords: ${Number(item.lat).toFixed(5)}, ${Number(item.lon).toFixed(5)}</span>
      <span class="paywall-badge">Location Intelligence · $19 Pay-per-report</span>
    </div>
  `

  document.getElementById("reportModal").classList.remove("hidden")
}

function closeReportModal() {
  document.getElementById("reportModal").classList.add("hidden")
}

// --- Sorting ---

function setupSorting() {
  const headers = [
    { id: "th-group", col: "group" },
    { id: "th-category", col: "category" },
    { id: "th-name", col: "name" },
    { id: "th-density", col: "density_500m" },
    { id: "th-score", col: "location_score" },
  ]

  for (const { id, col } of headers) {
    const el = document.getElementById(id)
    if (!el) continue
    el.addEventListener("click", () => {
      if (sortCol === col) {
        sortDir = -sortDir
      } else {
        sortCol = col
        sortDir = col === "location_score" || col === "density_500m" ? -1 : 1
      }
      applyCurrentSort()
      page = 1
      render()
      updateMapMarkers()
    })
  }
}

// --- View Switcher ---

function setupViewSwitcher() {
  const layout = document.getElementById("contentLayout")
  const btnSplit = document.getElementById("btnViewSplit")
  const btnMap = document.getElementById("btnViewMap")
  const btnTable = document.getElementById("btnViewTable")

  const setView = (mode) => {
    btnSplit.classList.toggle("active", mode === "split")
    btnMap.classList.toggle("active", mode === "map")
    btnTable.classList.toggle("active", mode === "table")

    layout.className = `layout-${mode}`
    if (map) {
      setTimeout(() => map.invalidateSize(), 200)
    }
  }

  btnSplit?.addEventListener("click", () => setView("split"))
  btnMap?.addEventListener("click", () => setView("map"))
  btnTable?.addEventListener("click", () => setView("table"))
}

function setupTriStateCheckboxes() {
  document.querySelectorAll(".tri-check").forEach((cb) => {
    cb.dataset.state = "any"
    const box = cb.closest(".field-card")
    const updateUI = () => {
      const state = cb.dataset.state || "any"
      box.classList.toggle("active-has", state === "has")
      box.classList.toggle("active-missing", state === "missing")
      cb.checked = state !== "any"
    }
    const cycle = (e) => {
      e.preventDefault()
      const current = cb.dataset.state || "any"
      const next =
        current === "any" ? "has" : current === "has" ? "missing" : "any"
      cb.dataset.state = next
      updateUI()
      applyFilters()
    }
    box.addEventListener("click", cycle)
    cb.addEventListener("click", cycle)
    updateUI()
  })
}

function openModal() {
  document.getElementById("generateModal").classList.remove("hidden")
}
function closeModal() {
  document.getElementById("generateModal").classList.add("hidden")
}

async function runGeneration() {
  const fileInput = document.getElementById("genFile")
  const status = document.getElementById("status")
  const file = fileInput.files && fileInput.files[0]
  if (!file) {
    status.textContent = "❌ Please choose a GeoJSON file first"
    return
  }
  status.textContent = "⏳ Generating list..."
  const formData = new FormData()
  formData.append("inputFile", file)
  try {
    const r = await fetch("/generate", { method: "POST", body: formData })
    const data = await r.json()
    if (!r.ok || !data.ok) throw new Error(data.error || `HTTP ${r.status}`)
    status.textContent = "✅ Generation complete"
    await loadCSV()
    closeModal()
  } catch (err) {
    status.textContent = `❌ Generation failed: ${err.message}`
  }
}

document.addEventListener("DOMContentLoaded", () => {
  initMap()
  setupTriStateCheckboxes()
  setupFilters()
  setupSorting()
  setupViewSwitcher()

  document
    .getElementById("openGenerateModal")
    .addEventListener("click", openModal)
  document
    .getElementById("closeGenerateModal")
    .addEventListener("click", closeModal)
  document
    .getElementById("cancelGenerate")
    .addEventListener("click", closeModal)
  document
    .getElementById("runGenerate")
    .addEventListener("click", runGeneration)

  document
    .getElementById("closeReportModal")
    ?.addEventListener("click", closeReportModal)
  document
    .getElementById("btnCloseReport")
    ?.addEventListener("click", closeReportModal)
  document
    .querySelector("#reportModal .modal-backdrop")
    ?.addEventListener("click", closeReportModal)

  document
    .getElementById("copySampleQuery")
    .addEventListener("click", async () => {
      const text = document.getElementById("sampleQuery").innerText
      await navigator.clipboard.writeText(text)
      const btn = document.getElementById("copySampleQuery")
      const prev = btn.textContent
      btn.textContent = "Copied"
      setTimeout(() => (btn.textContent = prev), 1200)
    })
  document
    .querySelector("#generateModal .modal-backdrop")
    .addEventListener("click", closeModal)

  loadCSV()
})
