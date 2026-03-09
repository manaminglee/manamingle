/** Convert ISO 3166-1 alpha-2 country code to flag emoji (e.g. "US" -> "🇺🇸") */
export function countryToFlag(cc) {
  if (!cc || typeof cc !== 'string' || cc.length !== 2) return '';
  return cc
    .toUpperCase()
    .split('')
    .map((c) => String.fromCodePoint(0x1f1e6 - 65 + c.charCodeAt(0)))
    .join('');
}
