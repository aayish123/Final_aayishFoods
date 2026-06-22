import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Star, Minus, Plus, ShoppingBag, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { fetchProduct } from "@/services/productsApi";
import { useCart } from "@/context/CartContext";

export const Route = createFileRoute("/products/$id")({
  component: ProductDetail,
});

function ProductDetail() {
  const { id } = Route.useParams();
  const { addItem } = useCart();
  const [qty, setQty] = useState(1);

  const { data: product, isLoading, isError } = useQuery({
    queryKey: ["product", id],
    queryFn: () => fetchProduct(Number(id)),
  });

  if (isLoading) {
    return (
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 sm:px-6 lg:grid-cols-2 lg:px-8">
        <div className="aspect-square animate-pulse rounded-3xl bg-muted" />
        <div className="space-y-4">
          <div className="h-4 w-24 animate-pulse rounded bg-muted" />
          <div className="h-10 w-3/4 animate-pulse rounded bg-muted" />
          <div className="h-20 w-full animate-pulse rounded bg-muted" />
        </div>
      </div>
    );
  }

  if (isError || !product) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-20 text-center">
        <h1 className="font-display text-3xl">Product not found</h1>
        <Link to="/products" className="mt-6 inline-flex items-center gap-2 text-sm text-foreground/80 hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Back to shop
        </Link>
      </div>
    );
  }

  const handleAdd = () => {
    addItem(product, qty);
    toast.success(`${qty} × ${product.title} added to cart`);
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
      <Link to="/products" className="mb-8 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> All products
      </Link>

      <div className="grid gap-10 lg:grid-cols-2">
        <div className="overflow-hidden rounded-3xl bg-card shadow-card">
          <img src={product.image} alt={product.title} className="aspect-square w-full object-cover" />
        </div>

        <div className="flex flex-col">
          <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{product.category}</p>
          <h1 className="mt-3 font-display text-4xl font-semibold sm:text-5xl">{product.title}</h1>

          <div className="mt-4 flex items-center gap-3">
            <div className="flex items-center gap-1 text-sm">
              <Star className="h-4 w-4 fill-accent text-accent" />
              <span className="font-medium">{product.rating.toFixed(1)}</span>
              <span className="text-muted-foreground">/ 5</span>
            </div>
            <span className="h-1 w-1 rounded-full bg-border" />
            <span className="text-sm text-muted-foreground">In stock</span>
          </div>

          <p className="mt-6 max-w-prose text-base leading-relaxed text-muted-foreground">
            {product.description}
          </p>

          <div className="mt-8 flex items-end gap-6">
            <div>
              <p className="text-xs uppercase tracking-wider text-muted-foreground">Price</p>
              <p className="font-display text-3xl font-semibold">${product.price.toFixed(2)}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wider text-muted-foreground">Quantity</p>
              <div className="mt-1 inline-flex items-center rounded-full border border-border bg-card">
                <button onClick={() => setQty((q) => Math.max(1, q - 1))} className="flex h-10 w-10 items-center justify-center text-foreground/80 hover:text-foreground">
                  <Minus className="h-4 w-4" />
                </button>
                <span className="w-8 text-center text-sm font-medium">{qty}</span>
                <button onClick={() => setQty((q) => q + 1)} className="flex h-10 w-10 items-center justify-center text-foreground/80 hover:text-foreground">
                  <Plus className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>

          <button
            onClick={handleAdd}
            className="mt-8 inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-foreground text-sm font-medium text-background transition hover:opacity-90 sm:w-auto sm:px-10"
          >
            <ShoppingBag className="h-4 w-4" /> Add to cart — ${(product.price * qty).toFixed(2)}
          </button>

          <div className="mt-10 grid grid-cols-2 gap-4 border-t border-border pt-6 text-sm text-muted-foreground">
            <div>
              <p className="font-medium text-foreground">Free shipping</p>
              <p className="mt-1 text-xs">On orders over $150</p>
            </div>
            <div>
              <p className="font-medium text-foreground">30-day returns</p>
              <p className="mt-1 text-xs">No questions asked</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
