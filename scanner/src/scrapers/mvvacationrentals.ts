import { Page } from 'playwright';
import { BaseScraper } from './base-scraper.js';
import { RawListing } from '../types/property.js';

/**
 * Scraper for MVVacationRentals.com
 * Local Martha's Vineyard vacation rental agency
 */
export class MVVacationRentalsScraper extends BaseScraper {
  readonly sourceName = 'MV Vacation Rentals';
  readonly baseUrl = 'https://www.mvvacationrentals.com';

  private readonly searchUrl = 'https://www.mvvacationrentals.com/oak-bluffs-vacation-rentals';

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

      // Try multiple selector strategies
      const selectors = [
        '.property-listing',
        '.rental-card',
        '.listing-item',
        '[class*="property"]',
        'article',
        '.card'
      ];

      let propertyCards: any[] = [];

      for (const selector of selectors) {
        propertyCards = await page.$$(selector);
        if (propertyCards.length > 0) {
          console.log(`[${this.sourceName}] Found ${propertyCards.length} cards with selector: ${selector}`);
          break;
        }
      }

      if (propertyCards.length === 0) {
        // Fallback: find all links to property pages
        console.log(`[${this.sourceName}] Using fallback link extraction...`);

        const pageContent = await page.content();

        // Look for property links in the page
        const links = await page.$$('a[href*="rental"], a[href*="property"], a[href*="listing"]');

        for (const link of links) {
          try {
            const href = await link.getAttribute('href');
            const text = await link.textContent();

            if (href && text && text.length > 10) {
              const fullUrl = href.startsWith('http') ? href : `${this.baseUrl}${href}`;

              // Avoid duplicates
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
          } catch (error) {
            console.warn(`[${this.sourceName}] Error extracting card`);
          }
        }
      }

      // Fetch details for each listing (limit to first 20)
      const toFetch = listings.slice(0, 20);
      console.log(`[${this.sourceName}] Fetching details for ${toFetch.length} listings...`);

      for (let i = 0; i < toFetch.length; i++) {
        await this.delay();
        try {
          const details = await this.fetchListingDetails(page, toFetch[i].url);
          listings[i] = { ...listings[i], ...details };
        } catch {
          // Continue on error
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
      const titleEl = await card.$('h2, h3, h4, .title, [class*="title"]');
      const title = titleEl ? await titleEl.textContent() : null;

      const linkEl = await card.$('a');
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

      // Extract property details
      details.bedrooms = this.parseBedrooms(pageText);
      details.baths = this.parseBaths(pageText);
      details.sleeps = this.parseSleeps(pageText);

      // Get price
      const priceMatch = pageText.match(/\$[\d,]+\s*(\/\s*week|per\s*week|weekly)?/i);
      if (priceMatch) {
        details.price = priceMatch[0];
      }

      // Get description
      const descEl = await page.$('.description, .property-description, [class*="description"], p');
      if (descEl) {
        const desc = await descEl.textContent();
        details.description = desc?.trim().slice(0, 500);
      }

      // Get features
      const featureEls = await page.$$('.amenity, .feature, li');
      const features: string[] = [];
      for (const el of featureEls.slice(0, 15)) {
        const text = await el.textContent();
        if (text && text.length < 50 && text.length > 2) {
          const trimmed = text.trim();
          if (trimmed.match(/^[A-Z]/)) { // Likely a feature name
            features.push(trimmed);
          }
        }
      }
      if (features.length > 0) {
        details.features = features.slice(0, 10);
      }

      // Get image
      const imgEl = await page.$('.property-image img, .gallery img, img[src*="property"], img[src*="rental"]');
      if (imgEl) {
        details.imageUrl = await imgEl.getAttribute('src') || undefined;
      }

    } catch {
      // Ignore errors
    }

    return details;
  }
}
