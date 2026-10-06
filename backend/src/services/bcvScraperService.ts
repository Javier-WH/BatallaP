import axios from 'axios';
import * as cheerio from 'cheerio';
import https from 'https';
import { ExchangeRate, ExchangeRateType } from '@/models/index';

const BCV_URL = 'https://www.bcv.org.ve';
const TIMEOUT_MS = 15000;

// BCV has an SSL certificate that Node.js can't verify by default.
// Use a per-request agent that skips certificate validation (only for this URL).
const bcvAgent = new https.Agent({ rejectUnauthorized: false });

export interface BcvScrapeResult {
  success: boolean;
  message: string;
  rates: { usd?: number; eur?: number; date: string };
}

/**
 * Parse a BCV rate string like "798,32600000" into a number.
 * BCV uses comma as decimal separator.
 */
function parseBcvRate(raw: string): number | null {
  if (!raw) return null;
  // Remove spaces, then replace comma with dot
  const cleaned = raw.trim().replace(/\s+/g, '').replace(',', '.');
  const n = Number(cleaned);
  return isNaN(n) ? null : n;
}

const SPANISH_MONTHS: Record<string, string> = {
  enero: '01', febrero: '02', marzo: '03', abril: '04',
  mayo: '05', junio: '06', julio: '07', agosto: '08',
  septiembre: '09', octubre: '10', noviembre: '11', diciembre: '12',
};

/**
 * Extract the "Fecha Valor" the BCV publishes next to the rates — the date the
 * rate is effective for, which can be a future date (BCV publishes the next
 * day's rate ahead of time). Returns YYYY-MM-DD or null.
 *
 * The BCV site is Drupal: the date renders inside a `span.date-display-single`
 * whose `content` attribute carries the ISO datetime — that is the preferred
 * source since it avoids parsing Spanish month names. Falls back to the
 * visible "Fecha Valor: Miércoles, 07 Octubre 2026" text.
 */
function extractFechaValor($: cheerio.CheerioAPI): string | null {
  // The page has several `date-display-single` spans (INPC, reservas,
  // prestaciones); the right one is the span inside the "Fecha Valor:" label.
  const fvSpan = $('span.date-display-single').filter((_, el) =>
    /Fecha\s+Valor/i.test($(el).parent().text())
  ).first();
  const iso = fvSpan.attr('content')?.slice(0, 10);
  if (iso && /^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso;

  const textMatch = $('body').text().match(
    /Fecha\s+Valor:?\s*\w+,?\s*(\d{1,2})\s+([A-Za-záéíóúñ]+)\s+(\d{4})/i
  );
  if (textMatch) {
    const month = SPANISH_MONTHS[textMatch[2].toLowerCase()];
    if (month) return `${textMatch[3]}-${month}-${textMatch[1].padStart(2, '0')}`;
  }
  return null;
}

// Guard against a wrong selector/format producing a garbage date: the Fecha
// Valor should never be more than ~2 months away from today in either
// direction. Out of range → fall back to the server date.
function isSaneRateDate(date: string, today: string): boolean {
  const ms = Date.parse(date) - Date.parse(today);
  const days = ms / 86400000;
  return days >= -60 && days <= 60;
}

/**
 * Scrape USD and EUR rates from the BCV website and upsert them into exchange_rates.
 *
 * - Fetches https://www.bcv.org.ve with a 15s timeout.
 * - Parses #dolar .strong-tb and #euro .strong-tb.
 * - Stores each rate under the "Fecha Valor" published by the BCV (which may
 *   be a future date), falling back to the server date if it can't be read.
 * - Uses findOrCreate on (exchangeRateTypeId, date) to avoid duplicates.
 * - If the rate already exists for that date, it updates the value.
 * - All errors are caught and returned — never throws.
 */
export async function scrapeBcvRates(): Promise<BcvScrapeResult> {
  const today = new Date().toISOString().slice(0, 10);
  const result: BcvScrapeResult = {
    success: false,
    message: '',
    rates: { date: today },
  };

  try {
    // Fetch BCV page
    const response = await axios.get(BCV_URL, {
      timeout: TIMEOUT_MS,
      httpsAgent: bcvAgent,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'es-VE,es;q=0.9,en;q=0.8',
      },
      // Don't fail on non-2xx, we want to log the status
      validateStatus: (status) => status < 500,
    });

    if (response.status !== 200 || !response.data) {
      result.message = `BCV respondió con status ${response.status}`;
      return result;
    }

    const $ = cheerio.load(response.data);

    // Parse USD
    const usdRaw = $('#dolar .strong-tb').first().text();
    const usd = parseBcvRate(usdRaw);

    // Parse EUR
    const eurRaw = $('#euro .strong-tb').first().text();
    const eur = parseBcvRate(eurRaw);

    if (usd === null && eur === null) {
      result.message = 'No se pudieron extraer las tasas del HTML del BCV (selectores no encontrados)';
      return result;
    }

    // Store the rate under the "Fecha Valor" the BCV publishes, not the
    // scrape date: on weekends the page keeps showing Friday's rate and BCV
    // often publishes the next day's rate ahead of time.
    const fechaValor = extractFechaValor($);
    const rateDate = fechaValor && isSaneRateDate(fechaValor, today) ? fechaValor : today;
    result.rates.date = rateDate;

    // Find exchange rate types by code
    const usdType = await ExchangeRateType.findOne({ where: { code: 'USD_BCV' } });
    const eurType = await ExchangeRateType.findOne({ where: { code: 'EUR_BCV' } });

    const saved: string[] = [];

    // Upsert USD
    if (usd !== null && usdType) {
      const [entry, created] = await ExchangeRate.findOrCreate({
        where: { exchangeRateTypeId: usdType.id, date: rateDate },
        defaults: { exchangeRateTypeId: usdType.id, rate: usd, date: rateDate },
      });
      if (!created) {
        await entry.update({ rate: usd });
      }
      result.rates.usd = usd;
      saved.push(`USD=${usd}${created ? ' (nuevo)' : ' (actualizado)'}`);
    }

    // Upsert EUR
    if (eur !== null && eurType) {
      const [entry, created] = await ExchangeRate.findOrCreate({
        where: { exchangeRateTypeId: eurType.id, date: rateDate },
        defaults: { exchangeRateTypeId: eurType.id, rate: eur, date: rateDate },
      });
      if (!created) {
        await entry.update({ rate: eur });
      }
      result.rates.eur = eur;
      saved.push(`EUR=${eur}${created ? ' (nuevo)' : ' (actualizado)'}`);
    }

    result.success = true;
    result.message = `Tasas guardadas: ${saved.join(', ')} · Fecha Valor: ${rateDate}`;
    return result;
  } catch (error: any) {
    if (error?.code === 'ECONNABORTED' || error?.code === 'ETIMEDOUT') {
      result.message = 'Timeout al conectar con el BCV';
    } else if (error?.code === 'ENOTFOUND' || error?.code === 'ECONNREFUSED') {
      result.message = 'No se pudo conectar con el BCV (sitio no disponible)';
    } else {
      result.message = `Error al scraping BCV: ${error?.message || 'desconocido'}`;
    }
    console.error('[scrapeBcvRates]', result.message);
    return result;
  }
}
