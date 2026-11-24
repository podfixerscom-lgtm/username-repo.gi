import type { Metadata } from "next";
import { CartContents } from "./cart-contents";

export const metadata: Metadata = { title: "আপনার কার্ট" };

export default function CartPage() {
  return (
    <section aria-labelledby="cart-title">
      <h1 id="cart-title">আপনার কার্ট</h1>
      <CartContents />
    </section>
  );
}
