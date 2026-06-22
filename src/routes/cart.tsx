import { createFileRoute, Link } from "@tanstack/react-router";
import { Minus, Plus, Trash2, ShoppingBag } from "lucide-react";
import { useCart } from "@/context/CartContext";

export const Route = createFileRoute("/cart")({
  head: () => ({ meta: [{ title: "Your cart — Lumen & Co." }] }),
  component: CartPage,
});

function CartPage() {
  const { items, updateQuantity, removeItem, subtotal, count } = useCart();
  const shipping = subtotal > 150 || subtotal === 0 ? 0 : 12;
  const total = subtotal + shipping;

  if (items.length === 0) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-24 text-center">
        <ShoppingBag className="mx-auto h-12 w-12 text-muted-foreground" />
        <h1 className="mt-6 font-display text-4xl font-semibold">Your cart is empty</h1>
        <p className="mt-3 text-muted-foreground">Add a few considered pieces to get started.</p>
        <Link to="/products" className="mt-8 inline-flex h-12 items-center rounded-full bg-foreground px-6 text-sm font-medium text-background hover:opacity-90">
          Browse the shop
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
      <h1 className="font-display text-4xl font-semibold sm:text-5xl">Your cart</h1>
      <p className="mt-2 text-muted-foreground">{count} {count === 1 ? "item" : "items"}</p>

      <div className="mt-10 grid gap-10 lg:grid-cols-[1fr_380px]">
        <ul className="divide-y divide-border rounded-2xl border border-border bg-card">
          {items.map((item) => (
            <li key={item.id} className="flex gap-4 p-4 sm:gap-6 sm:p-6">
              <Link to="/products/$id" params={{ id: String(item.id) }} className="block h-24 w-24 shrink-0 overflow-hidden rounded-xl bg-muted sm:h-28 sm:w-28">
                <img src={item.image} alt={item.title} className="h-full w-full object-cover" />
              </Link>
              <div className="flex flex-1 flex-col">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs uppercase tracking-wider text-muted-foreground">{item.category}</p>
                    <Link to="/products/$id" params={{ id: String(item.id) }} className="mt-1 block font-display text-lg hover:underline">
                      {item.title}
                    </Link>
                  </div>
                  <p className="font-medium">${(item.price * item.quantity).toFixed(2)}</p>
                </div>
                <div className="mt-auto flex items-center justify-between pt-4">
                  <div className="inline-flex items-center rounded-full border border-border">
                    <button onClick={() => updateQuantity(item.id, item.quantity - 1)} className="flex h-9 w-9 items-center justify-center">
                      <Minus className="h-3.5 w-3.5" />
                    </button>
                    <span className="w-8 text-center text-sm">{item.quantity}</span>
                    <button onClick={() => updateQuantity(item.id, item.quantity + 1)} className="flex h-9 w-9 items-center justify-center">
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <button onClick={() => removeItem(item.id)} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-destructive">
                    <Trash2 className="h-4 w-4" /> Remove
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>

        <aside className="h-fit rounded-2xl border border-border bg-card p-6 shadow-soft">
          <h2 className="font-display text-xl font-semibold">Order summary</h2>
          <dl className="mt-6 space-y-3 text-sm">
            <div className="flex justify-between"><dt className="text-muted-foreground">Subtotal</dt><dd>${subtotal.toFixed(2)}</dd></div>
            <div className="flex justify-between"><dt className="text-muted-foreground">Shipping</dt><dd>{shipping === 0 ? "Free" : `$${shipping.toFixed(2)}`}</dd></div>
            <div className="my-3 h-px bg-border" />
            <div className="flex justify-between text-base font-medium"><dt>Total</dt><dd>${total.toFixed(2)}</dd></div>
          </dl>
          <Link to="/checkout" className="mt-6 inline-flex h-12 w-full items-center justify-center rounded-full bg-foreground text-sm font-medium text-background hover:opacity-90">
            Checkout
          </Link>
          <Link to="/products" className="mt-3 block text-center text-sm text-muted-foreground hover:text-foreground">
            Continue shopping
          </Link>
        </aside>
      </div>
    </div>
  );
}
