#!/usr/bin/env bash
set -euo pipefail

CITY="${1:-}"
OUTPUT="${2:-raw.geojson}"

if [ -z "$CITY" ]; then
  echo "Usage: $0 <city-name> [output-file]"
  echo ""
  echo "Downloads GeoJSON data from Overpass API for a given city."
  echo ""
  echo "Examples:"
  echo "  $0 Tbilisi"
  echo "  $0 Berlin my-city.geojson"
  exit 1
fi

QUERY=$(cat <<EOF
[out:json][timeout:60];
{{geocodeArea:$CITY}}->.searchArea;
(
  node["amenity"](area.searchArea);
  way["amenity"](area.searchArea);
  relation["amenity"](area.searchArea);
  node["shop"](area.searchArea);
  way["shop"](area.searchArea);
  relation["shop"](area.searchArea);
  node["healthcare"](area.searchArea);
  way["healthcare"](area.searchArea);
  relation["healthcare"](area.searchArea);
  node["office"](area.searchArea);
  way["office"](area.searchArea);
  relation["office"](area.searchArea);
  node["leisure"](area.searchArea);
  way["leisure"](area.searchArea);
  relation["leisure"](area.searchArea);
  node["tourism"](area.searchArea);
  way["tourism"](area.searchArea);
  relation["tourism"](area.searchArea);
  node["craft"](area.searchArea);
  way["craft"](area.searchArea);
  relation["craft"](area.searchArea);
);
out center;
EOF
)

echo "Fetching business POI data for '$CITY' from Overpass API..."
echo "(this may take 30-60 seconds for large cities)"

curl -s -X POST \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "data=$QUERY" \
  https://overpass-api.de/api/interpreter \
  -o "$OUTPUT"

if [ -f "$OUTPUT" ]; then
  SIZE=$(wc -c < "$OUTPUT" | tr -d ' ')
  echo "Downloaded $SIZE bytes to $OUTPUT"
else
  echo "ERROR: Download failed"
  exit 1
fi
