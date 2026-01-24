# Broganda Scanner

Automated vacation rental scanner for Martha's Vineyard properties matching Broganda family criteria.

## Features

- **Multi-site scraping**: WeNeedAVacation, MV Vacation Rentals, Martha's Vineyard Rentals
- **Smart filtering**: Automatically filters for 4+ BR, 2.5+ BA, ≤15 min walk to Inkwell
- **Scoring system**: Properties scored 0-100 based on how well they match criteria
- **Email alerts**: Optional notifications when new matching properties are found
- **GitHub Actions**: Scheduled scans twice daily with automatic data updates

## Requirements

- Node.js 18+
- npm

## Installation

```bash
cd scanner
npm install
npx playwright install chromium
```

## Usage

### Run a full scan

```bash
npm run scan
```

### Scan specific source

```bash
npm run scan:weneedavacation
npm run scan:mvvacationrentals
npm run scan:mvrentals
```

### CLI options

```bash
npm run scan -- --help

Options:
  -s, --source <source>  Source to scrape (weneedavacation, mvvacationrentals, mvrentals, all)
  -n, --notify           Send email notification for new matches
  -d, --dry-run          Don't save results, just show what would be found
  -v, --verbose          Show detailed output
  -h, --help             Display help
```

### Examples

```bash
# Scan all sources, don't save (test run)
npm run scan -- --dry-run --verbose

# Scan WeNeedAVacation with email notification
npm run scan -- --source weneedavacation --notify

# Full scan with notifications
npm run scan -- --notify
```

## Configuration

Copy `.env.example` to `.env` and configure:

```bash
cp .env.example .env
```

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `SMTP_HOST` | SMTP server hostname | - |
| `SMTP_PORT` | SMTP server port | 587 |
| `SMTP_USER` | SMTP username/email | - |
| `SMTP_PASS` | SMTP password or app password | - |
| `NOTIFY_EMAIL` | Email to send notifications to | - |
| `HEADLESS` | Run browser in headless mode | true |
| `SLOW_MO` | Slow down browser actions (ms) | 100 |
| `REQUEST_DELAY_MS` | Delay between requests (ms) | 2000 |

### Gmail Setup

To use Gmail for notifications:

1. Enable 2-factor authentication on your Google account
2. Generate an App Password: Google Account → Security → App Passwords
3. Use the app password as `SMTP_PASS`

```
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=xxxx-xxxx-xxxx-xxxx
NOTIFY_EMAIL=recipient@example.com
```

## GitHub Actions Setup

The scanner can run automatically via GitHub Actions.

### Required Secrets

Add these secrets to your repository (Settings → Secrets → Actions):

- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_USER`
- `SMTP_PASS`
- `NOTIFY_EMAIL`

### Schedule

By default, the scanner runs:
- 6 AM EST (11:00 UTC)
- 6 PM EST (23:00 UTC)

Modify `.github/workflows/scan-rentals.yml` to change the schedule.

### Manual Trigger

You can also trigger a scan manually from the Actions tab.

## Data Output

Scraped properties are saved to:
- `scanner/data/homes.json` - Scanner's data directory
- `homes.json` - Frontend data file

The frontend automatically loads this data when the page loads.

## Broganda Criteria

Properties are filtered and scored based on:

| Criterion | Minimum | Scoring Bonus |
|-----------|---------|---------------|
| Bedrooms | 4 | +5 per extra (max +15) |
| Bathrooms | 2.5 | +5 per extra (max +10) |
| Walk to Inkwell | ≤15 min | +15 if ≤5 min |
| August 2026 | - | +10 if available |
| Premium features | - | +2 each (max +10) |

Premium features include: A/C, pool, ocean view, wrap porch, chef's kitchen, outdoor shower.

## Adding New Scrapers

1. Create a new file in `src/scrapers/`
2. Extend `BaseScraper` class
3. Implement the `scrape()` method
4. Add to `src/scrapers/index.ts`

Example:

```typescript
import { BaseScraper } from './base-scraper.js';
import { RawListing } from '../types/property.js';

export class NewSiteScraper extends BaseScraper {
  readonly sourceName = 'New Site';
  readonly baseUrl = 'https://example.com';

  async scrape(): Promise<RawListing[]> {
    const listings: RawListing[] = [];
    const page = await this.newPage();

    // Your scraping logic here

    await page.close();
    return listings;
  }
}
```

## Troubleshooting

### Sites returning 403 errors

Some sites block automated requests. The scraper includes:
- Realistic user agent
- Stealth mode (webdriver detection bypass)
- Request delays

If issues persist:
- Increase `REQUEST_DELAY_MS`
- Try running with `HEADLESS=false` to debug
- Check if site has added new bot detection

### Browser not launching

```bash
# Reinstall Playwright browsers
npx playwright install chromium --with-deps
```

### Test connectivity

```bash
npm run test
```

## Legal Considerations

- This tool scrapes publicly available information
- Respect `robots.txt` and site terms of service
- Use reasonable request delays (default: 2 seconds)
- For personal use in finding vacation rentals

## License

MIT
