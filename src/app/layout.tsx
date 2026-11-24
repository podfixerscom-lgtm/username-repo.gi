import type { Metadata } from "next";
import { RouteFocusManager } from "@/components/route-focus-manager";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Crazy Cart",
    template: "%s | Crazy Cart",
  },
  description: "Crazy Cart-এর স্টোরফ্রন্ট ও অপারেশনস প্ল্যাটফর্ম।",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="bn">
      <body>
        <a className="skip-link" href="#main-content">
          মূল কনটেন্টে যান
        </a>
        <RouteFocusManager />
        {children}
      </body>
    </html>
  );
}
