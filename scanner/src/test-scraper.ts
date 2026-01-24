#!/usr/bin/env node

/**
 * Test script to verify scraper functionality
 * Run with: npm run test
 */

import { chromium } from 'playwright';

async function testBrowserLaunch(): Promise<boolean> {
  console.log('Testing browser launch...');
  try {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    await page.goto('https://example.com');
    const title = await page.title();
    await browser.close();

    if (title.includes('Example')) {
      console.log('✓ Browser launch: PASSED');
      return true;
    } else {
      console.log('✗ Browser launch: FAILED (unexpected title)');
      return false;
    }
  } catch (error) {
    console.log('✗ Browser launch: FAILED');
    console.error(error);
    return false;
  }
}

async function testSiteAccess(name: string, url: string): Promise<boolean> {
  console.log(`Testing ${name} access...`);
  try {
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    });
    const page = await context.newPage();

    const response = await page.goto(url, {
      waitUntil: 'domcontentloaded',
      timeout: 30000
    });

    const status = response?.status() || 0;
    await browser.close();

    if (status === 200) {
      console.log(`✓ ${name}: PASSED (status ${status})`);
      return true;
    } else if (status === 403) {
      console.log(`⚠ ${name}: BLOCKED (status ${status}) - May need additional stealth measures`);
      return false;
    } else {
      console.log(`✗ ${name}: FAILED (status ${status})`);
      return false;
    }
  } catch (error) {
    console.log(`✗ ${name}: FAILED`);
    console.error(`  Error: ${error instanceof Error ? error.message : error}`);
    return false;
  }
}

async function main() {
  console.log('\n🧪 Broganda Scanner Test Suite\n');
  console.log('='.repeat(50) + '\n');

  const results: boolean[] = [];

  // Test 1: Browser launch
  results.push(await testBrowserLaunch());

  console.log('');

  // Test 2: Site access tests
  const sites = [
    { name: 'WeNeedAVacation', url: 'https://www.weneedavacation.com/Marthas-Vineyard/Oak-Bluffs-Vacation-Rentals/' },
    { name: 'MV Vacation Rentals', url: 'https://www.mvvacationrentals.com/oak-bluffs-vacation-rentals' },
    { name: 'MV Rentals', url: 'https://www.marthasvineyardrentals.org/rentals/oak-bluffs' }
  ];

  for (const site of sites) {
    results.push(await testSiteAccess(site.name, site.url));
    // Small delay between tests
    await new Promise(r => setTimeout(r, 2000));
  }

  console.log('\n' + '='.repeat(50));
  const passed = results.filter(r => r).length;
  const total = results.length;
  console.log(`\nResults: ${passed}/${total} tests passed\n`);

  if (passed < total) {
    console.log('Note: Some sites may block automated access.');
    console.log('The scraper includes retry logic and stealth measures');
    console.log('that may help with actual scraping runs.\n');
  }

  process.exit(passed === total ? 0 : 1);
}

main().catch(console.error);
