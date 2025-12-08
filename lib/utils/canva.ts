// lib/utils/canva.ts

/**
 * Convert Canva share URL to embed URL
 * @param shareUrl - Original Canva share URL
 * @returns Embed URL for iframe
 */
export function convertCanvaToEmbedUrl(shareUrl: string): string {
  try {
    // Remove any utm parameters
    const cleanUrl = shareUrl.split('?')[0];
    
    // Extract design ID and token from URL
    // Example: https://www.canva.com/design/DAGn6E-6Uho/HkNpZzV5tk6Df9WQQNY-9A/view
    const urlParts = cleanUrl.match(/\/design\/([^\/]+)\/([^\/]+)\//);
    
    if (!urlParts || urlParts.length < 3) {
      throw new Error('Invalid Canva URL format');
    }
    
    const designId = urlParts[1];
    const token = urlParts[2];
    
    // Build embed URL with UI hidden
    // The ui parameter is a base64 encoded JSON that hides Canva UI elements
    const embedUrl = `https://www.canva.com/design/${designId}/${token}/view?embed&ui=eyJBIjp7IkIiOmZhbHNlLCJDIjpmYWxzZX19`;
    
    return embedUrl;
  } catch (error) {
    console.error('Error converting Canva URL:', error);
    throw new Error('ไม่สามารถแปลง URL ได้ กรุณาตรวจสอบ URL ให้ถูกต้อง');
  }
}

/**
 * Validate if URL is a valid Canva share URL
 * @param url - URL to validate
 * @returns true if valid Canva URL
 */
export function isValidCanvaUrl(url: string): boolean {
  const canvaUrlPattern = /^https:\/\/(www\.)?canva\.com\/design\/[A-Za-z0-9_-]+\/[A-Za-z0-9_-]+\/(view|edit)/;
  return canvaUrlPattern.test(url);
}

/**
 * Extract design ID from Canva URL
 * @param url - Canva URL
 * @returns Design ID or null
 */
export function extractCanvaDesignId(url: string): string | null {
  const match = url.match(/\/design\/([^\/]+)\//);
  return match ? match[1] : null;
}

/**
 * Generate preview URL for Canva design
 * @param designId - Canva design ID
 * @returns Preview image URL
 */
export function getCanvaPreviewUrl(designId: string): string {
  // This is a placeholder - Canva doesn't provide direct preview URLs
  // You would need to generate/upload your own thumbnails
  return `/api/placeholder/400/225`;
}