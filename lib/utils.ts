import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function getOptimizedImageUrl(url: string | null | undefined): string {
  if (!url) return '/placeholder.svg';
  const cleanPath = url.replace(/^public\//, '');
  if (cleanPath.startsWith('http') || cleanPath.startsWith('data:')) {
    return cleanPath;
  }
  return cleanPath.replace(/\.png$/i, '.webp');
}
