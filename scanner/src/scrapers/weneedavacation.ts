import { Page } from 'playwright';
import { BaseScraper } from './base-scraper.js';
import { RawListing } from '../types/property.js';

/**
 * Scraper for WeNeedAVacation.com
 * Cape Cod, Martha's Vineyard & Nantucket vacation rentals since 1997
 */
export class WeNeedAVacationScraper extends BaseScraper {
  readonly sourceName = 'WeNeedAVacation';
  readonly baseUrl = 'https://www.weneedavacation.com';

  // Oak Bluffs search URL - filtered for 4+ bedrooms
  private readonly searchUrl = 'https://www.weneedavacation.com/Marthas-Vineyard/Oak-Bluffs-Vacation-Rentals/?bedrooms=4';

  async scrape(): Promise<RawListing[]> {
    const listings: RawListing[] = [];
    const page = await this.newPage();

    try {
      // Navigate to search results
      const success = await this.navigateWithRetry(page, this.searchUrl);
      if (!success) {
        console.error(`[${this.sourceName}] Failed to load search page`);
        return listings;
      }

      // Wait for listings to load
      await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});

      // Get all property cards
      const propertyCards = await page.$$('.property-card, .listing-card, [data-property-id], .rental-listing');

      if (propertyCards.length === 0) {
        // Try alternative selectors
        console.log(`[${this.sourceName}] No cards found with primary selectors, trying alternatives...`);

        // Look for any links that might be property listings
        const links = await page.$$('a[href*="/Marthas-Vineyard/"][href*="Rental"]');
        console.log(`[${this.sourceName}] Found ${links.length} potential listing links`);

        for (const link of links) {
          try {
            const href = await link.getAttribute('href');
            const text = await link.textContent();

            if (href && text && !href.includes('Vacation-Rentals')) {
              const fullUrl = href.startsWith('http') ? href : `${this.baseUrl}${href}`;

              listings.push({
                title: text.trim(),
                url: fullUrl,
                location: 'Oak Bluffs'
              });
            }
          } catch {
            continue;
          }
        }
      } else {
        console.log(`[${this.sourceName}] Found ${propertyCards.length} property cards`);

        for (const card of propertyCards) {
          try {
            const listing = await this.extractFromCard(card);
            if (listing) {
              listings.push(listing);
            }
          } catch (error) {
            console.warn(`[${this.sourceName}] Error extracting card:`, error);
          }
        }
      }

      // If we have listings, try to get details for each
      if (listings.length > 0 && listings.length <= 30) {
        console.log(`[${this.sourceName}] Fetching details for ${listings.length} listings...`);

        for (let i = 0; i < listings.length; i++) {
          await this.delay();
          try {
            const details = await this.fetchListingDetails(page, listings[i].url);
            listings[i] = { ...listings[i], ...details };
          } catch (error) {
            console.warn(`[${this.sourceName}] Error fetching details for ${listings[i].url}:`, error);
          }
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
      // Try various selectors for property card elements
      const titleEl = await card.$('h2, h3, .property-title, .listing-title, a[href*="Rental"]');
      const title = titleEl ? await titleEl.textContent() : null;

      const linkEl = await card.$('a[href*="Rental"], a[href*="property"]');
      const href = linkEl ? await linkEl.getAttribute('href') : null;

      if (!title || !href) {
        return null;
      }

      const url = href.startsWith('http') ? href : `${this.baseUrl}${href}`;

      // Try to extract basic info from card
      const cardText = await card.textContent() || '';

      const bedrooms = this.parseBedrooms(cardText);
      const baths = this.parseBaths(cardText);
      const sleeps = this.parseSleeps(cardText);

      // Look for price
      const priceMatch = cardText.match(/\$[\d,]+/);
      const price = priceMatch ? priceMatch[0] : undefined;

      // Look for image
      const imgEl = await card.$('img');
      const imageUrl = imgEl ? await imgEl.getAttribute('src') : undefined;

      return {
        title: title.trim(),
        url,
        bedrooms,
        baths,
        sleeps,
        price,
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

      // Get description
      const descEl = await page.$('.property-description, .description, [itemprop="description"]');
      if (descEl) {
        details.description = (await descEl.textContent())?.trim().slice(0, 500);
      }

      // Get features/amenities
      const featureEls = await page.$$('.amenity, .feature, .amenities li, .features li');
      if (featureEls.length > 0) {
        details.features = [];
        for (const el of featureEls.slice(0, 10)) {
          const text = await el.textContent();
          if (text) {
            details.features.push(text.trim());
          }
        }
      }

      // Get bedroom/bath counts from detail page if not already set
      const pageText = await page.textContent('body') || '';
      if (!details.bedrooms) {
        details.bedrooms = this.parseBedrooms(pageText);
      }
      if (!details.baths) {
        details.baths = this.parseBaths(pageText);
      }
      if (!details.sleeps) {
        details.sleeps = this.parseSleeps(pageText);
      }

      // Get main image
      const mainImg = await page.$('.property-image img, .main-image img, .gallery img');
      if (mainImg) {
        details.imageUrl = await mainImg.getAttribute('src') || undefined;
      }

      // Check availability text
      const availText = await page.textContent('.availability, .calendar-info, [class*="avail"]');
      if (availText) {
        details.availability = availText;
      }

    } catch (error) {
      console.warn(`[${this.sourceName}] Error fetching details from ${url}`);
    }

    return details;
  }
}
