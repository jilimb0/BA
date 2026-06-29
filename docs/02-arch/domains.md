# Architecture - Domain Design

## Core Domain: Business Data

### ingestion
- **Responsibility:** GeoJSON file upload and validation
- **Entities:** UploadedFile, GeoJSONFeature
- **Use cases:** uploadGeoJSON, validateFormat, validateSize

### analysis
- **Responsibility:** Filtering and categorizing business POIs
- **Entities:** BusinessPOI, Category, Group
- **Use cases:** classifyFeature, isKeep, getGroup

### storage
- **Responsibility:** CSV persistence of processed data
- **Entities:** BusinessCSV, SummaryCSV
- **Use cases:** writeCSV, readCSV

### presentation
- **Responsibility:** Browser UI for data exploration
- **Entities:** Filter, Pagination, Favorite
- **Use cases:** filterByGroup, filterByField, paginate, toggleFavorite
