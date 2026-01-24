#!/usr/bin/env node

import { Command } from 'commander';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

import { createScraper, ScraperName, SCRAPER_NAMES } from './scrapers/index.js';
import { filterProperties, mergeProperties, findNewMatches, DEFAULT_CRITERIA } from './filters/criteria.js';
import { sendEmailAlert, logNewProperties } from './notify/alerts.js';
import { Property, ScrapeResult } from './types/property.js';

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Paths
const DATA_DIR = join(__dirname, '..', 'data');
const HOMES_JSON = join(DATA_DIR, 'homes.json');
const FRONTEND_HOMES = join(__dirname, '..', '..', 'homes.json');

/**
 * Load existing properties from JSON file
 */
function loadExistingProperties(): Property[] {
  try {
    if (existsSync(HOMES_JSON)) {
      const data = readFileSync(HOMES_JSON, 'utf-8');
      return JSON.parse(data);
    }
  } catch (error) {
    console.warn('Could not load existing properties:', error);
  }
  return [];
}

/**
 * Save properties to JSON files
 */
function saveProperties(properties: Property[]): void {
  const json = JSON.stringify(properties, null, 2);

  // Save to scanner data directory
  writeFileSync(HOMES_JSON, json);
  console.log(`Saved ${properties.length} properties to ${HOMES_JSON}`);

  // Also update frontend homes.json
  try {
    writeFileSync(FRONTEND_HOMES, json);
    console.log(`Updated frontend homes.json`);
  } catch (error) {
    console.warn('Could not update frontend homes.json:', error);
  }
}

/**
 * Run scrapers and process results
 */
async function runScan(options: {
  source: ScraperName;
  notify: boolean;
  dryRun: boolean;
  verbose: boolean;
}): Promise<void> {
  console.log('\n🏠 Broganda Scanner');
  console.log('='.repeat(40));
  console.log(`Source: ${options.source}`);
  console.log(`Notify: ${options.notify}`);
  console.log(`Dry run: ${options.dryRun}`);
  console.log('='.repeat(40) + '\n');

  // Load existing properties
  const existingProperties = loadExistingProperties();
  console.log(`Loaded ${existingProperties.length} existing properties\n`);

  // Create scrapers
  const scrapers = createScraper(options.source);
  const allResults: ScrapeResult[] = [];

  // Run each scraper
  for (const scraper of scrapers) {
    console.log(`\n--- Running ${scraper.sourceName} ---\n`);

    try {
      const result = await scraper.run();
      allResults.push(result);

      if (options.verbose) {
        console.log(`Found ${result.properties.length} properties`);
        for (const p of result.properties) {
          console.log(`  - ${p.title} (${p.bedrooms} BR, ${p.baths} BA)`);
        }
      }
    } catch (error) {
      console.error(`Error running ${scraper.sourceName}:`, error);
      allResults.push({
        source: scraper.sourceName,
        timestamp: new Date().toISOString(),
        totalFound: 0,
        matchingCriteria: 0,
        properties: [],
        errors: [String(error)]
      });
    }

    // Delay between scrapers
    if (scrapers.indexOf(scraper) < scrapers.length - 1) {
      console.log('\nWaiting before next scraper...\n');
      await new Promise(r => setTimeout(r, 5000));
    }
  }

  // Combine all scraped properties
  const allNewProperties = allResults.flatMap(r => r.properties);
  console.log(`\nTotal scraped: ${allNewProperties.length} properties`);

  // Filter and score
  const scoredProperties = filterProperties(allNewProperties, DEFAULT_CRITERIA, true);
  const matchingProperties = scoredProperties.filter(p => p.score >= 50);
  console.log(`Matching criteria: ${matchingProperties.length} properties`);

  // Merge with existing
  const mergedProperties = mergeProperties(existingProperties, scoredProperties);

  // Find truly new matches
  const newMatches = findNewMatches(existingProperties, matchingProperties, DEFAULT_CRITERIA);

  // Log results
  console.log('\n--- Summary ---');
  console.log(`Total properties: ${mergedProperties.length}`);
  console.log(`New matches found: ${newMatches.length}`);

  // Show new matches
  logNewProperties(newMatches);

  // Save if not dry run
  if (!options.dryRun) {
    saveProperties(mergedProperties);
  } else {
    console.log('(Dry run - not saving)');
  }

  // Send notifications
  if (options.notify && newMatches.length > 0) {
    await sendEmailAlert(newMatches);
  }

  // Print errors if any
  const allErrors = allResults.flatMap(r => r.errors);
  if (allErrors.length > 0) {
    console.log('\n⚠️  Errors encountered:');
    for (const error of allErrors) {
      console.log(`  - ${error}`);
    }
  }

  console.log('\n✓ Scan complete!\n');
}

// CLI Setup
const program = new Command();

program
  .name('broganda-scanner')
  .description('Scan Martha\'s Vineyard vacation rental sites for properties matching Broganda criteria')
  .version('1.0.0');

program
  .option('-s, --source <source>', `Source to scrape (${SCRAPER_NAMES.join(', ')}, all)`, 'all')
  .option('-n, --notify', 'Send email notification for new matches', false)
  .option('-d, --dry-run', 'Don\'t save results, just show what would be found', false)
  .option('-v, --verbose', 'Show detailed output', false)
  .action(async (options) => {
    // Validate source
    const validSources = [...SCRAPER_NAMES, 'all'];
    if (!validSources.includes(options.source)) {
      console.error(`Invalid source: ${options.source}`);
      console.error(`Valid sources: ${validSources.join(', ')}`);
      process.exit(1);
    }

    try {
      await runScan({
        source: options.source as ScraperName,
        notify: options.notify,
        dryRun: options.dryRun,
        verbose: options.verbose
      });
    } catch (error) {
      console.error('Fatal error:', error);
      process.exit(1);
    }
  });

program.parse();
