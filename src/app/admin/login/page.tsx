import Link from "next/link";
import type { Metadata } from "next";
import { LoginForm } from "./login-form";

export const metadata: Metadata = {
  title: "স্টাফ লগইন",
};

export default function AdminLoginPage() {
  return (
    <main className="login-page" id="main-content" tabIndex={-1}>
      <section className="login-card" aria-labelledby="login-title">
        <p className="login-brand">Crazy Cart · Operations</p>
        <h1 id="login-title">স্টাফ লগইন</h1>
        <p className="login-intro">
          অ্যাডমিন ও অনুমোদিত স্টাফদের জন্য নিরাপদ প্রবেশ।
        </p>
        <LoginForm />
        <Link className="login-back" href="/">
          স্টোরফ্রন্টে ফিরে যান
        </Link>
      </section>
    </main>
  );
}
