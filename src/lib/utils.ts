import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Optimizes image URLs by setting width/quality params for supported services (like Unsplash)
 * and resolves local/relative paths.
 */
export function getOptimizedImageUrl(url: string | null | undefined, width = 600): string {
  if (!url) return '/placeholder.svg';
  
  // Clean up any "public/" prefix that might have been saved
  let cleanUrl = url.replace(/^public\//, '');

  // If it's a relative path, resolve it relative to the root/public folder
  if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
    // If it doesn't start with a slash and is not an external URL, add one
    if (!cleanUrl.startsWith('/')) {
      cleanUrl = '/' + cleanUrl;
    }
    return cleanUrl;
  }

  // Handle Unsplash optimization
  if (cleanUrl.includes('images.unsplash.com')) {
    try {
      const urlObj = new URL(cleanUrl);
      urlObj.searchParams.set('w', width.toString());
      urlObj.searchParams.set('q', '80');
      urlObj.searchParams.set('auto', 'format');
      urlObj.searchParams.set('fit', 'crop');
      return urlObj.toString();
    } catch (e) {
      return cleanUrl;
    }
  }

  return cleanUrl;
}
