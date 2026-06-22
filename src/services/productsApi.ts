import { PRODUCTS, type Product } from "@/data/products";

// Simulated async API — swap with Axios/fetch to a real backend later.
function delay<T>(value: T, ms = 350): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms));
}

export async function fetchProducts(): Promise<Product[]> {
  return delay(PRODUCTS);
}

export async function fetchProduct(id: number): Promise<Product | undefined> {
  return delay(PRODUCTS.find((p) => p.id === id));
}
