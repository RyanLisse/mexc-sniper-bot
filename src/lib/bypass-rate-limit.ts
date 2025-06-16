/**
 * Development bypass for rate limiting
 * Remove this file in production
 */

// Development IPs to bypass rate limiting
const BYPASS_IPS = [
  '127.0.0.1',
  'localhost',
  '::1',
  '192.168.1.134', // Your local network IP
];

export function shouldBypassRateLimit(ip: string): boolean {
  // Always bypass in development
  if (process.env.NODE_ENV === 'development') {
    return true;
  }
  
  // Bypass for specific IPs
  return BYPASS_IPS.includes(ip);
}