import { PhotoRecord, Product } from '../types';

export function mockRecommendProducts(_photo: PhotoRecord, products: Product[]): Product[] {
  if (!products.length) return [];
  const shuffled = [...products].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.min(3, products.length));
}
