let allData = []
let filtered = []
let favorites = new Set(
  JSON.parse(localStorage.getItem("tbilisi_favs") || "[]"),
)
let edits = JSON.parse(localStorage.getItem("tbilisi_edits") || "{}")
let sortCol = "group"
let sortDir = 1
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
    <div class="stat-card"><div class="num">${total.toLocaleString()}</div><div class="label">Total</div></div>
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

  render()
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
function hasField(r, field) {
  if (field === "address") return !!getAddress(r)
  if (field === "hours") return !!r.opening_hours
  if (field === "favorite") return favorites.has(r.osm_id)
  return !!r[field]
}
function fieldStateMatch(value, state, isFavorite, osmId) {
  if (state === "any") return true
  const present = fieldStateMatchValue(value, isFavorite, osmId)
  return state === "has" ? present : !present
}
function fieldStateMatchValue(value, isFavorite, osmId) {
  if (isFavorite !== undefined) return isFavorite
  return !!value
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
      (!cat || r.category === cat) &&
      fieldStateMatch(r.phone, states.phone, undefined, r.osm_id) &&
      fieldStateMatch(r.opening_hours, states.hours, undefined, r.osm_id) &&
      fieldStateMatch(r.website, states.website, undefined, r.osm_id) &&
      fieldStateMatch(getAddress(r), states.address, undefined, r.osm_id) &&
      fieldStateMatch(r.name, states.name, undefined, r.osm_id) &&
      fieldStateMatch(null, states.favorite, favPresent, r.osm_id)
    )
  })
  render()
}
function badge(group) {
  const g = group || "other"
  return `<span class="badge group-${g}">${GROUP_EMOJI[g] || "📦"} ${g}</span>`
}
function webLink(url) {
  if (!url) return ""
  const href = /^https?:\/\//i.test(url) ? url : "https://" + url
  return `<a class="link" href="${href}" target="_blank" rel="noopener noreferrer">${url}</a>`
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
          ? `<a href="https://www.google.com/maps?q=${r.lat},${r.lon}" target="_blank" rel="noopener noreferrer">${Number(r.lat).toFixed(5)}, ${Number(r.lon).toFixed(5)}</a>`
          : ""
      const hoursDisplay = r.opening_hours || ""
      const website = r.website
        ? `<a class="link" href="${/^https?:\/\//i.test(r.website) ? r.website : "https://" + r.website}" target="_blank" rel="noopener noreferrer">${r.website}</a>`
        : "—"
      return `<tr>
      <td>${badge(r.group)}</td>
      <td>${r.category || ""}</td>
      <td class="name-cell ${r.name ? "" : "no-name"}">${r.name || "—"}</td>
      <td class="address">${addr || "—"}</td>
      <td class="phone">${r.phone || "—"}</td>
      <td class="website">${website}</td>
      <td class="hours">${hoursDisplay || "—"}</td>
      <td class="coords">${coordsLink || "—"}</td>
      ${showCuisine ? `<td>${cuisines}</td>` : ""}
      <td class="action-cell"><button class="action-btn fav" onclick="toggleFavorite('${r.osm_id}')">${fav}</button><button class="action-btn edit" onclick="editItem('${r.osm_id}')">Edit</button></td>
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
function setupFilters() {
  document.getElementById("filterGroup").addEventListener("change", () => {
    buildCategoryFilter()
    applyFilters()
  })
  document
    .getElementById("filterCategory")
    .addEventListener("change", applyFilters)
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
  setupTriStateCheckboxes()
  setupFilters()
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
