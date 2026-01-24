/**
 * Atlanta Neighborhoods Map - Configuration
 *
 * This file contains all configuration settings for the map including:
 * - Map bounds and center
 * - Tile providers
 * - Design system colors
 * - Layer styles
 */

const MapConfig = {
    // Map Settings
    map: {
        // Home location: 640 Irwin St NE
        home: {
            lat: 33.7578,
            lng: -84.3652,
            zoom: 15
        },

        // Bounding box (WGS 84)
        // West: Joseph E. Lowery Blvd (includes Morehouse & Spelman)
        // North: Piedmont Park tree line
        // South: Zoo Atlanta (Grant Park & Summerhill)
        // East: East Lake Golf Club / YDFM area
        bounds: {
            south: 33.7220,
            west: -84.4220,
            north: 33.7970,
            east: -84.2800
        },

        // Initial view
        defaultCenter: [33.7578, -84.3652],
        defaultZoom: 13,
        minZoom: 11,
        maxZoom: 18
    },

    // Tile Providers
    // Using Stadia Maps (free tier) with OpenStreetMap data
    // Alternative: CartoDB Positron, or self-hosted tiles
    tiles: {
        // Primary: Stadia Alidade Smooth (clean, minimal)
        primary: {
            url: 'https://tiles.stadiamaps.com/tiles/alidade_smooth/{z}/{x}/{y}{r}.png',
            attribution: '&copy; <a href="https://stadiamaps.com/">Stadia Maps</a>, &copy; <a href="https://openmaptiles.org/">OpenMapTiles</a> &copy; <a href="http://openstreetmap.org">OpenStreetMap</a> contributors'
        },

        // Fallback: CartoDB Positron (very clean, minimal)
        fallback: {
            url: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
        },

        // Backup: OpenStreetMap standard
        osm: {
            url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        }
    },

    // Design System Colors
    colors: {
        background: 'rgb(245, 245, 245)',
        oldGold: '#B08A00',
        haintBlue: '#A4CCE3',
        streetGrey: '#666666',
        landmarkRed: '#C75B5B',
        textPrimary: '#333333',
        textSecondary: '#555555',
        white: '#ffffff'
    },

    // Layer Styles
    styles: {
        neighborhoods: {
            color: '#666666',
            weight: 1.5,
            opacity: 0.6,
            fillColor: '#888888',
            fillOpacity: 0.08,
            // Hover state
            hover: {
                fillOpacity: 0.18,
                weight: 2
            }
        },

        parks: {
            color: '#888888',
            weight: 0.5,
            opacity: 0.6,
            fillColor: '#A4CCE3', // Haint blue
            fillOpacity: 0.4
        },

        beltline: {
            color: '#B08A00', // Old gold
            weight: 4,
            opacity: 1,
            lineCap: 'round',
            lineJoin: 'round'
        },

        home: {
            color: '#B08A00', // Old gold
            size: 32
        },

        landmarks: {
            color: '#C75B5B',
            radius: 6,
            weight: 2,
            opacity: 1,
            fillColor: '#C75B5B',
            fillOpacity: 1
        }
    },

    // Data file paths
    data: {
        neighborhoods: 'data/neighborhoods.geojson',
        parks: 'data/parks.geojson',
        beltline: 'data/beltline.geojson',
        landmarks: 'data/landmarks.geojson',
        home: 'data/home.geojson'
    },

    // Popup templates
    popups: {
        landmark: (props) => `
            <h3>${props.name}</h3>
            ${props.category ? `<span class="popup-category">${props.category}</span>` : ''}
            <p>${props.description || ''}</p>
            ${props.address ? `<p class="popup-address">${props.address}</p>` : ''}
        `,

        neighborhood: (props) => `
            <h3>${props.name}</h3>
            <p>${props.character || ''}</p>
        `,

        park: (props) => `
            <h3>${props.name}</h3>
            ${props.type ? `<span class="popup-category">${props.type}</span>` : ''}
            <p>${props.description || ''}</p>
            ${props.acres ? `<p class="popup-address">${props.acres} acres</p>` : ''}
        `,

        home: (props) => `
            <h3>Home</h3>
            <p>${props.address}</p>
            <p class="popup-address">Neighborhood: ${props.neighborhood}</p>
        `
    }
};

// Export for use in map.js
if (typeof module !== 'undefined' && module.exports) {
    module.exports = MapConfig;
}
