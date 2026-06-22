import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Search } from "lucide-react";
import { useState } from "react";
import heroImg from "@/assets/hero.jpg";
import { fetchProducts } from "@/services/productsApi";
import { CATEGORIES } from "@/data/products";
import { ProductCard, ProductCardSkeleton } from "@/components/ProductCard";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Lumen & Co. — Considered objects for daily life" },
      { name: "description", content: "Discover thoughtfully designed home, lighting, electronics, and apparel from Lumen & Co." },
    ],
  }),
  component: Home,
});

function Home() {
  const [query, setQuery] = useState("");
  const { data, isLoading } = useQuery({ queryKey: ["products"], queryFn: fetchProducts });
  const featured = (data ?? []).slice(0, 4);

  const onSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const q = query.trim();
    window.location.href = q ? `/products?q=${encodeURIComponent(q)}` : "/products";
  };

  return (
    <div>
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="mx-auto grid max-w-7xl items-center gap-10 px-4 py-16 sm:px-6 lg:grid-cols-2 lg:gap-16 lg:px-8 lg:py-24">
          <div>
            <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
              New · Autumn collection
            </p>
            <h1 className="font-display text-5xl font-semibold leading-[1.05] tracking-tight text-foreground sm:text-6xl lg:text-7xl">
              Considered objects <br />
              <span className="italic text-accent">for daily life.</span>
            </h1>
            <p className="mt-6 max-w-md text-base text-muted-foreground sm:text-lg">
              A small studio of makers crafting honest goods for the home, the desk, and the moments in between.
            </p>

            <form onSubmit={onSearch} className="mt-8 flex max-w-md items-center rounded-full border border-border bg-card pl-5 pr-1 shadow-soft focus-within:ring-2 focus-within:ring-ring">
              <Search className="h-4 w-4 text-muted-foreground" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search the shop…"
                className="h-12 flex-1 bg-transparent px-3 text-sm outline-none placeholder:text-muted-foreground"
              />
              <button type="submit" className="inline-flex h-10 items-center gap-1 rounded-full bg-foreground px-4 text-sm font-medium text-background transition hover:opacity-90">
                Search
              </button>
            </form>

            <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-muted-foreground">
              <span>Free shipping over $150</span>
              <span className="h-1 w-1 rounded-full bg-border" />
              <span>30-day returns</span>
              <span className="h-1 w-1 rounded-full bg-border" />
              <span>Made to last</span>
            </div>
          </div>

          <div className="relative">
            <div className="overflow-hidden rounded-3xl shadow-card">
              <img src={heroImg} alt="Editorial still life of a ceramic vase, linen throw, and brass lamp" width={1600} height={1200} className="h-full w-full object-cover" />
            </div>
            <div className="absolute -bottom-6 -left-6 hidden rounded-2xl bg-card px-5 py-4 shadow-card md:block">
              <p className="font-display text-2xl font-semibold">12</p>
              <p className="text-xs uppercase tracking-wider text-muted-foreground">Curated pieces</p>
            </div>
          </div>
        </div>
      </section>

      {/* Categories */}
      <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="mb-8 flex items-end justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Browse</p>
            <h2 className="mt-2 font-display text-3xl font-semibold sm:text-4xl">Categories</h2>
          </div>
          <Link to="/products" className="hidden items-center gap-1 text-sm font-medium text-foreground/80 hover:text-foreground sm:inline-flex">
            View all <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {CATEGORIES.filter((c) => c !== "All").map((cat) => (
            <Link
              key={cat}
              to="/products"
              search={{ category: cat } as never}
              className="group relative flex aspect-square items-end overflow-hidden rounded-2xl bg-secondary p-5 transition hover:shadow-card"
            >
              <span className="font-display text-xl font-medium text-secondary-foreground">{cat}</span>
              <ArrowRight className="absolute right-4 top-4 h-4 w-4 -rotate-45 text-muted-foreground transition group-hover:rotate-0 group-hover:text-foreground" />
            </Link>
          ))}
        </div>
      </section>

      {/* Featured */}
      <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="mb-8 flex items-end justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Featured</p>
            <h2 className="mt-2 font-display text-3xl font-semibold sm:text-4xl">This week's picks</h2>
          </div>
          <Link to="/products" className="text-sm font-medium text-foreground/80 hover:text-foreground">
            Shop all →
          </Link>
        </div>
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {isLoading
            ? Array.from({ length: 4 }).map((_, i) => <ProductCardSkeleton key={i} />)
            : featured.map((p) => <ProductCard key={p.id} product={p} />)}
        </div>
      </section>
    </div>
  );
}
