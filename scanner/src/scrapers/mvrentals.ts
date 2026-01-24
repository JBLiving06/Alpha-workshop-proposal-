import { Page } from 'playwright';
import { BaseScraper } from './base-scraper.js';
import { RawListing } from '../types/property.js';

/**
 * Scraper for MarthasVineyardRentals.org
 * Local MV rental agency with 151+ Oak Bluffs listings
 */
export class MVRentalsScraper extends BaseScraper {
  readonly sourceName = 'MV Rentals';
  readonly baseUrl = 'https://www.marthasvineyardrentals.org';

  private readonly searchUrl = 'https://www.marthasvineyardrentals.org/rentals/oak-bluffs';

  async scrape(): Promise<RawListing[]> {
    const listings: RawListing[] = [];
    const page = await this.newPage();

    try {
      const success = await this.navigateWithRetry(page, this.searchUrl);
      if (!success) {
        console.error(`[${this.sourceName}] Failed to load search page`);
        return listings;
      }

      await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});

      // This site may use specific selectors
      const selectors = [
        '.rental-item',
        '.property-card',
        '.listing',
        '[class*="rental"]',
        '.search-result',
        'article'
      ];

      let propertyCards: any[] = [];

      for (const selector of selectors) {
        propertyCards = await page.$$(selector);
        if (propertyCards.length > 0) {
          console.log(`[${this.sourceName}] Found ${propertyCards.length} cards with: ${selector}`);
          break;
        }
      }

      if (propertyCards.length === 0) {
        // Look for rental links
        console.log(`[${this.sourceName}] Fallback: extracting rental links...`);

        const links = await page.$$('a[href*="rental."], a[href*="/rentals/"]');

        for (const link of links) {
          try {
            const href = await link.getAttribute('href');
            let text = await link.textContent();

            // Skip navigation links
            if (!href || href === this.searchUrl || href.endsWith('/rentals/oak-bluffs')) {
              continue;
            }

            // Try to get parent element text for more context
            if (!text || text.length < 5) {
              const parent = await link.$('xpath=..');
              if (parent) {
                text = await parent.textContent();
              }
            }

            if (href && text && text.length > 3) {
              const fullUrl = href.startsWith('http') ? href : `${this.baseUrl}${href}`;

              if (!listings.some(l => l.url === fullUrl)) {
                listings.push({
                  title: text.trim().slice(0, 100),
                  url: fullUrl,
                  location: 'Oak Bluffs'
                });
              }
            }
          } catch {
            continue;
          }
        }
      } else {
        for (const card of propertyCards) {
          try {
            const listing = await this.extractFromCard(card);
            if (listing) {
              listings.push(listing);
            }
          } catch {
            // Continue
          }
        }
      }

      // Fetch details (limit to 20)
      const toFetch = listings.slice(0, 20);
      console.log(`[${this.sourceName}] Fetching details for ${toFetch.length} listings...`);

      for (let i = 0; i < toFetch.length; i++) {
        await this.delay();
        try {
          const details = await this.fetchListingDetails(page, toFetch[i].url);
          listings[i] = { ...listings[i], ...details };
        } catch {
          // Continue
        }
      }

    } catch (error) {
      console.error(`[${this.sourceName}] Scraping error:`, error);
    } finally {
      await page.close();
    }

    return listings;
  }

  private async extractFromCard(card: any): Promise<RawListing | null> {
    try {
      const titleEl = await card.$('h2, h3, h4, .title, a');
      const title = titleEl ? await titleEl.textContent() : null;

      const linkEl = await card.$('a[href*="rental"]');
      const href = linkEl ? await linkEl.getAttribute('href') : null;

      if (!title || !href) {
        return null;
      }

      const url = href.startsWith('http') ? href : `${this.baseUrl}${href}`;
      const cardText = await card.textContent() || '';

      const imgEl = await card.$('img');
      const imageUrl = imgEl ? await imgEl.getAttribute('src') : undefined;

      return {
        title: title.trim(),
        url,
        bedrooms: this.parseBedrooms(cardText),
        baths: this.parseBaths(cardText),
        sleeps: this.parseSleeps(cardText),
        price: cardText.match(/\$[\d,]+/)?.[0],
        location: 'Oak Bluffs',
        imageUrl: imageUrl || undefined
      };
    } catch {
      return null;
    }
  }

  private async fetchListingDetails(page: Page, url: string): Promise<Partial<RawListing>> {
    const details: Partial<RawListing> = {};

    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 });
      await this.delay(1000);

      const pageText = await page.textContent('body') || '';

      // Extract property info
      details.bedrooms = this.parseBedrooms(pageText);
      details.baths = this.parseBaths(pageText);
      details.sleeps = this.parseSleeps(pageText);

      // Price
      const priceMatch = pageText.match(/\$[\d,]+\s*(\/\s*week|per\s*week|weekly|\/wk)?/i);
      if (priceMatch) {
        details.price = priceMatch[0];
      }

      // Description - look for common description containers
      const descSelectors = [
        '.property-description',
        '.description',
        '#description',
        '[itemprop="description"]',
        '.rental-description'
      ];

      for (const sel of descSelectors) {
        const descEl = await page.$(sel);
        if (descEl) {
          const desc = await descEl.textContent();
          if (desc && desc.length > 20) {
            details.description = desc.trim().slice(0, 500);
            break;
          }
        }
      }

      // Features/amenities
      const featureEls = await page.$$('.amenity, .feature, .amenities li, ul li');
      const features: string[] = [];

      for (const el of featureEls) {
        const text = await el.textContent();
        if (text) {
          const trimmed = text.trim();
          // Filter to likely amenity items
          if (trimmed.length > 2 && trimmed.length < 40 && !trimmed.includes('\n')) {
            features.push(trimmed);
          }
        }
        if (features.length >= 10) break;
      }

      if (features.length > 0) {
        details.features = features;
      }

      // Main image
      const imgEl = await page.$('.property-image img, .main-image img, .gallery img, img[alt*="property"]');
      if (imgEl) {
        const src = await imgEl.getAttribute('src');
        if (src) {
          details.imageUrl = src.startsWith('http') ? src : `${this.baseUrl}${src}`;
        }
      }

      // Location/area hints
      const locationMatch = pageText.match(/(Ocean Park|East Chop|West Chop|Highlands|Harbor|Downtown|Circuit Ave)/i);
      if (locationMatch) {
        details.location = locationMatch[1];
      }

    } catch {
      // Ignore errors
    }

    return details;
  }
}
