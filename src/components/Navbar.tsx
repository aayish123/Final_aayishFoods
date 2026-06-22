import { Link } from "@tanstack/react-router";
import { ShoppingBag, Search } from "lucide-react";
import { useCart } from "@/context/CartContext";

export function Navbar() {
  const { count } = useCart();

  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link to="/" className="flex items-center gap-2">
          <span className="font-display text-2xl font-semibold tracking-tight">Lumen</span>
          <span className="hidden text-xs uppercase tracking-[0.2em] text-muted-foreground sm:inline">
            &amp; Co.
          </span>
        </Link>

        <nav className="hidden items-center gap-8 text-sm font-medium md:flex">
          <Link to="/" className="text-foreground/80 transition-colors hover:text-foreground" activeProps={{ className: "text-foreground" }}>
            Home
          </Link>
          <Link to="/products" className="text-foreground/80 transition-colors hover:text-foreground" activeProps={{ className: "text-foreground" }}>
            Shop
          </Link>
          <Link to="/products" search={{ category: "Home" } as never} className="text-foreground/80 transition-colors hover:text-foreground">
            Home
          </Link>
          <Link to="/products" search={{ category: "Electronics" } as never} className="text-foreground/80 transition-colors hover:text-foreground">
            Electronics
          </Link>
        </nav>

        <div className="flex items-center gap-2">
          <Link
            to="/products"
            className="inline-flex h-9 w-9 items-center justify-center rounded-full text-foreground/70 transition hover:bg-muted hover:text-foreground"
            aria-label="Search"
          >
            <Search className="h-4 w-4" />
          </Link>
          <Link
            to="/cart"
            className="relative inline-flex h-9 items-center gap-2 rounded-full bg-foreground px-4 text-sm font-medium text-background transition hover:opacity-90"
          >
            <ShoppingBag className="h-4 w-4" />
            <span>Cart</span>
            {count > 0 && (
              <span className="ml-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-accent px-1.5 text-[11px] font-semibold text-accent-foreground">
                {count}
              </span>
            )}
          </Link>
        </div>
      </div>
    </header>
  );
}
