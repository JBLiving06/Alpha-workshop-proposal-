import { chromium, Browser, Page, BrowserContext } from 'playwright';
import { RawListing, Property, ScraperConfig, ScrapeResult } from '../types/property.js';

/**
 * Base class for all property scrapers
 * Handles browser management, rate limiting, and common utilities
 */
export abstract class BaseScraper {
  protected browser: Browser | null = null;
  protected context: BrowserContext | null = null;
  protected config: ScraperConfig;

  abstract readonly sourceName: string;
  abstract readonly baseUrl: string;

  constructor(config?: Partial<ScraperConfig>) {
    this.config = {
      headless: process.env.HEADLESS !== 'false',
      slowMo: parseInt(process.env.SLOW_MO || '100'),
      requestDelayMs: parseInt(process.env.REQUEST_DELAY_MS || '2000'),
      timeout: 30000,
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      ...config
    };
  }

  /**
   * Initialize the browser
   */
  async init(): Promise<void> {
    console.log(`[${this.sourceName}] Initializing browser...`);

    this.browser = await chromium.launch({
      headless: this.config.headless,
      slowMo: this.config.slowMo
    });

    this.context = await this.browser.newContext({
      userAgent: this.config.userAgent,
      viewport: { width: 1280, height: 800 },
      locale: 'en-US',
      timezoneId: 'America/New_York'
    });

    // Add stealth modifications
    await this.context.addInitScript(() => {
      // Override webdriver detection
      Object.defineProperty(navigator, 'webdriver', { get: () => false });

      // Add Chrome runtime
      (window as any).chrome = { runtime: {} };

      // Override permissions
      const originalQuery = window.navigator.permissions.query;
      window.navigator.permissions.query = (parameters: any) => {
        if (parameters.name === 'notifications') {
          return Promise.resolve({ state: 'denied' } as PermissionStatus);
        }
        return originalQuery(parameters);
      };
    });
  }

  /**
   * Clean up browser resources
   */
  async close(): Promise<void> {
    if (this.context) {
      await this.context.close();
    }
    if (this.browser) {
      await this.browser.close();
    }
    console.log(`[${this.sourceName}] Browser closed.`);
  }

  /**
   * Create a new page with standard settings
   */
  protected async newPage(): Promise<Page> {
    if (!this.context) {
      throw new Error('Browser not initialized. Call init() first.');
    }

    const page = await this.context.newPage();
    page.setDefaultTimeout(this.config.timeout);

    // Block unnecessary resources for faster loading
    await page.route('**/*', (route) => {
      const resourceType = route.request().resourceType();
      if (['media', 'font'].includes(resourceType)) {
        route.abort();
      } else {
        route.continue();
      }
    });

    return page;
  }

  /**
   * Delay between requests to be respectful to servers
   */
  protected async delay(ms?: number): Promise<void> {
    const delayTime = ms || this.config.requestDelayMs;
    await new Promise(resolve => setTimeout(resolve, delayTime));
  }

