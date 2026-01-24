/**
 * Atlanta Neighborhoods Map - Main Application
 *
 * Interactive Leaflet map featuring:
 * - Neighborhood boundaries
 * - Parks and greenspace
 * - Atlanta BeltLine alignment
 * - Cultural landmarks
 * - Home marker
 */

(function() {
    'use strict';

    // =========================================================================
    // State Management
    // =========================================================================
    const state = {
        map: null,
        layers: {
            neighborhoods: null,
            parks: null,
            beltline: null,
            landmarks: null,
            home: null,
            neighborhoodLabels: null
        },
        data: {
            neighborhoods: null,
            parks: null,
            beltline: null,
            landmarks: null,
            home: null
        }
    };

    // =========================================================================
    // Utility Functions
    // =========================================================================

    /**
     * Fetch GeoJSON data from a URL
     */
    async function fetchGeoJSON(url) {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Failed to load ${url}: ${response.status}`);
        }
        return response.json();
    }

    /**
     * Create a five-point star SVG for the home marker
     */
    function createStarIcon(color, size) {
        const svg = `
            <svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="${color}" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z"
                      stroke="#704D00" stroke-width="0.5" stroke-linejoin="round"/>
            </svg>
        `;
        return L.divIcon({
            html: svg,
            className: 'home-marker',
            iconSize: [size, size],
            iconAnchor: [size / 2, size / 2],
            popupAnchor: [0, -size / 2]
        });
    }

    /**
     * Create a landmark marker icon
     */
    function createLandmarkIcon() {
        return L.divIcon({
            html: '<div class="landmark-marker-inner"></div>',
            className: 'landmark-marker',
            iconSize: [16, 16],
            iconAnchor: [8, 8],
            popupAnchor: [0, -8]
        });
    }

    /**
     * Get the center of a polygon for label placement
     */
    function getPolygonCenter(layer) {
        if (layer.getBounds) {
            return layer.getBounds().getCenter();
        }
        return null;
    }

    // =========================================================================
    // Map Initialization
    // =========================================================================

    /**
     * Initialize the Leaflet map
     */
    function initMap() {
        const { map: mapConfig } = MapConfig;

        // Create the map
        state.map = L.map('map', {
            center: mapConfig.defaultCenter,
            zoom: mapConfig.defaultZoom,
            minZoom: mapConfig.minZoom,
            maxZoom: mapConfig.maxZoom,
            zoomControl: true,
            attributionControl: true
        });

        // Set max bounds with some padding
        const bounds = [
            [mapConfig.bounds.south - 0.02, mapConfig.bounds.west - 0.02],
            [mapConfig.bounds.north + 0.02, mapConfig.bounds.east + 0.02]
        ];
        state.map.setMaxBounds(bounds);

        // Add tile layer
        addTileLayer();

        // Move zoom control to bottom right
        state.map.zoomControl.setPosition('bottomright');
    }

    /**
     * Add the base tile layer with fallback
     */
    function addTileLayer() {
        const { tiles } = MapConfig;

        // Try Stadia first, fall back to CartoDB, then OSM
        const tileLayer = L.tileLayer(tiles.fallback.url, {
            attribution: tiles.fallback.attribution,
            maxZoom: 19
        });

        tileLayer.addTo(state.map);

        // Handle tile errors
        tileLayer.on('tileerror', function(e) {
            console.warn('Tile error, using fallback');
        });
    }

    // =========================================================================
    // Layer Creation
    // =========================================================================

    /**
     * Create the neighborhoods layer
     */
    function createNeighborhoodsLayer(data) {
        const { styles, popups } = MapConfig;

        state.layers.neighborhoods = L.geoJSON(data, {
            style: styles.neighborhoods,
            onEachFeature: (feature, layer) => {
                // Popup
                layer.bindPopup(popups.neighborhood(feature.properties));

                // Hover effects
                layer.on({
                    mouseover: (e) => {
                        const layer = e.target;
                        layer.setStyle(styles.neighborhoods.hover);
                        layer.bringToFront();

                        // Keep BeltLine and landmarks on top
                        if (state.layers.beltline) state.layers.beltline.bringToFront();
                        if (state.layers.landmarks) state.layers.landmarks.bringToFront();
                        if (state.layers.home) state.layers.home.bringToFront();
                    },
                    mouseout: (e) => {
                        state.layers.neighborhoods.resetStyle(e.target);
                    }
                });
            }
        });

        // Create neighborhood labels
        state.layers.neighborhoodLabels = L.layerGroup();
        data.features.forEach(feature => {
            if (feature.geometry.type === 'Polygon') {
                const coords = feature.geometry.coordinates[0];
                const center = getPolygonCenterFromCoords(coords);

                const label = L.marker(center, {
                    icon: L.divIcon({
                        className: 'neighborhood-label',
                        html: feature.properties.shortName || feature.properties.name,
                        iconSize: [150, 30],
                        iconAnchor: [75, 15]
                    }),
                    interactive: false
                });
                state.layers.neighborhoodLabels.addLayer(label);
            }
        });
    }

    /**
     * Calculate polygon center from coordinates
     */
    function getPolygonCenterFromCoords(coords) {
        let latSum = 0, lngSum = 0;
        coords.forEach(coord => {
            lngSum += coord[0];
            latSum += coord[1];
        });
        return [latSum / coords.length, lngSum / coords.length];
    }

    /**
     * Create the parks layer
     */
    function createParksLayer(data) {
        const { styles, popups } = MapConfig;

        state.layers.parks = L.geoJSON(data, {
            style: styles.parks,
            onEachFeature: (feature, layer) => {
                layer.bindPopup(popups.park(feature.properties));
            }
        });
    }

    /**
     * Create the BeltLine layer
     */
    function createBeltlineLayer(data) {
        const { styles } = MapConfig;

        state.layers.beltline = L.geoJSON(data, {
            style: styles.beltline,
            onEachFeature: (feature, layer) => {
                layer.bindPopup(`
                    <h3>${feature.properties.name}</h3>
                    <span class="popup-category">${feature.properties.status}</span>
                    <p>${feature.properties.description || ''}</p>
                    <p class="popup-address">${feature.properties.length_miles} miles</p>
                `);
            }
        });
    }

    /**
     * Create the landmarks layer
     */
    function createLandmarksLayer(data) {
        const { popups } = MapConfig;

        state.layers.landmarks = L.geoJSON(data, {
            pointToLayer: (feature, latlng) => {
                return L.marker(latlng, {
                    icon: createLandmarkIcon()
                });
            },
            onEachFeature: (feature, layer) => {
                layer.bindPopup(popups.landmark(feature.properties));
            }
        });
    }

    /**
     * Create the home marker
     */
    function createHomeLayer(data) {
        const { styles, popups } = MapConfig;

        state.layers.home = L.geoJSON(data, {
            pointToLayer: (feature, latlng) => {
                return L.marker(latlng, {
                    icon: createStarIcon(styles.home.color, styles.home.size),
                    zIndexOffset: 1000
                });
            },
            onEachFeature: (feature, layer) => {
                layer.bindPopup(popups.home(feature.properties));
            }
        });
    }

    // =========================================================================
    // Layer Management
    // =========================================================================

    /**
     * Add all layers to the map in correct z-order
     */
    function addLayersToMap() {
        // Add in z-order (bottom to top)
        if (state.layers.neighborhoods) {
            state.layers.neighborhoods.addTo(state.map);
        }
        if (state.layers.neighborhoodLabels) {
            state.layers.neighborhoodLabels.addTo(state.map);
        }
        if (state.layers.parks) {
            state.layers.parks.addTo(state.map);
        }
        if (state.layers.beltline) {
            state.layers.beltline.addTo(state.map);
        }
        if (state.layers.landmarks) {
            state.layers.landmarks.addTo(state.map);
        }
        if (state.layers.home) {
            state.layers.home.addTo(state.map);
        }
    }

    /**
     * Toggle a layer on/off
     */
    function toggleLayer(layerName, visible) {
        const layer = state.layers[layerName];
        if (!layer) return;

        if (visible) {
            if (!state.map.hasLayer(layer)) {
                layer.addTo(state.map);
            }
        } else {
            if (state.map.hasLayer(layer)) {
                state.map.removeLayer(layer);
            }
        }

        // Special handling for neighborhood labels
        if (layerName === 'neighborhoods' && state.layers.neighborhoodLabels) {
            if (visible) {
                if (!state.map.hasLayer(state.layers.neighborhoodLabels)) {
                    state.layers.neighborhoodLabels.addTo(state.map);
                }
            } else {
                if (state.map.hasLayer(state.layers.neighborhoodLabels)) {
                    state.map.removeLayer(state.layers.neighborhoodLabels);
                }
            }
        }
    }

    // =========================================================================
    // UI Event Handlers
    // =========================================================================

    /**
     * Set up UI event handlers
     */
    function setupEventHandlers() {
        // Layer toggles
        document.getElementById('layer-neighborhoods').addEventListener('change', (e) => {
            toggleLayer('neighborhoods', e.target.checked);
        });

        document.getElementById('layer-parks').addEventListener('change', (e) => {
            toggleLayer('parks', e.target.checked);
        });

        document.getElementById('layer-beltline').addEventListener('change', (e) => {
            toggleLayer('beltline', e.target.checked);
        });

        document.getElementById('layer-landmarks').addEventListener('change', (e) => {
            toggleLayer('landmarks', e.target.checked);
        });

        // Zoom controls
        document.getElementById('zoom-home').addEventListener('click', () => {
            const { home } = MapConfig.map;
            state.map.setView([home.lat, home.lng], home.zoom);
        });

        document.getElementById('zoom-fit').addEventListener('click', () => {
            const { bounds } = MapConfig.map;
            state.map.fitBounds([
                [bounds.south, bounds.west],
                [bounds.north, bounds.east]
            ], { padding: [20, 20] });
        });

        // Print button
        document.getElementById('btn-print').addEventListener('click', () => {
            window.print();
        });

        // Info panel close
        document.getElementById('close-info').addEventListener('click', () => {
            document.getElementById('info-panel').classList.add('hidden');
        });

        // Update neighborhood label visibility based on zoom
        state.map.on('zoomend', () => {
            const zoom = state.map.getZoom();
            const labels = document.querySelectorAll('.neighborhood-label');
            const neighborhoodCheckbox = document.getElementById('layer-neighborhoods');

            labels.forEach(label => {
                if (zoom < 12 || !neighborhoodCheckbox.checked) {
                    label.style.display = 'none';
                } else if (zoom < 13) {
                    label.style.display = 'block';
                    label.style.fontSize = '12px';
                } else if (zoom < 14) {
                    label.style.display = 'block';
                    label.style.fontSize = '14px';
                } else {
                    label.style.display = 'block';
                    label.style.fontSize = '18px';
                }
            });
        });

        // URL state management
        setupURLState();
    }

    /**
     * Set up URL state management for shareable views
     */
    function setupURLState() {
        // Read initial state from URL
        const params = new URLSearchParams(window.location.search);
        if (params.has('lat') && params.has('lng') && params.has('z')) {
            const lat = parseFloat(params.get('lat'));
            const lng = parseFloat(params.get('lng'));
            const zoom = parseInt(params.get('z'));
            if (!isNaN(lat) && !isNaN(lng) && !isNaN(zoom)) {
                state.map.setView([lat, lng], zoom);
            }
        }

        // Update URL on map move (debounced)
        let urlUpdateTimeout;
        state.map.on('moveend', () => {
            clearTimeout(urlUpdateTimeout);
            urlUpdateTimeout = setTimeout(() => {
                const center = state.map.getCenter();
                const zoom = state.map.getZoom();
                const url = new URL(window.location);
                url.searchParams.set('lat', center.lat.toFixed(5));
                url.searchParams.set('lng', center.lng.toFixed(5));
                url.searchParams.set('z', zoom);
                window.history.replaceState({}, '', url);
            }, 500);
        });
    }

    // =========================================================================
    // Data Loading
    // =========================================================================

    /**
     * Load all GeoJSON data files
     */
    async function loadData() {
        const { data: paths } = MapConfig;

        try {
            // Load all data in parallel
            const [neighborhoods, parks, beltline, landmarks, home] = await Promise.all([
                fetchGeoJSON(paths.neighborhoods),
                fetchGeoJSON(paths.parks),
                fetchGeoJSON(paths.beltline),
                fetchGeoJSON(paths.landmarks),
                fetchGeoJSON(paths.home)
            ]);

            // Store data
            state.data = { neighborhoods, parks, beltline, landmarks, home };

            // Create layers
            createNeighborhoodsLayer(neighborhoods);
            createParksLayer(parks);
            createBeltlineLayer(beltline);
            createLandmarksLayer(landmarks);
            createHomeLayer(home);

            // Add layers to map
            addLayersToMap();

            return true;
        } catch (error) {
            console.error('Error loading data:', error);
            throw error;
        }
    }

    // =========================================================================
    // Application Initialization
    // =========================================================================

    /**
     * Hide loading overlay
     */
    function hideLoading() {
        const loading = document.getElementById('loading');
        loading.classList.add('hidden');
        setTimeout(() => {
            loading.style.display = 'none';
        }, 300);
    }

    /**
     * Show error message
     */
    function showError(message) {
        const loading = document.getElementById('loading');
        loading.innerHTML = `
            <div style="text-align: center; color: #c00;">
                <p style="font-size: 18px; margin-bottom: 8px;">Error Loading Map</p>
                <p style="font-size: 14px;">${message}</p>
                <button onclick="location.reload()" class="btn btn-primary" style="margin-top: 16px;">Retry</button>
            </div>
        `;
    }

    /**
     * Main initialization function
     */
    async function init() {
        try {
            // Initialize the map
            initMap();

            // Load all data
            await loadData();

            // Set up event handlers
            setupEventHandlers();

            // Hide loading overlay
            hideLoading();

            // Trigger initial zoom event for labels
            state.map.fire('zoomend');

            console.log('Atlanta Neighborhoods Map initialized successfully');
        } catch (error) {
            console.error('Failed to initialize map:', error);
            showError(error.message);
        }
    }

    // Start the application when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
