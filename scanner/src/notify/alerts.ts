import nodemailer from 'nodemailer';
import { Property } from '../types/property.js';

interface EmailConfig {
  host: string;
  port: number;
  user: string;
  pass: string;
  to: string;
}

/**
 * Send email notification about new matching properties
 */
export async function sendEmailAlert(
  newProperties: Property[],
  config?: Partial<EmailConfig>
): Promise<boolean> {
  const emailConfig: EmailConfig = {
    host: config?.host || process.env.SMTP_HOST || '',
    port: config?.port || parseInt(process.env.SMTP_PORT || '587'),
    user: config?.user || process.env.SMTP_USER || '',
    pass: config?.pass || process.env.SMTP_PASS || '',
    to: config?.to || process.env.NOTIFY_EMAIL || ''
  };

  // Check if email is configured
  if (!emailConfig.host || !emailConfig.user || !emailConfig.pass || !emailConfig.to) {
    console.log('[Notify] Email not configured, skipping notification');
    return false;
  }

  if (newProperties.length === 0) {
    console.log('[Notify] No new properties to notify about');
    return true;
  }

  try {
    const transporter = nodemailer.createTransport({
      host: emailConfig.host,
      port: emailConfig.port,
      secure: emailConfig.port === 465,
      auth: {
        user: emailConfig.user,
        pass: emailConfig.pass
      }
    });

    const propertyList = newProperties.map(p => `
      <div style="border: 1px solid #ddd; padding: 15px; margin-bottom: 15px; border-radius: 8px;">
        <h3 style="margin: 0 0 10px 0; color: #1e293b;">${p.title}</h3>
        <p style="margin: 5px 0; color: #666;">
          <strong>${p.bedrooms} BR</strong> · <strong>${p.baths} BA</strong> ·
          Sleeps ${p.sleeps} · ~${p.walkMinutes} min walk to Inkwell
        </p>
        <p style="margin: 5px 0; color: #059669; font-weight: bold;">${p.priceDisplay}</p>
        <p style="margin: 10px 0; color: #444;">${p.description.slice(0, 200)}...</p>
        <p style="margin: 5px 0; font-size: 12px; color: #888;">Source: ${p.source}</p>
        <a href="${p.url}" style="display: inline-block; margin-top: 10px; padding: 8px 16px; background: #1e293b; color: white; text-decoration: none; border-radius: 4px;">
          View Property →
        </a>
      </div>
    `).join('');

    const html = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #1e293b, #334155); color: white; padding: 20px; border-radius: 8px 8px 0 0;">
          <h1 style="margin: 0; font-size: 24px;">🏠 Broganda Scanner Alert</h1>
          <p style="margin: 10px 0 0 0; opacity: 0.9;">
            ${newProperties.length} new matching ${newProperties.length === 1 ? 'property' : 'properties'} found!
          </p>
        </div>

        <div style="padding: 20px; background: #f8fafc; border-radius: 0 0 8px 8px;">
          <p style="color: #666; margin-bottom: 20px;">
            The following Oak Bluffs vacation rentals match your criteria
            (4+ BR, 2.5+ BA, ≤15 min walk to Inkwell):
          </p>

          ${propertyList}

          <p style="color: #888; font-size: 12px; margin-top: 20px; text-align: center;">
            Broganda House · Oak Bluffs 2026
          </p>
        </div>
      </div>
    `;

    await transporter.sendMail({
      from: `"Broganda Scanner" <${emailConfig.user}>`,
      to: emailConfig.to,
      subject: `🏠 ${newProperties.length} New MV Rental${newProperties.length === 1 ? '' : 's'} Found`,
      html
    });

    console.log(`[Notify] Email sent to ${emailConfig.to} with ${newProperties.length} properties`);
    return true;

  } catch (error) {
    console.error('[Notify] Failed to send email:', error);
    return false;
  }
}

/**
 * Log new properties to console (always available)
 */
export function logNewProperties(newProperties: Property[]): void {
  if (newProperties.length === 0) {
    console.log('\n✓ No new matching properties found.\n');
    return;
  }

  console.log(`\n${'='.repeat(60)}`);
  console.log(`🏠 ${newProperties.length} NEW MATCHING ${newProperties.length === 1 ? 'PROPERTY' : 'PROPERTIES'} FOUND!`);
  console.log('='.repeat(60));

  for (const p of newProperties) {
    console.log(`
📍 ${p.title}
   ${p.bedrooms} BR · ${p.baths} BA · Sleeps ${p.sleeps} · ~${p.walkMinutes} min walk
   💰 ${p.priceDisplay}
   📌 Source: ${p.source}
   🔗 ${p.url}
`);
  }

  console.log('='.repeat(60) + '\n');
}
