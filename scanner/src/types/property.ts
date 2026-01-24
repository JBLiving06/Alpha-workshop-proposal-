/**
 * Represents a vacation rental property
 */
export interface Property {
  id: string;
  title: string;
  subtitle?: string;
  area: string;
  bedrooms: number;
  baths: number;
  sleeps: number;
  walkMinutes: number;
  price: number | null;
  priceDisplay: string;
  augustAvailable: boolean | null;
  description: string;
  features: string[];
  proximity: string;
  img: string;
  url: string;
  source: string;
  score: number;
  isNew: boolean;
  firstSeen: string;
  lastSeen: string;
}

/**
 * Raw scraped data before processing
 */
export interface RawListing {
  title: string;
  url: string;
  bedrooms?: number;
  baths?: number;
  sleeps?: number;
  price?: string;
  location?: string;
  description?: string;
  features?: string[];
  imageUrl?: string;
  availability?: string;
}

/**
 * Scraper configuration
 */
export interface ScraperConfig {
  headless: boolean;
  slowMo: number;
  requestDelayMs: number;
  timeout: number;
  userAgent: string;
}

/**
 * Broganda family criteria for filtering properties
 */
export interface FilterCriteria {
  minBedrooms: number;
  minBaths: number;
  maxWalkMinutes: number;
  maxPrice: number | null;
  augustRequired: boolean;
}

/**
 * Result of a scraping run
 */
export interface ScrapeResult {
  source: string;
  timestamp: string;
  totalFound: number;
  matchingCriteria: number;
  properties: Property[];
  errors: string[];
}
