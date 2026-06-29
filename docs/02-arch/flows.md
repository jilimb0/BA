# User Flows

## Main Flow: Browse Businesses

1. **Load** → Server serves index.html + businesses.csv
2. **Filter** → User selects group/category or toggles field filters
3. **Browse** → Data is paginated at 100 rows/page
4. **Favorite** → User marks businesses for quick access
5. **Edit** → User corrects names, phones, websites inline

## Data Processing Flow

1. **Upload** → User uploads GeoJSON file via modal
2. **Validate** → Server checks file type and size (max 50MB)
3. **Process** → Temp file written → `tsx process.ts` extracts business POIs
4. **Classify** → Whitelist filtering → GROUP_MAP categorization → CSV generation
5. **Reload** → Browser fetches updated CSVs and re-renders table
