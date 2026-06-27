import { readFileSync, writeFileSync } from "fs"

const args = Object.fromEntries(
  process.argv
    .slice(2)
    .flatMap((arg) => {
      const match = arg.match(/^--([^=]+)=(.*)$/)
      return match ? [[match[1], match[2]]] : []
    }),
)

const INPUT_GEOJSON = args.input ?? "raw.geojson"
const OUTPUT_CSV = args.output ?? "businesses.csv"
const OUTPUT_SUMMARY = args.summary ?? "businesses_summary.csv"
const CITY_NAME = args.city ?? "Businesses"

// ============ WHITELIST — только реальные бизнесы ============

const AMENITY_KEEP = new Set([
  // еда и напитки
  "restaurant",
  "cafe",
  "bar",
  "pub",
  "fast_food",
  "food_court",
  "ice_cream",
  "biergarten",
  // здоровье
  "pharmacy",
  "clinic",
  "hospital",
  "dentist",
  "doctors",
  "veterinary",
  // финансы
  "bureau_de_change",
  // транспорт
  "fuel",
  "car_wash",
  "car_rental",
  "taxi",
  // образование
  "school",
  "university",
  "college",
  "kindergarten",
  "library",
  "language_school",
  // развлечения
  "cinema",
  "theatre",
  "nightclub",
  "arts_centre",
  // услуги
  "post_office",
  "coworking_space",
])

const SHOP_KEEP = new Set([
  "supermarket",
  "convenience",
  "grocery",
  "bakery",
  "butcher",
  "greengrocer",
  "clothes",
  "shoes",
  "electronics",
  "hardware",
  "furniture",
  "florist",
  "jewelry",
  "gift",
  "books",
  "mall",
  "department_store",
  "marketplace",
  "hairdresser",
  "beauty",
  "laundry",
  "tailor",
  "dry_cleaning",
  "travel_agency",
  "optician",
  "wine",
  "alcohol",
  "coffee",
  "confectionery",
  "pastry",
  "dairy",
  "deli",
  "seafood",
  "outdoor",
  "sports",
  "toys",
  "pet",
  "bicycle",
  "cosmetics",
  "massage",
  "music",
  "art",
  "car",
  "car_parts",
  "car_repair",
  "motorcycle",
  "computer",
  "mobile_phone",
  "appliance",
  "paint",
  "garden_centre",
  "do_it_yourself",
  "ticket",
  "stationery",
  "bags",
  "watches",
  "glasses",
  "herbalist",
  "nutrition_supplements",
])

const HEALTHCARE_KEEP = new Set([
  "clinic",
  "hospital",
  "dentist",
  "pharmacy",
  "physiotherapist",
  "psychotherapist",
  "blood_donation",
  "sample_collection",
])

const OFFICE_KEEP = new Set([
  "lawyer",
  "accountant",
  "insurance",
  "real_estate",
  "travel_agent",
  "courier",
  "advertising_agency",
  "ngo",
  "company",
  "architect",
  "coworking",
  "financial",
  "consulting",
  "telecommunications",
  "educational_institution",
])

const LEISURE_KEEP = new Set([
  "sports_centre",
  "fitness_centre",
  "swimming_pool",
  "gym",
  "dance",
])

const TOURISM_KEEP = new Set([
  "hotel",
  "hostel",
  "guest_house",
  "motel",
  "attraction",
  "museum",
  "gallery",
])

const CRAFT_KEEP = new Set([
  "carpenter",
  "electrician",
  "plumber",
  "shoemaker",
  "tailor",
  "photographer",
  "electronics_repair",
  "key_cutter",
  "watchmaker",
  "jeweller",
  "confectionery",
  "handicraft",
  "pottery",
])

// ============ GROUP MAP ============

const GROUP_MAP: Record<string, string> = {
  restaurant: "food",
  cafe: "food",
  bar: "food",
  pub: "food",
  fast_food: "food",
  food_court: "food",
  ice_cream: "food",
  biergarten: "food",

  supermarket: "retail",
  convenience: "retail",
  grocery: "retail",
  bakery: "retail",
  butcher: "retail",
  greengrocer: "retail",
  clothes: "retail",
  shoes: "retail",
  electronics: "retail",
  hardware: "retail",
  furniture: "retail",
  florist: "retail",
  jewelry: "retail",
  gift: "retail",
  books: "retail",
  mall: "retail",
  department_store: "retail",
  marketplace: "retail",
  wine: "retail",
  alcohol: "retail",
  coffee: "retail",
  confectionery: "retail",
  pastry: "retail",
  dairy: "retail",
  deli: "retail",
  seafood: "retail",
  outdoor: "retail",
  sports: "retail",
  toys: "retail",
  pet: "retail",
  bicycle: "retail",
  cosmetics: "retail",
  music: "retail",
  art: "retail",
  car: "retail",
  car_parts: "retail",
  motorcycle: "retail",
  computer: "retail",
  mobile_phone: "retail",
  appliance: "retail",
  paint: "retail",
  garden_centre: "retail",
  do_it_yourself: "retail",
  ticket: "retail",
  stationery: "retail",
  watches: "retail",
  bags: "retail",
  glasses: "retail",

  pharmacy: "health",
  clinic: "health",
  hospital: "health",
  dentist: "health",
  doctors: "health",
  veterinary: "health",
  optician: "health",
  physiotherapist: "health",
  psychotherapist: "health",
  blood_donation: "health",
  sample_collection: "health",

  bureau_de_change: "finance",
  insurance: "finance",
  financial: "finance",

  hotel: "tourism",
  hostel: "tourism",
  guest_house: "tourism",
  motel: "tourism",
  attraction: "tourism",
  museum: "tourism",
  gallery: "tourism",

  sports_centre: "leisure",
  fitness_centre: "leisure",
  swimming_pool: "leisure",
  gym: "leisure",
  dance: "leisure",

  cinema: "entertainment",
  theatre: "entertainment",
  nightclub: "entertainment",
  arts_centre: "entertainment",

  school: "education",
  university: "education",
  college: "education",
  kindergarten: "education",
  library: "education",
  language_school: "education",
  educational_institution: "education",

  fuel: "transport",
  car_wash: "transport",
  car_rental: "transport",
  taxi: "transport",

  hairdresser: "services",
  beauty: "services",
  laundry: "services",
  tailor: "services",
  dry_cleaning: "services",
  travel_agency: "services",
  travel_agent: "services",
  lawyer: "services",
  accountant: "services",
  coworking_space: "services",
  coworking: "services",
  post_office: "services",
  courier: "services",
  advertising_agency: "services",
  massage: "services",
  car_repair: "services",
  electronics_repair: "services",
  key_cutter: "services",
  shoemaker: "services",
  photographer: "services",
  architect: "services",
  consulting: "services",
  real_estate: "services",

  place_of_worship: "religious",
}

