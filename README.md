# Atlanta Neighborhoods Map

A dual-format map project: **interactive web map** and **print-ready poster** (24×36 inches) showcasing Atlanta's neighborhoods, cultural landmarks, the BeltLine, and parks.

## Quick Start

### Interactive Map

1. Serve the files with any local web server:

```bash
# Python 3
python -m http.server 8000

# Node.js (npx)
npx serve .

# PHP
php -S localhost:8000
```

2. Open `http://localhost:8000` in your browser

### Print Version

1. Open `http://localhost:8000/print.html`
2. Follow the export instructions on screen

---

## Project Structure

```
├── index.html              # Interactive map (main entry point)
├── print.html              # Print-optimized map layout
├── css/
│   └── styles.css          # Design system & UI styles
├── js/
│   ├── config.js           # Map configuration & settings
│   └── map.js              # Interactive map application
├── data/
│   ├── neighborhoods.geojson   # Atlanta neighborhood boundaries
│   ├── parks.geojson           # Parks and greenspace
│   ├── beltline.geojson        # BeltLine trail alignment
│   ├── landmarks.geojson       # Cultural landmarks
│   └── home.geojson            # Home marker location
├── print/
│   └── (export outputs go here)
└── README.md
```

---

## Features

### Interactive Map

- **Smooth pan/zoom** with Leaflet
- **Toggleable layers**: Neighborhoods, Parks, BeltLine, Landmarks
- **Clickable landmarks** with informative popups
- **Home marker** (640 Irwin St NE) always visible with gold star
- **Responsive layout** for desktop and tablet
- **URL state management** for shareable views
- **Neighborhood hover highlighting**

### Design System

| Element | Specification |
|---------|---------------|
| Background | Light warm grey `rgb(245,245,245)` |
| BeltLine | Old gold `#B08A00`, 4pt stroke |
| Parks | Haint blue `#A4CCE3`, 40% opacity |
| Streets | Grey `#666666` |
| Typography | Montserrat Alternates (primary), Quicksand (fallback) |
| Home marker | Five-point star, old gold `#B08A00` |

### Landmarks Included

| Landmark | Category | Coordinates |
|----------|----------|-------------|
| King Center | Civil Rights | 33.75505, -84.37295 |
| MLK Birth Home | Civil Rights | 33.75535, -84.37030 |
| Ebenezer Baptist Church | Civil Rights | 33.75485, -84.37165 |
| Ponce City Market | Food & Retail | 33.77260, -84.36540 |
| Krog Street Market | Food & Retail | 33.75865, -84.36315 |
| Dad's Garage | Arts & Culture | 33.75295, -84.34630 |
| Fox Theatre | Arts & Culture | 33.77265, -84.38565 |
| High Museum | Arts & Culture | 33.79025, -84.38540 |
| Zoo Atlanta | Parks & Recreation | 33.73275, -84.37015 |
| Your DeKalb Farmers Market | Food & Retail | 33.77425, -84.28760 |
| East Lake Golf Club | Parks & Recreation | 33.74965, -84.31015 |
| Morehouse College | Education | 33.74720, -84.41275 |
| Spelman College | Education | 33.74510, -84.41135 |

---

## Print Production Workflow

### Target Specifications

- **Size**: 24 × 36 inches (landscape)
- **Resolution**: 300 DPI
- **Bleed**: 0.25 inches (included in design margins)
- **Color**: RGB (convert to CMYK for offset printing)
- **Format**: PDF/X-4 for print vendors

### Method 1: Browser Print to PDF (Quick)

1. Open `print.html` in Chrome/Firefox
2. Press `Cmd/Ctrl + P`
3. Select "Save as PDF"
4. Set paper size to "Tabloid" or custom dimensions
5. Enable "Background graphics"
6. Save

**Note**: Browser PDFs are limited to ~150 DPI. Suitable for proofs, not final production.

### Method 2: High-Resolution Screenshot (Recommended)

1. Open `print.html` in Chrome
2. Open DevTools (`F12`)
3. Use Device Toolbar to set custom resolution: **10800 × 7200** pixels
4. Take screenshot: DevTools → ⋮ → "Capture full size screenshot"
5. Import into Photoshop/GIMP at 300 DPI
6. Add bleed area if needed
7. Export as PDF/X-4

### Method 3: Puppeteer Automation (Best Quality)

Install dependencies:

```bash
npm install puppeteer
```

Create `generate-pdf.js`:

