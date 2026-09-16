"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.scrapeBcvRates = scrapeBcvRates;
const axios_1 = __importDefault(require("axios"));
const cheerio = __importStar(require("cheerio"));
const https_1 = __importDefault(require("https"));
const index_1 = require("../models/index.js");
const BCV_URL = 'https://www.bcv.org.ve';
const TIMEOUT_MS = 15000;
// BCV has an SSL certificate that Node.js can't verify by default.
// Use a per-request agent that skips certificate validation (only for this URL).
const bcvAgent = new https_1.default.Agent({ rejectUnauthorized: false });
/**
 * Parse a BCV rate string like "798,32600000" into a number.
 * BCV uses comma as decimal separator.
 */
function parseBcvRate(raw) {
    if (!raw)
        return null;
    // Remove spaces, then replace comma with dot
    const cleaned = raw.trim().replace(/\s+/g, '').replace(',', '.');
    const n = Number(cleaned);
    return isNaN(n) ? null : n;
}
/**
 * Scrape USD and EUR rates from the BCV website and upsert them into exchange_rates.
 *
 * - Fetches https://www.bcv.org.ve with a 15s timeout.
 * - Parses #dolar .strong-tb and #euro .strong-tb.
 * - Uses findOrCreate on (exchangeRateTypeId, date) to avoid duplicates.
 * - If the rate already exists for today, it updates the value.
 * - All errors are caught and returned — never throws.
 */
function scrapeBcvRates() {
    return __awaiter(this, void 0, void 0, function* () {
        const today = new Date().toISOString().slice(0, 10);
        const result = {
            success: false,
            message: '',
            rates: { date: today },
        };
        try {
            // Fetch BCV page
            const response = yield axios_1.default.get(BCV_URL, {
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
            // Find exchange rate types by code
            const usdType = yield index_1.ExchangeRateType.findOne({ where: { code: 'USD_BCV' } });
            const eurType = yield index_1.ExchangeRateType.findOne({ where: { code: 'EUR_BCV' } });
            const saved = [];
            // Upsert USD
            if (usd !== null && usdType) {
                const [entry, created] = yield index_1.ExchangeRate.findOrCreate({
                    where: { exchangeRateTypeId: usdType.id, date: today },
                    defaults: { exchangeRateTypeId: usdType.id, rate: usd, date: today },
                });
                if (!created) {
                    yield entry.update({ rate: usd });
                }
                result.rates.usd = usd;
                saved.push(`USD=${usd}${created ? ' (nuevo)' : ' (actualizado)'}`);
            }
            // Upsert EUR
            if (eur !== null && eurType) {
                const [entry, created] = yield index_1.ExchangeRate.findOrCreate({
                    where: { exchangeRateTypeId: eurType.id, date: today },
                    defaults: { exchangeRateTypeId: eurType.id, rate: eur, date: today },
                });
                if (!created) {
                    yield entry.update({ rate: eur });
                }
                result.rates.eur = eur;
                saved.push(`EUR=${eur}${created ? ' (nuevo)' : ' (actualizado)'}`);
            }
            result.success = true;
            result.message = `Tasas guardadas: ${saved.join(', ')}`;
            return result;
        }
        catch (error) {
            if ((error === null || error === void 0 ? void 0 : error.code) === 'ECONNABORTED' || (error === null || error === void 0 ? void 0 : error.code) === 'ETIMEDOUT') {
                result.message = 'Timeout al conectar con el BCV';
            }
            else if ((error === null || error === void 0 ? void 0 : error.code) === 'ENOTFOUND' || (error === null || error === void 0 ? void 0 : error.code) === 'ECONNREFUSED') {
                result.message = 'No se pudo conectar con el BCV (sitio no disponible)';
            }
            else {
                result.message = `Error al scraping BCV: ${(error === null || error === void 0 ? void 0 : error.message) || 'desconocido'}`;
            }
            console.error('[scrapeBcvRates]', result.message);
            return result;
        }
    });
}