  /**
   * Navigate to a URL with retry logic
   */
  protected async navigateWithRetry(page: Page, url: string, retries = 3): Promise<boolean> {
    for (let i = 0; i < retries; i++) {
      try {
        console.log(`[${this.sourceName}] Navigating to: ${url}`);
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: this.config.timeout });
        await this.delay(1000); // Wait for any dynamic content
        return true;
      } catch (error) {
        console.warn(`[${this.sourceName}] Navigation attempt ${i + 1} failed:`, error);
        if (i < retries - 1) {
          await this.delay(3000);
        }
      }
    }
    return false;
  }

  /**
   * Extract text content safely
   */
  protected async safeText(page: Page, selector: string): Promise<string | null> {
    try {
      const element = await page.$(selector);
      if (element) {
        return await element.textContent();
      }
    } catch {
      // Ignore
    }
    return null;
  }

  /**
   * Extract attribute safely
   */
  protected async safeAttribute(page: Page, selector: string, attribute: string): Promise<string | null> {
    try {
      const element = await page.$(selector);
      if (element) {
        return await element.getAttribute(attribute);
      }
    } catch {
      // Ignore
    }
    return null;
  }

  /**
   * Parse bedroom count from text like "5 BR" or "5 Bedrooms"
   */
  protected parseBedrooms(text: string | null | undefined): number {
    if (!text) return 0;
    const match = text.match(/(\d+)\s*(br|bed|bedroom)/i);
    return match ? parseInt(match[1]) : 0;
  }

  /**
   * Parse bathroom count from text like "3.5 BA" or "3 Baths"
   */
  protected parseBaths(text: string | null | undefined): number {
    if (!text) return 0;
    const match = text.match(/(\d+\.?\d*)\s*(ba|bath|bathroom)/i);
    return match ? parseFloat(match[1]) : 0;
  }

  /**
   * Parse sleeps count from text
   */
  protected parseSleeps(text: string | null | undefined): number {
    if (!text) return 0;
    const match = text.match(/sleeps?\s*(\d+)/i) || text.match(/(\d+)\s*guests?/i);
    return match ? parseInt(match[1]) : 0;
  }

  /**
   * Parse price from text like "$15,000/week" or "$15000"
   */
  protected parsePrice(text: string | null | undefined): number | null {
    if (!text) return null;
    const cleaned = text.replace(/[,$]/g, '');
    const match = cleaned.match(/(\d+)/);
    return match ? parseInt(match[1]) : null;
  }

  /**
   * Generate a unique ID for a property
   */
  protected generateId(source: string, title: string, url: string): string {
    const hash = url.split('/').pop() || title.toLowerCase().replace(/\s+/g, '-').slice(0, 20);
    return `${source}-${hash}`;
  }

  /**
   * Convert raw listing to Property format
   */
  protected toProperty(raw: RawListing, source: string): Property {
    const today = new Date().toISOString().split('T')[0];

    return {
      id: this.generateId(source, raw.title, raw.url),
      title: raw.title,
      subtitle: raw.location || undefined,
      area: this.inferArea(raw.location || raw.title),
      bedrooms: raw.bedrooms || 0,
      baths: raw.baths || 0,
      sleeps: raw.sleeps || 0,
      walkMinutes: this.estimateWalkTime(raw.location || ''),
      price: this.parsePrice(raw.price),
      priceDisplay: raw.price || 'Contact for price',
      augustAvailable: this.checkAugustAvailability(raw.availability),
      description: raw.description || '',
      features: raw.features || [],
      proximity: '',
      img: raw.imageUrl || 'images/placeholder.jpg',
      url: raw.url,
      source: source,
      score: 0, // Will be calculated by filter
      isNew: true,
      firstSeen: today,
      lastSeen: today
    };
  }

  /**
   * Infer area from location text
   */
  protected inferArea(location: string): string {
    const loc = location.toLowerCase();
    if (loc.includes('ocean park')) return 'Ocean Park';
    if (loc.includes('east chop')) return 'East Chop';
    if (loc.includes('west chop')) return 'West Chop';
    if (loc.includes('harbor') || loc.includes('downtown')) return 'Harbor / Downtown';
    if (loc.includes('circuit')) return 'Downtown';
    if (loc.includes('inkwell')) return 'Ocean Park';
    if (loc.includes('highlands')) return 'Highlands';
    return 'Oak Bluffs';
  }

  /**
   * Estimate walk time to Inkwell Beach based on location
   * This is a rough estimate - would need geocoding for accuracy
   */
  protected estimateWalkTime(location: string): number {
    const loc = location.toLowerCase();
    if (loc.includes('ocean park') || loc.includes('inkwell')) return 3;
    if (loc.includes('circuit') || loc.includes('downtown')) return 5;
    if (loc.includes('harbor')) return 6;
    if (loc.includes('highlands')) return 8;
    if (loc.includes('east chop')) return 12;
    if (loc.includes('west chop')) return 15;
    return 10; // Default estimate
  }

  /**
   * Check if August 2026 is mentioned as available
   */
  protected checkAugustAvailability(availability: string | undefined): boolean | null {
    if (!availability) return null;
    const avail = availability.toLowerCase();
    if (avail.includes('august') && avail.includes('2026')) {
      if (avail.includes('available') || avail.includes('open')) return true;
      if (avail.includes('booked') || avail.includes('unavailable')) return false;
    }
    return null; // Unknown
  }

  /**
   * Main scrape method - must be implemented by subclasses
   */
  abstract scrape(): Promise<RawListing[]>;

  /**
   * Run the scraper and return formatted results
   */
  async run(): Promise<ScrapeResult> {
    const errors: string[] = [];
    let properties: Property[] = [];

    try {
      await this.init();
      const rawListings = await this.scrape();

      properties = rawListings.map(raw => this.toProperty(raw, this.sourceName));

      console.log(`[${this.sourceName}] Found ${properties.length} properties`);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      errors.push(errorMsg);
      console.error(`[${this.sourceName}] Scraping failed:`, errorMsg);
    } finally {
      await this.close();
    }

    return {
      source: this.sourceName,
      timestamp: new Date().toISOString(),
      totalFound: properties.length,
      matchingCriteria: 0, // Will be set by filter
      properties,
      errors
    };
  }
}