```javascript
const puppeteer = require('puppeteer');

(async () => {
    const browser = await puppeteer.launch();
    const page = await browser.newPage();

    // Set viewport to print dimensions at 300 DPI
    // 24x36 inches at 300 DPI = 7200x10800 pixels (we scale down for browser)
    await page.setViewport({
        width: 3600,
        height: 2400,
        deviceScaleFactor: 3 // 3x for ~300 DPI equivalent
    });

    await page.goto('http://localhost:8000/print.html', {
        waitUntil: 'networkidle0',
        timeout: 60000
    });

    // Wait for tiles to load
    await page.waitForTimeout(5000);

    // Screenshot approach (highest quality)
    await page.screenshot({
        path: 'print/atlanta-map-highres.png',
        fullPage: false,
        clip: { x: 0, y: 0, width: 3600, height: 2400 }
    });

    // PDF approach (vector elements preserved)
    await page.pdf({
        path: 'print/atlanta-map.pdf',
        width: '36in',
        height: '24in',
        printBackground: true,
        preferCSSPageSize: true
    });

    await browser.close();
    console.log('Export complete!');
})();
```

Run:

```bash
node generate-pdf.js
```

### Method 4: QGIS (Museum Quality)

For the highest-quality print output with full cartographic control:

1. **Import GeoJSON files** into QGIS
2. **Style layers** according to the design system
3. **Use Print Composer** to create 24×36 layout
4. **Add map elements**: title, legend, scale bar, north arrow
5. **Export as PDF/X-4** at 300 DPI

This method allows:
- Perfect vector output
- CMYK color management
- Full typographic control
- Spot color support

---

## Data Sources

| Data | Source | License |
|------|--------|---------|
| Streets & base map | OpenStreetMap | ODbL |
| Neighborhood boundaries | City of Atlanta / OSM | Public domain / ODbL |
| BeltLine alignment | Derived from Atlanta BeltLine Inc. | Fair use |
| Parks | City of Atlanta Parks | Public domain |
| Landmarks | Hand-curated coordinates | - |

### Obtaining Official Data

For production use, consider obtaining authoritative data:

**City of Atlanta Open Data Portal**
- URL: https://gis.atlantaga.gov/
- Datasets: Neighborhood boundaries, parks, zoning

**Atlanta BeltLine**
- ArcGIS services available
- Contact: info@beltline.org

**OpenStreetMap Extracts**
- Geofabrik: https://download.geofabrik.de/north-america/us/georgia.html
- BBBike: https://extract.bbbike.org/

---

## Customization

### Changing the Home Location

Edit `data/home.geojson`:

```json
{
  "geometry": {
    "type": "Point",
    "coordinates": [-84.3652, 33.7578]  // [longitude, latitude]
  }
}
```

### Adding Landmarks

Edit `data/landmarks.geojson` and add a new feature:

```json
{
  "type": "Feature",
  "properties": {
    "name": "Your Landmark Name",
    "shortName": "Short Name",
    "category": "Category",
    "description": "Description text",
    "address": "Street address"
  },
  "geometry": {
    "type": "Point",
    "coordinates": [-84.XXXX, 33.XXXX]
  }
}
```

### Changing Colors

Edit `js/config.js` under the `colors` section:

```javascript
colors: {
    oldGold: '#B08A00',      // BeltLine & home marker
    haintBlue: '#A4CCE3',    // Parks fill
    landmarkRed: '#C75B5B',  // Landmark markers
    // ...
}
```

---

## Browser Support

- Chrome 90+ (recommended)
- Firefox 88+
- Safari 14+
- Edge 90+

---

## Known Limitations

1. **Tile-based rendering**: Base map tiles are rasterized; true vector output requires QGIS workflow
2. **Font embedding**: Browser PDFs may not embed fonts; use screenshot method for guaranteed typography
3. **CMYK conversion**: All colors are RGB; convert to CMYK in Photoshop/Illustrator for offset printing
4. **Neighborhood boundaries**: Simplified polygons; for legal/official use, obtain City of Atlanta data

---

## Technical Notes

### Coordinate Reference System

All GeoJSON uses **WGS 84 (EPSG:4326)**. Coordinates are `[longitude, latitude]`.

### Bounding Box

```
West:  -84.4220 (Joseph E. Lowery Blvd)
East:  -84.2800 (Your DeKalb Farmers Market area)
North:  33.7970 (Piedmont Park)
South:  33.7220 (Zoo Atlanta / Grant Park)
```

### Scale

At the specified 24×36" print size:
- **1 inch ≈ 0.23 miles** (target scale)
- Actual scale varies with zoom level

---

## License

Map data © OpenStreetMap contributors (ODbL).
Code and design © 2026. For personal/family use.

---

## Acknowledgments

- OpenStreetMap community for base map data
- Atlanta BeltLine Inc. for trail alignment reference
- City of Atlanta for neighborhood and parks data
- The King Center for civil rights landmark information
