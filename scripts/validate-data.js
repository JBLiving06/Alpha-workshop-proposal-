#!/usr/bin/env node
/**
 * Validate GeoJSON data files
 *
 * Checks:
 * - JSON syntax validity
 * - GeoJSON structure compliance
 * - Required properties presence
 * - Coordinate ranges (Atlanta bounding box)
 */

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');

// Atlanta bounding box (expanded)
const ATLANTA_BOUNDS = {
    minLat: 33.65,
    maxLat: 33.90,
    minLng: -84.55,
    maxLng: -84.20
};

const FILES = [
    { name: 'neighborhoods.geojson', requiredProps: ['name'] },
    { name: 'parks.geojson', requiredProps: ['name'] },
    { name: 'beltline.geojson', requiredProps: ['name'] },
    { name: 'landmarks.geojson', requiredProps: ['name', 'category'] },
    { name: 'home.geojson', requiredProps: ['name', 'address'] }
];

let errors = 0;
let warnings = 0;

function log(type, file, message) {
    const prefix = type === 'error' ? '✗' : type === 'warn' ? '⚠' : '✓';
    const color = type === 'error' ? '\x1b[31m' : type === 'warn' ? '\x1b[33m' : '\x1b[32m';
    console.log(`${color}${prefix}\x1b[0m [${file}] ${message}`);
    if (type === 'error') errors++;
    if (type === 'warn') warnings++;
}

function validateCoordinates(coords, file) {
    if (Array.isArray(coords[0])) {
        // Nested array (polygon or line)
        coords.forEach(c => validateCoordinates(c, file));
    } else if (coords.length >= 2) {
        const [lng, lat] = coords;
        if (lat < ATLANTA_BOUNDS.minLat || lat > ATLANTA_BOUNDS.maxLat ||
            lng < ATLANTA_BOUNDS.minLng || lng > ATLANTA_BOUNDS.maxLng) {
            log('warn', file, `Coordinates [${lng}, ${lat}] outside Atlanta bounds`);
        }
    }
}

function validateFeature(feature, file, requiredProps) {
    if (!feature.type || feature.type !== 'Feature') {
        log('error', file, 'Invalid feature type');
        return;
    }

    if (!feature.geometry) {
        log('error', file, 'Missing geometry');
        return;
    }

    if (!feature.properties) {
        log('error', file, 'Missing properties');
        return;
    }

    // Check required properties
    requiredProps.forEach(prop => {
        if (!feature.properties[prop]) {
            log('warn', file, `Missing property: ${prop}`);
        }
    });

    // Validate coordinates
    if (feature.geometry.coordinates) {
        validateCoordinates(feature.geometry.coordinates, file);
    }
}

function validateGeoJSON(filePath, requiredProps) {
    const fileName = path.basename(filePath);

    // Check file exists
    if (!fs.existsSync(filePath)) {
        log('error', fileName, 'File not found');
        return;
    }

    // Read and parse
    let data;
    try {
        const content = fs.readFileSync(filePath, 'utf8');
        data = JSON.parse(content);
    } catch (e) {
        log('error', fileName, `Invalid JSON: ${e.message}`);
        return;
    }

    // Check GeoJSON structure
    if (!data.type || data.type !== 'FeatureCollection') {
        log('error', fileName, 'Not a valid FeatureCollection');
        return;
    }

    if (!Array.isArray(data.features)) {
        log('error', fileName, 'Missing features array');
        return;
    }

    // Validate each feature
    data.features.forEach((feature, i) => {
        validateFeature(feature, `${fileName}[${i}]`, requiredProps);
    });

    log('ok', fileName, `Valid GeoJSON with ${data.features.length} features`);
}

console.log('\n╔════════════════════════════════════════════════════════╗');
console.log('║   GeoJSON Data Validation                              ║');
console.log('╚════════════════════════════════════════════════════════╝\n');

FILES.forEach(({ name, requiredProps }) => {
    validateGeoJSON(path.join(DATA_DIR, name), requiredProps);
});

console.log('\n────────────────────────────────────────────────────────');
if (errors > 0) {
    console.log(`\x1b[31mValidation failed: ${errors} errors, ${warnings} warnings\x1b[0m`);
    process.exit(1);
} else if (warnings > 0) {
    console.log(`\x1b[33mValidation passed with ${warnings} warnings\x1b[0m`);
} else {
    console.log('\x1b[32mAll data files valid!\x1b[0m');
}
