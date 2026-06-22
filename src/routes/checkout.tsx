import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { CheckCircle2 } from "lucide-react";
import { useCart } from "@/context/CartContext";

export const Route = createFileRoute("/checkout")({
  head: () => ({ meta: [{ title: "Checkout — Lumen & Co." }] }),
  component: CheckoutPage,
});

function CheckoutPage() {
  const { items, subtotal, clear } = useCart();
  const navigate = useNavigate();
  const shipping = subtotal > 150 || subtotal === 0 ? 0 : 12;
  const total = subtotal + shipping;
  const [placing, setPlacing] = useState(false);
  const [placed, setPlaced] = useState(false);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPlacing(true);
    setTimeout(() => {
      setPlacing(false);
      setPlaced(true);
      clear();
      toast.success("Order placed — thank you!");
    }, 900);
  };

  if (placed) {
    return (
      <div className="mx-auto max-w-xl px-4 py-24 text-center">
        <CheckCircle2 className="mx-auto h-14 w-14 text-accent" />
        <h1 className="mt-6 font-display text-4xl font-semibold">Order confirmed</h1>
        <p className="mt-3 text-muted-foreground">
          Thanks for your order. A receipt is on its way to your inbox.
        </p>
        <Link to="/" className="mt-8 inline-flex h-12 items-center rounded-full bg-foreground px-6 text-sm font-medium text-background hover:opacity-90">
          Back to home
        </Link>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="mx-auto max-w-xl px-4 py-24 text-center">
        <h1 className="font-display text-3xl font-semibold">Your cart is empty</h1>
        <Link to="/products" className="mt-6 inline-flex items-center text-sm text-foreground/80 hover:text-foreground">
          Browse the shop →
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
      <h1 className="font-display text-4xl font-semibold sm:text-5xl">Checkout</h1>

      <div className="mt-10 grid gap-10 lg:grid-cols-[1fr_400px]">
        <form onSubmit={onSubmit} className="space-y-8 rounded-2xl border border-border bg-card p-6 shadow-soft sm:p-8">
          <section>
            <h2 className="font-display text-xl font-semibold">Contact</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <Field label="Email" type="email" required />
              <Field label="Phone" type="tel" />
            </div>
          </section>

          <section>
            <h2 className="font-display text-xl font-semibold">Shipping address</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <Field label="First name" required />
              <Field label="Last name" required />
              <Field label="Address" className="sm:col-span-2" required />
              <Field label="City" required />
              <Field label="Postal code" required />
              <Field label="Country" defaultValue="United States" className="sm:col-span-2" required />
            </div>
          </section>

          <section>
            <h2 className="font-display text-xl font-semibold">Payment</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <Field label="Card number" placeholder="•••• •••• •••• ••••" className="sm:col-span-2" required />
              <Field label="Expiry" placeholder="MM / YY" required />
              <Field label="CVC" placeholder="123" required />
            </div>
          </section>

          <button
            type="submit"
            disabled={placing}
            className="inline-flex h-12 w-full items-center justify-center rounded-full bg-foreground text-sm font-medium text-background transition hover:opacity-90 disabled:opacity-60"
          >
            {placing ? "Placing order…" : `Place order — $${total.toFixed(2)}`}
          </button>
          <button type="button" onClick={() => navigate({ to: "/cart" })} className="block w-full text-center text-sm text-muted-foreground hover:text-foreground">
            ← Back to cart
          </button>
        </form>

        <aside className="h-fit rounded-2xl border border-border bg-card p-6 shadow-soft">
          <h2 className="font-display text-xl font-semibold">Order summary</h2>
          <ul className="mt-4 divide-y divide-border">
            {items.map((item) => (
              <li key={item.id} className="flex gap-3 py-3">
                <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-muted">
                  <img src={item.image} alt={item.title} className="h-full w-full object-cover" />
                  <span className="absolute -right-1 -top-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-foreground px-1 text-[11px] font-medium text-background">
                    {item.quantity}
                  </span>
                </div>
                <div className="flex flex-1 items-center justify-between gap-2">
                  <p className="text-sm">{item.title}</p>
                  <p className="text-sm font-medium">${(item.price * item.quantity).toFixed(2)}</p>
                </div>
              </li>
            ))}
          </ul>
          <dl className="mt-6 space-y-2 text-sm">
            <div className="flex justify-between"><dt className="text-muted-foreground">Subtotal</dt><dd>${subtotal.toFixed(2)}</dd></div>
            <div className="flex justify-between"><dt className="text-muted-foreground">Shipping</dt><dd>{shipping === 0 ? "Free" : `$${shipping.toFixed(2)}`}</dd></div>
            <div className="my-2 h-px bg-border" />
            <div className="flex justify-between text-base font-medium"><dt>Total</dt><dd>${total.toFixed(2)}</dd></div>
          </dl>
        </aside>
      </div>
    </div>
  );
}

function Field({
  label,
  className = "",
  ...rest
}: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return (
    <label className={"flex flex-col gap-1.5 " + className}>
      <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</span>
      <input
        {...rest}
        className="h-11 rounded-lg border border-border bg-background px-3 text-sm outline-none transition focus:ring-2 focus:ring-ring"
      />
    </label>
  );
}
