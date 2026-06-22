import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { fetchProducts } from "@/services/productsApi";
import { CATEGORIES } from "@/data/products";
import { ProductCard, ProductCardSkeleton } from "@/components/ProductCard";

type Sort = "featured" | "price-asc" | "price-desc" | "rating";

interface ProductsSearch {
  category?: string;
  q?: string;
  sort?: Sort;
}

export const Route = createFileRoute("/products")({
  validateSearch: (s: Record<string, unknown>): ProductsSearch => ({
    category: typeof s.category === "string" ? s.category : undefined,
    q: typeof s.q === "string" ? s.q : undefined,
    sort: (["featured", "price-asc", "price-desc", "rating"] as const).includes(s.sort as Sort)
      ? (s.sort as Sort)
      : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Shop — Lumen & Co." },
      { name: "description", content: "Browse the full Lumen & Co. catalog of considered, well-made objects." },
    ],
  }),
  component: ProductsPage,
});

function ProductsPage() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["products"],
    queryFn: fetchProducts,
  });

  const [query, setQuery] = useState(search.q ?? "");
  const category = search.category ?? "All";
  const sort: Sort = search.sort ?? "featured";

  const products = useMemo(() => {
    let list = data ?? [];
    if (category !== "All") list = list.filter((p) => p.category === category);
    const q = (search.q ?? "").trim().toLowerCase();
    if (q) list = list.filter((p) => p.title.toLowerCase().includes(q) || p.description.toLowerCase().includes(q));
    if (sort === "price-asc") list = [...list].sort((a, b) => a.price - b.price);
    if (sort === "price-desc") list = [...list].sort((a, b) => b.price - a.price);
    if (sort === "rating") list = [...list].sort((a, b) => b.rating - a.rating);
    return list;
  }, [data, category, search.q, sort]);

  const onSearch = (e: React.FormEvent) => {
    e.preventDefault();
    navigate({ search: (s: ProductsSearch) => ({ ...s, q: query.trim() || undefined }) });
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="mb-10 flex flex-col gap-3">
        <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Shop</p>
        <h1 className="font-display text-4xl font-semibold sm:text-5xl">All products</h1>
        <p className="max-w-2xl text-muted-foreground">
          {data ? `${products.length} of ${data.length} pieces` : "Loading the catalog…"}
        </p>
      </div>

      {/* Controls */}
      <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <form onSubmit={onSearch} className="flex w-full max-w-md items-center rounded-full border border-border bg-card pl-4 pr-1 shadow-soft focus-within:ring-2 focus-within:ring-ring">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search products…"
            className="h-11 flex-1 bg-transparent px-3 text-sm outline-none placeholder:text-muted-foreground"
          />
          <button type="submit" className="inline-flex h-9 items-center rounded-full bg-foreground px-4 text-sm font-medium text-background transition hover:opacity-90">
            Search
          </button>
        </form>

        <div className="flex items-center gap-2">
          <label className="text-xs uppercase tracking-wider text-muted-foreground">Sort</label>
          <select
            value={sort}
            onChange={(e) => navigate({ search: (s: ProductsSearch) => ({ ...s, sort: e.target.value as Sort }) })}
            className="h-10 rounded-full border border-border bg-card px-4 text-sm outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="featured">Featured</option>
            <option value="price-asc">Price: low to high</option>
            <option value="price-desc">Price: high to low</option>
            <option value="rating">Top rated</option>
          </select>
        </div>
      </div>

      {/* Category pills */}
      <div className="mb-10 flex flex-wrap gap-2">
        {CATEGORIES.map((cat) => {
          const active = cat === category;
          return (
            <button
              key={cat}
              onClick={() =>
                navigate({ search: (s: ProductsSearch) => ({ ...s, category: cat === "All" ? undefined : cat }) })
              }
              className={
                "rounded-full px-4 py-2 text-sm font-medium transition " +
                (active
                  ? "bg-foreground text-background"
                  : "border border-border bg-card text-foreground/80 hover:text-foreground")
              }
            >
              {cat}
            </button>
          );
        })}
      </div>

      {isError ? (
        <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-8 text-center">
          <p className="text-sm text-destructive">We couldn't load the catalog.</p>
          <button onClick={() => refetch()} className="mt-3 rounded-full bg-foreground px-4 py-2 text-sm text-background">
            Try again
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {isLoading
            ? Array.from({ length: 8 }).map((_, i) => <ProductCardSkeleton key={i} />)
            : products.map((p) => <ProductCard key={p.id} product={p} />)}
        </div>
      )}

      {!isLoading && products.length === 0 && (
        <div className="rounded-2xl border border-border bg-card py-20 text-center">
          <p className="font-display text-2xl">No matches</p>
          <p className="mt-2 text-sm text-muted-foreground">Try a different search or category.</p>
        </div>
      )}
    </div>
  );
}
