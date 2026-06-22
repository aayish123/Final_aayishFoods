import { Link } from "@tanstack/react-router";
import { Star, Plus } from "lucide-react";
import { toast } from "sonner";
import type { Product } from "@/data/products";
import { useCart } from "@/context/CartContext";

export function ProductCard({ product }: { product: Product }) {
  const { addItem } = useCart();

  const handleAdd = (e: React.MouseEvent) => {
    e.preventDefault();
    addItem(product, 1);
    toast.success(`${product.title} added to cart`);
  };

  return (
    <Link
      to="/products/$id"
      params={{ id: String(product.id) }}
      className="group relative flex flex-col overflow-hidden rounded-2xl bg-card shadow-soft transition hover:shadow-card"
    >
      <div className="relative aspect-[4/5] overflow-hidden bg-muted">
        <img
          src={product.image}
          alt={product.title}
          loading="lazy"
          className="h-full w-full object-cover transition duration-700 group-hover:scale-105"
        />
        <button
          onClick={handleAdd}
          className="absolute bottom-3 right-3 inline-flex h-10 w-10 items-center justify-center rounded-full bg-background/95 text-foreground opacity-0 shadow-soft transition group-hover:opacity-100 hover:bg-accent hover:text-accent-foreground"
          aria-label="Add to cart"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>
      <div className="flex flex-1 flex-col gap-1 p-4">
        <p className="text-xs uppercase tracking-wider text-muted-foreground">{product.category}</p>
        <h3 className="font-display text-lg leading-snug text-foreground">{product.title}</h3>
        <div className="mt-auto flex items-center justify-between pt-2">
          <p className="text-base font-medium text-foreground">${product.price.toFixed(2)}</p>
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Star className="h-3.5 w-3.5 fill-accent text-accent" />
            <span>{product.rating.toFixed(1)}</span>
          </div>
        </div>
      </div>
    </Link>
  );
}

export function ProductCardSkeleton() {
  return (
    <div className="flex flex-col overflow-hidden rounded-2xl bg-card shadow-soft">
      <div className="aspect-[4/5] animate-pulse bg-muted" />
      <div className="space-y-2 p-4">
        <div className="h-3 w-16 animate-pulse rounded bg-muted" />
        <div className="h-5 w-3/4 animate-pulse rounded bg-muted" />
        <div className="h-4 w-1/3 animate-pulse rounded bg-muted" />
      </div>
    </div>
  );
}
