"use client";

import { useActionState, useEffect, useRef } from "react";
import { authenticate } from "./actions";

export function LoginForm() {
  const [state, formAction, isPending] = useActionState(authenticate, {});
  const errorRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    if (state.error) {
      errorRef.current?.focus();
    }
  }, [state]);

  return (
    <form className="login-form" action={formAction}>
      <div className="login-field">
        <label htmlFor="email">ইমেইল (আবশ্যক)</label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          aria-describedby={state.error ? "login-error" : undefined}
          required
        />
      </div>

      <div className="login-field">
        <label htmlFor="password">পাসওয়ার্ড (আবশ্যক)</label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          aria-describedby={state.error ? "login-error" : undefined}
          required
        />
      </div>

      {state.error ? (
        <p
          ref={errorRef}
          className="login-error"
          id="login-error"
          role="alert"
          tabIndex={-1}
        >
          {state.error}
        </p>
      ) : null}

      <p className="visually-hidden" role="status">
        {isPending ? "আপনার তথ্য যাচাই করা হচ্ছে।" : ""}
      </p>
      <button className="login-submit" type="submit" disabled={isPending}>
        {isPending ? "সাইন ইন হচ্ছে…" : "সাইন ইন"}
      </button>
    </form>
  );
}
