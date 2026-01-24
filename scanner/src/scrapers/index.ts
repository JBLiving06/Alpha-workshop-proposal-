export { BaseScraper } from './base-scraper.js';
export { WeNeedAVacationScraper } from './weneedavacation.js';
export { MVVacationRentalsScraper } from './mvvacationrentals.js';
export { MVRentalsScraper } from './mvrentals.js';

import { BaseScraper } from './base-scraper.js';
import { WeNeedAVacationScraper } from './weneedavacation.js';
import { MVVacationRentalsScraper } from './mvvacationrentals.js';
import { MVRentalsScraper } from './mvrentals.js';

export type ScraperName = 'weneedavacation' | 'mvvacationrentals' | 'mvrentals' | 'all';

export function createScraper(name: ScraperName): BaseScraper[] {
  switch (name) {
    case 'weneedavacation':
      return [new WeNeedAVacationScraper()];
    case 'mvvacationrentals':
      return [new MVVacationRentalsScraper()];
    case 'mvrentals':
      return [new MVRentalsScraper()];
    case 'all':
    default:
      return [
        new WeNeedAVacationScraper(),
        new MVVacationRentalsScraper(),
        new MVRentalsScraper()
      ];
  }
}

export const SCRAPER_NAMES: ScraperName[] = ['weneedavacation', 'mvvacationrentals', 'mvrentals'];