function isKeep(key: string, val: string): boolean {
  if (key === "amenity") return AMENITY_KEEP.has(val)
  if (key === "shop") return SHOP_KEEP.has(val)
  if (key === "healthcare") return HEALTHCARE_KEEP.has(val)
  if (key === "office") return OFFICE_KEEP.has(val)
  if (key === "leisure") return LEISURE_KEEP.has(val)
  if (key === "tourism") return TOURISM_KEEP.has(val)
  if (key === "craft") return CRAFT_KEEP.has(val)
  return false
}

const CAT_KEYS = [
  "amenity",
  "shop",
  "healthcare",
  "office",
  "leisure",
  "tourism",
  "craft",
]

function esc(v: unknown): string {
  if (v == null || v === "") return ""
  const s = String(v).replace(/"/g, '""')
  return s.includes(",") || s.includes('"') || s.includes("\n") ? `"${s}"` : s
}

const raw = JSON.parse(readFileSync(INPUT_GEOJSON, "utf-8"))
const features = raw.features ?? raw.elements ?? []

const rows: string[] = []
const summary: Record<string, Record<string, number>> = {}
let skipped = 0

for (const f of features) {
  const props = f.properties ?? f.tags ?? {}

  let catKey = "",
    catVal = ""
  for (const k of CAT_KEYS) {
    if (props[k]) {
      catKey = k
      catVal = props[k]
      break
    }
  }
  if (!catKey) {
    skipped++
    continue
  }

  // выкидываем мусор
  if (!isKeep(catKey, catVal)) {
    skipped++
    continue
  }

  const geo = f.geometry
  let lat = "",
    lon = ""
  if (geo?.type === "Point") {
    lon = geo.coordinates[0]?.toFixed(6) ?? ""
    lat = geo.coordinates[1]?.toFixed(6) ?? ""
  } else if (props["@lat"]) {
    lat = props["@lat"]
    lon = props["@lon"]
  }

  const group = GROUP_MAP[catVal] ?? "other"
  const name =
    props.name || props["name:en"] || props["name:ka"] || props["name:ru"] || ""

  rows.push(
    [
      esc(props["@id"] ?? f.id ?? ""),
      esc(name),
      esc(catKey),
      esc(catVal),
      esc(group),
      lat,
      lon,
      esc(props["addr:street"] ?? ""),
      esc(props["addr:housenumber"] ?? ""),
      esc(props.phone ?? props["contact:phone"] ?? ""),
      esc(props.website ?? props["contact:website"] ?? ""),
      esc(props.opening_hours ?? ""),
      esc(props.cuisine ?? ""),
      esc(props.brand ?? ""),
    ].join(","),
  )

  summary[group] ??= {}
  summary[group][catVal] = (summary[group][catVal] ?? 0) + 1
}

const header =
  "osm_id,name,tag_key,category,group,lat,lon,street,housenumber,phone,website,opening_hours,cuisine,brand"
writeFileSync(
  OUTPUT_CSV,
  [header, ...rows].join("\n"),
  "utf-8",
)

const summaryRows = ["group,category,count"]
for (const [g, cats] of Object.entries(summary).sort()) {
  for (const [c, cnt] of Object.entries(cats).sort((a, b) => b[1] - a[1])) {
    summaryRows.push(`${g},${c},${cnt}`)
  }
}
writeFileSync(OUTPUT_SUMMARY, summaryRows.join("\n"), "utf-8")

console.log(`\n✅ ${CITY_NAME}: ${rows.length}`)
console.log(`🗑️  Выброшено мусора: ${skipped}`)
console.log(`📄 → ${OUTPUT_CSV}`)
console.log(`📊 → ${OUTPUT_SUMMARY}\n`)

console.table(
  Object.entries(summary)
    .map(([g, cats]) => ({
      group: g,
      total: Object.values(cats).reduce((a, b) => a + b, 0),
      top: Object.entries(cats)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([c, n]) => `${c}:${n}`)
        .join(", "),
    }))
    .sort((a, b) => b.total - a.total),
)
