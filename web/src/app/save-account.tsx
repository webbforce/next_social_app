"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { recordSignupCompleted, recordSignupStarted } from "@/app/login/actions";
import { createClient } from "@/lib/supabase/client";

type Provider = "apple" | "google";

function providerProblem(message: string) {
  const text = message.toLowerCase();
  if (text.includes("not enabled") || text.includes("unsupported provider")) {
    return "That sign-in isn't turned on yet. Use email for now.";
  }
  return message;
}

function validEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export function SaveAccount({
  next,
  title = "Save your account",
  detail = "Apple, Google, or an email code. No phone number.",
  allowPhone = false,
}: {
  next: string;
  title?: string;
  detail?: string;
  allowPhone?: boolean;
}) {
  const router = useRouter();
  const [step, setStep] = useState<"choose" | "code">("choose");
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
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      const options = { redirectTo: redirectTo() };
      const { error } = user?.is_anonymous
        ? await supabase.auth.linkIdentity({ provider, options })
        : await supabase.auth.signInWithOAuth({ provider, options });
      if (error) setError(providerProblem(error.message));
      else void recordSignupStarted("direct");
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

  if (step === "code") {
    return (
      <form onSubmit={verifyEmail} className="flex flex-col gap-4">
        <h2 className="font-display text-2xl font-bold tracking-tight">Enter the code</h2>
        <p className="text-stone-600">We emailed a 6-digit code to {email}.</p>
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
        {error && <p className="text-sm text-red-700">{error}</p>}
        <button className="btn-primary" disabled={pending || code.length !== 6}>
          {pending ? "Checking…" : "Continue"}
        </button>
        <button
          type="button"
          className="text-sm text-stone-600 underline"
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
    <section className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <h2 className="font-display text-2xl font-bold tracking-tight">{title}</h2>
        <p className="text-stone-600">{detail}</p>
      </div>
      <button type="button" className="btn-primary" disabled={pending} onClick={() => useProvider("apple")}>
        Continue with Apple
      </button>
      <button type="button" className="btn-secondary" disabled={pending} onClick={() => useProvider("google")}>
        Continue with Google
      </button>
      <form onSubmit={sendEmail} className="flex flex-col gap-3">
        <label className="flex flex-col gap-2">
          <span className="text-sm font-medium">Email a code</span>
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
        {error && <p className="text-sm text-red-700">{error}</p>}
        <button className="btn-secondary" disabled={pending}>
          {pending ? "Sending…" : "Email me a code"}
        </button>
      </form>
      {allowPhone && (
        <Link href={`/login?method=phone&next=${encodeURIComponent(next)}`} className="text-center text-sm text-stone-500 underline">
          I already signed in with a phone number
        </Link>
      )}
    </section>
  );
}
