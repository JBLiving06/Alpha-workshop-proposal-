#!/usr/bin/env node
/**
 * Atlanta Neighborhoods Map - Print PDF Generator
 *
 * Generates high-resolution PNG and PDF exports from the print.html page.
 *
 * Requirements:
 *   npm install puppeteer
 *
 * Usage:
 *   1. Start a local server: python -m http.server 8000
 *   2. Run: node scripts/generate-print.js
 *
 * Output:
 *   - print/atlanta-neighborhoods-highres.png (10800x7200 @ 300dpi equivalent)
 *   - print/atlanta-neighborhoods.pdf (24x36 inches)
 */

const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

// Configuration
const CONFIG = {
    // Server URL (must be running)
    serverUrl: 'http://localhost:8000/print.html',

    // Output directory
    outputDir: path.join(__dirname, '..', 'print'),

    // Print dimensions
    print: {
        width: 36,      // inches
        height: 24,     // inches
        dpi: 300
    },

    // Viewport settings (we render at 1/3 scale with 3x device pixel ratio)
    viewport: {
        width: 3600,    // pixels (36" * 100)
        height: 2400,   // pixels (24" * 100)
        deviceScaleFactor: 3  // Multiplier for high-res
    },

    // Wait times
    wait: {
        tiles: 8000,        // Wait for map tiles to load
        fonts: 2000,        // Wait for fonts to load
        afterLoad: 3000     // Additional wait after networkidle
    }
};

async function generatePrint() {
    console.log('╔════════════════════════════════════════════════════════╗');
    console.log('║   Atlanta Neighborhoods Map - Print Generator          ║');
    console.log('╚════════════════════════════════════════════════════════╝\n');

    // Ensure output directory exists
    if (!fs.existsSync(CONFIG.outputDir)) {
        fs.mkdirSync(CONFIG.outputDir, { recursive: true });
        console.log(`✓ Created output directory: ${CONFIG.outputDir}\n`);
    }

    console.log('Launching browser...');
    const browser = await puppeteer.launch({
        headless: 'new',
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-web-security',
            '--font-render-hinting=none'
        ]
    });

    try {
        const page = await browser.newPage();

        // Set viewport to print dimensions
        console.log(`Setting viewport: ${CONFIG.viewport.width}x${CONFIG.viewport.height} @${CONFIG.viewport.deviceScaleFactor}x`);
        await page.setViewport(CONFIG.viewport);

        // Navigate to print page
        console.log(`Loading: ${CONFIG.serverUrl}`);
        await page.goto(CONFIG.serverUrl, {
            waitUntil: 'networkidle0',
            timeout: 60000
        });

        // Wait for fonts to load
        console.log('Waiting for fonts to load...');
        await page.evaluate(() => document.fonts.ready);
        await sleep(CONFIG.wait.fonts);

        // Wait for map tiles to fully load
        console.log('Waiting for map tiles to load...');
        await sleep(CONFIG.wait.tiles);

        // Additional stability wait
        await sleep(CONFIG.wait.afterLoad);

        // Hide UI elements for clean export
        await page.evaluate(() => {
            const status = document.getElementById('status');
            const instructions = document.getElementById('instructions');
            if (status) status.style.display = 'none';
            if (instructions) instructions.style.display = 'none';
        });

        // Generate high-resolution PNG
        const pngPath = path.join(CONFIG.outputDir, 'atlanta-neighborhoods-highres.png');
        console.log(`\nGenerating PNG: ${pngPath}`);
        await page.screenshot({
            path: pngPath,
            fullPage: false,
            clip: {
                x: 0,
                y: 0,
                width: CONFIG.viewport.width,
                height: CONFIG.viewport.height
            },
            omitBackground: false
        });

        const pngStats = fs.statSync(pngPath);
        console.log(`✓ PNG saved (${formatBytes(pngStats.size)})`);
        console.log(`  Dimensions: ${CONFIG.viewport.width * CONFIG.viewport.deviceScaleFactor}x${CONFIG.viewport.height * CONFIG.viewport.deviceScaleFactor} pixels`);
        console.log(`  Effective DPI: ~${CONFIG.viewport.deviceScaleFactor * 100} DPI at print size`);

        // Generate PDF
        const pdfPath = path.join(CONFIG.outputDir, 'atlanta-neighborhoods.pdf');
        console.log(`\nGenerating PDF: ${pdfPath}`);
        await page.pdf({
            path: pdfPath,
            width: `${CONFIG.print.width}in`,
            height: `${CONFIG.print.height}in`,
            printBackground: true,
            preferCSSPageSize: false,
            margin: { top: 0, right: 0, bottom: 0, left: 0 }
        });

        const pdfStats = fs.statSync(pdfPath);
        console.log(`✓ PDF saved (${formatBytes(pdfStats.size)})`);
        console.log(`  Page size: ${CONFIG.print.width}x${CONFIG.print.height} inches (landscape)`);

        // Generate preview JPEG
        const jpgPath = path.join(CONFIG.outputDir, 'atlanta-neighborhoods-preview.jpg');
        console.log(`\nGenerating preview JPEG: ${jpgPath}`);

        // Create a new page at lower resolution for preview
        const previewPage = await browser.newPage();
        await previewPage.setViewport({
            width: 1800,
            height: 1200,
            deviceScaleFactor: 1
        });
        await previewPage.goto(CONFIG.serverUrl, {
            waitUntil: 'networkidle0',
            timeout: 60000
        });
        await sleep(CONFIG.wait.tiles);

        await previewPage.evaluate(() => {
            const status = document.getElementById('status');
            const instructions = document.getElementById('instructions');
            if (status) status.style.display = 'none';
            if (instructions) instructions.style.display = 'none';
        });

        await previewPage.screenshot({
            path: jpgPath,
            type: 'jpeg',
            quality: 85,
            fullPage: false,
            clip: { x: 0, y: 0, width: 1800, height: 1200 }
        });

        const jpgStats = fs.statSync(jpgPath);
        console.log(`✓ Preview JPEG saved (${formatBytes(jpgStats.size)})`);

        console.log('\n╔════════════════════════════════════════════════════════╗');
        console.log('║   Export Complete!                                     ║');
        console.log('╚════════════════════════════════════════════════════════╝');
        console.log(`\nFiles saved to: ${CONFIG.outputDir}`);
        console.log('\nNext steps:');
        console.log('  1. Open PNG in Photoshop/GIMP');
        console.log('  2. Set document resolution to 300 DPI');
        console.log('  3. Convert to CMYK if needed for offset printing');
        console.log('  4. Add 0.25" bleed if required by print vendor');
        console.log('  5. Export as PDF/X-4 for print production');

    } catch (error) {
        console.error('\n✗ Error:', error.message);
        process.exit(1);
    } finally {
        await browser.close();
    }
}

// Utility: Sleep function
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Utility: Format bytes
function formatBytes(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

// Run
generatePrint().catch(console.error);
