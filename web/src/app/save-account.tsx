"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { recordSignupCompleted, recordSignupStarted } from "@/app/login/actions";
import { createClient } from "@/lib/supabase/client";
import { supabaseAnonKey, supabaseUrl } from "@/lib/supabase/env";

type Provider = "apple" | "google";

const PROVIDER_OFF = "That sign-in isn't turned on yet. Use email for now.";

function providerProblem(message: string) {
  const text = message.toLowerCase();
  if (text.includes("not enabled") || text.includes("unsupported provider") || text.includes("validation_failed")) {
    return PROVIDER_OFF;
  }
  return message;
}

async function providerEnabled(provider: Provider) {
  const response = await fetch(`${supabaseUrl}/auth/v1/settings`, {
    headers: { apikey: supabaseAnonKey },
  });
  if (!response.ok) return false;
  const settings = (await response.json()) as { external?: Record<string, boolean> };
  return settings.external?.[provider] === true;
}

function validEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export function SaveAccount({
  next,
  title = "Save your account",
  detail = "Apple, Google, or an email code. No phone number.",
  allowPhone = false,
  appearance = "plain",
}: {
  next: string;
  title?: string;
  detail?: string;
  allowPhone?: boolean;
  appearance?: "plain" | "splash";
}) {
  const router = useRouter();
  const [step, setStep] = useState<"choose" | "code">("choose");
  const [emailOpen, setEmailOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [upgrading, setUpgrading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function redirectTo() {
    return `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;
  }

  function useProvider(provider: Provider) {
    setError(null);
    startTransition(async () => {
      if (!(await providerEnabled(provider))) {
        setEmailOpen(true);
        setError(PROVIDER_OFF);
        return;
      }
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      const options = { redirectTo: redirectTo(), skipBrowserRedirect: true };
      const { data, error } = user?.is_anonymous
        ? await supabase.auth.linkIdentity({ provider, options })
        : await supabase.auth.signInWithOAuth({ provider, options });
      if (error || !data?.url) {
        setEmailOpen(true);
        setError(providerProblem(error?.message ?? PROVIDER_OFF));
        return;
      }
      void recordSignupStarted("direct");
      window.location.assign(data.url);
    });
  }

  function sendEmail(e: React.FormEvent) {
    e.preventDefault();
    const address = email.trim().toLowerCase();
    if (!validEmail(address)) {
      setError("Enter a valid email address.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user?.is_anonymous) {
        const { error } = await supabase.auth.updateUser({ email: address });
        if (error) {
          setError(providerProblem(error.message));
          return;
        }
        setUpgrading(true);
      } else {
        const { error } = await supabase.auth.signInWithOtp({
          email: address,
          options: { shouldCreateUser: true },
        });
        if (error) {
          setError(providerProblem(error.message));
          return;
        }
        setUpgrading(false);
      }
      setEmail(address);
      setStep("code");
      void recordSignupStarted("direct");
    });
  }

  function verifyEmail(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const supabase = createClient();
      const { data, error } = await supabase.auth.verifyOtp({
        email,
        token: code.trim(),
        type: upgrading ? "email_change" : "email",
      });
      if (error || !data.user) {
        setError(error?.message ?? "That code didn't work. Try again.");
        return;
      }
      if (!data.user.is_anonymous) await recordSignupCompleted("direct", upgrading);
      router.replace(next);
      router.refresh();
    });
  }

  const splash = appearance === "splash";

  if (step === "code") {
    return (
      <form onSubmit={verifyEmail} className="flex w-full flex-col gap-4">
        <h2 className={`font-display text-2xl font-bold tracking-tight ${splash ? "text-white" : ""}`}>Enter the code</h2>
        <p className={splash ? "text-white/80" : "text-stone-600"}>We emailed a 6-digit code to {email}.</p>
        <input
          className="input text-center text-2xl tracking-[0.4em]"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="\d{6}"
          maxLength={6}
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
          required
          autoFocus
          aria-label="Code"
        />
        {error && <p className={`text-sm ${splash ? "text-red-200" : "text-red-700"}`}>{error}</p>}
        <button className={splash ? "btn w-full bg-white text-ink" : "btn-primary"} disabled={pending || code.length !== 6}>
          {pending ? "Checking…" : "Continue"}
        </button>
        <button
          type="button"
          className={`text-sm underline ${splash ? "text-white/80" : "text-stone-600"}`}
          onClick={() => {
            setCode("");
            setError(null);
            setStep("choose");
          }}
        >
          Use a different email
        </button>
      </form>
    );
  }

  return (
    <section className="flex w-full flex-col gap-4">
      {!splash && (
        <div className="flex flex-col gap-2">
          <h2 className="font-display text-2xl font-bold tracking-tight">{title}</h2>
          <p className="text-stone-600">{detail}</p>
        </div>
      )}
      <button
        type="button"
        className={splash ? "btn w-full bg-white text-ink active:bg-stone-100" : "btn-primary"}
        disabled={pending}
        onClick={() => useProvider("apple")}
      >
        Continue with Apple
      </button>
      <button
        type="button"
        className={splash ? "btn w-full border border-white/50 bg-transparent text-white active:bg-white/10" : "btn-secondary"}
        disabled={pending}
        onClick={() => useProvider("google")}
      >
        Continue with Google
      </button>
      {splash && !emailOpen ? (
        <button type="button" className="text-sm text-white/80 underline" onClick={() => setEmailOpen(true)}>
          Email a code instead
        </button>
      ) : (
        <form onSubmit={sendEmail} className="flex flex-col gap-3">
          <label className="flex flex-col gap-2">
            <span className={`text-sm font-medium ${splash ? "text-white" : ""}`}>Email a code</span>
            <input
              className="input"
              type="email"
              autoComplete="email"
              inputMode="email"
              placeholder="you@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </label>
          <button className="btn-secondary w-full" disabled={pending}>
            {pending ? "Sending…" : "Email me a code"}
          </button>
        </form>
      )}
      {error && step === "choose" && (
        <p className={`text-sm ${splash ? "text-center text-red-200" : "text-red-700"}`}>{error}</p>
      )}
      {allowPhone && (
        <Link
          href={`/login?method=phone&next=${encodeURIComponent(next)}`}
          className={`text-center text-sm underline ${splash ? "text-white/70" : "text-stone-500"}`}
        >
          I already signed in with a phone number
        </Link>
      )}
    </section>
  );
}
