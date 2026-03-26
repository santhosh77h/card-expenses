/**
 * HMAC request signing — signs every API request with a timestamp + signature
 * to block replay attacks (60s window) and casual scraping.
 */

import CryptoJS from 'crypto-js';

const HMAC_SECRET = '77e8f9c5e98b26f55d48af2cdccbc6ded2e33dc6705ead8009180fe6fdeb44fa';

/**
 * Generate HMAC signature headers for a request.
 *
 * @param path - The URL path (e.g. `/parse-statement/json`)
 * @returns Headers to include: `X-Timestamp` and `X-Signature`
 */
export function signRequest(path: string): { 'X-Timestamp': string; 'X-Signature': string } {
	const timestamp = Math.floor(Date.now() / 1000).toString();
	const message = `${timestamp}.${path}`;
	const signature = CryptoJS.HmacSHA256(message, HMAC_SECRET).toString();
	return {
		'X-Timestamp': timestamp,
		'X-Signature': signature,
	};
}
