export interface Product {
  id: number;
  title: string;
  price: number;
  rating: number;
  category: string;
  image: string;
  description: string;
}

// Mock product catalog (Unsplash images)
export const PRODUCTS: Product[] = [
  {
    id: 1,
    title: "Sculpted Ceramic Vase",
    price: 84.0,
    rating: 4.8,
    category: "Home",
    image: "https://images.unsplash.com/photo-1578500494198-246f612d3b3d?w=800&q=80",
    description: "Hand-thrown stoneware vase with a matte oat glaze. A quiet sculptural piece for any shelf or table.",
  },
  {
    id: 2,
    title: "Linen Throw — Terracotta",
    price: 128.0,
    rating: 4.7,
    category: "Home",
    image: "https://images.unsplash.com/photo-1584100936595-c0654b55a2e6?w=800&q=80",
    description: "Stone-washed European linen throw with raw edges. Softens beautifully with every wash.",
  },
  {
    id: 3,
    title: "Brass Task Lamp",
    price: 245.0,
    rating: 4.9,
    category: "Lighting",
    image: "https://images.unsplash.com/photo-1507473885765-e6ed057f782c?w=800&q=80",
    description: "Articulated solid brass desk lamp with weighted base. Inline dimmer and warm 2700K LED.",
  },
  {
    id: 4,
    title: "Wireless Studio Headphones",
    price: 299.0,
    rating: 4.6,
    category: "Electronics",
    image: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800&q=80",
    description: "Closed-back over-ear headphones with active noise cancellation and 40-hour battery.",
  },
  {
    id: 5,
    title: "Leather Field Tote",
    price: 320.0,
    rating: 4.8,
    category: "Accessories",
    image: "https://images.unsplash.com/photo-1548036328-c9fa89d128fa?w=800&q=80",
    description: "Full-grain vegetable-tanned leather tote, hand-stitched. Develops a rich patina over time.",
  },
  {
    id: 6,
    title: "Cashmere Crewneck",
    price: 195.0,
    rating: 4.5,
    category: "Apparel",
    image: "https://images.unsplash.com/photo-1576566588028-4147f3842f27?w=800&q=80",
    description: "Grade-A Mongolian cashmere knit in a relaxed crew silhouette. Effortlessly warm.",
  },
  {
    id: 7,
    title: "Pour-Over Coffee Set",
    price: 68.0,
    rating: 4.4,
    category: "Home",
    image: "https://images.unsplash.com/photo-1497935586351-b67a49e012bf?w=800&q=80",
    description: "Borosilicate glass server, ceramic dripper, and stainless gooseneck. A complete morning ritual.",
  },
  {
    id: 8,
    title: "Minimal Mechanical Watch",
    price: 420.0,
    rating: 4.7,
    category: "Accessories",
    image: "https://images.unsplash.com/photo-1524592094714-0f0654e20314?w=800&q=80",
    description: "38mm automatic movement, sapphire crystal, and a quietly perfect off-white dial.",
  },
  {
    id: 9,
    title: "Walnut Bookshelf Speaker",
    price: 549.0,
    rating: 4.9,
    category: "Electronics",
    image: "https://images.unsplash.com/photo-1545454675-3531b543be5d?w=800&q=80",
    description: "Two-way active speaker in solid walnut. Bluetooth 5.3 and balanced TRS input.",
  },
  {
    id: 10,
    title: "Linen Apron",
    price: 56.0,
    rating: 4.3,
    category: "Apparel",
    image: "https://images.unsplash.com/photo-1556905055-8f358a7a47b2?w=800&q=80",
    description: "Heavyweight linen with brass hardware and adjustable crossback straps.",
  },
  {
    id: 11,
    title: "Paper Pendant Light",
    price: 175.0,
    rating: 4.6,
    category: "Lighting",
    image: "https://images.unsplash.com/photo-1513506003901-1e6a229e2d15?w=800&q=80",
    description: "Hand-folded rice paper pendant on a steel frame. Casts a warm, diffuse glow.",
  },
  {
    id: 12,
    title: "Field Notebook Set",
    price: 24.0,
    rating: 4.5,
    category: "Accessories",
    image: "https://images.unsplash.com/photo-1531346878377-a5be20888e57?w=800&q=80",
    description: "Set of three pocket notebooks, dot-grid, with smyth-sewn binding.",
  },
];

export const CATEGORIES = ["All", "Home", "Lighting", "Electronics", "Accessories", "Apparel"];
