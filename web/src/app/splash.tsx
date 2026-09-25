"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { recordSignupCompleted, recordSignupStarted } from "@/app/login/actions";
import { otpError, parsePhone } from "@/lib/phone";
import { createClient } from "@/lib/supabase/client";

const CLAIM_KEY = "upfor.signupClaim";

export function Splash() {
  const router = useRouter();
  const [step, setStep] = useState<"phone" | "code">("phone");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [claimingGuest, setClaimingGuest] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const supabase = createClient();

  function sendCode(e: React.FormEvent) {
    e.preventDefault();
    const parsed = parsePhone(phone);
    if (!parsed.ok) {
      setError(parsed.error);
      return;
    }
    const normalized = parsed.phone;
    setError(null);
    startTransition(async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user?.is_anonymous) {
        const { error } = await supabase.auth.updateUser({ phone: normalized });
        if (!error) {
          setClaimingGuest(true);
          setPhone(normalized);
          setStep("code");
          void recordSignupStarted("direct");
          return;
        }
        if (error.code !== "phone_exists") {
          setError(otpError(error.message));
          return;
        }
      }

      const { error } = await supabase.auth.signInWithOtp({ phone: normalized });
      if (error) {
        setError(otpError(error.message));
        return;
      }
      setClaimingGuest(false);
      setPhone(normalized);
      setStep("code");
      void recordSignupStarted("direct");
    });
  }

  function verifyCode(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const { data, error } = await supabase.auth.verifyOtp({
        phone,
        token: code.trim(),
        type: claimingGuest ? "phone_change" : "sms",
      });
      if (error || !data.user) {
        setError(error?.message ?? "That code didn't work. Try again.");
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("is_18_plus_confirmed")
        .eq("id", data.user.id)
        .maybeSingle();

      if (profile?.is_18_plus_confirmed) {
        await recordSignupCompleted("direct", claimingGuest);
        router.replace("/");
        router.refresh();
        return;
      }

      sessionStorage.setItem(CLAIM_KEY, claimingGuest ? "1" : "0");
      router.replace("/");
      router.refresh();
    });
  }

  return (
    <main className="fixed inset-0 z-10 flex flex-col justify-end overflow-y-auto">
      {/* The optimizer on this drive serves the macOS ._ sidecar, so the photo never loads. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/splash.jpg" alt="" className="absolute inset-0 h-full w-full object-cover object-[center_20%]" />
      <div className="absolute inset-0 bg-[linear-gradient(to_top,rgba(11,11,11,0.88)_0%,rgba(11,11,11,0.45)_32%,transparent_58%)]" />
      <div className="relative mx-auto flex w-full max-w-md flex-col items-center gap-4 px-5 pt-16 pb-8">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/wordmark.png" alt="upFor" className="h-auto w-[78%]" />
        <p className="text-lg text-white">Make it happen.</p>
        {step === "phone" ? (
          <form onSubmit={sendCode} className="flex w-full flex-col gap-3">
            <label className="sr-only" htmlFor="splash-phone">
              Mobile number
            </label>
            <input
              id="splash-phone"
              className="input"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              placeholder="06 1234 5678"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              required
              autoFocus
            />
            {error && <p className="text-sm text-white">{error}</p>}
            <button className="btn w-full bg-up text-ink active:bg-[#b6ef22]" disabled={pending}>
              {pending ? "Sending…" : "Text me a code"}
            </button>
          </form>
        ) : (
          <form onSubmit={verifyCode} className="flex w-full flex-col gap-3">
            <p className="text-center text-sm text-white/80">We sent a 6-digit code to {phone}.</p>
            <label className="sr-only" htmlFor="splash-code">
              Code
            </label>
            <input
              id="splash-code"
              className="input text-center text-2xl tracking-[0.4em]"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="\d{6}"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              required
              autoFocus
            />
            {error && <p className="text-sm text-white">{error}</p>}
            <button className="btn w-full bg-up text-ink active:bg-[#b6ef22]" disabled={pending || code.length !== 6}>
              {pending ? "Checking…" : "Continue"}
            </button>
            <button
              type="button"
              className="text-sm text-white/80 underline"
              onClick={() => {
                setCode("");
                setError(null);
                setStep("phone");
              }}
            >
              Use a different number
            </button>
          </form>
        )}
        <p className="text-center text-xs text-white/80">
          By continuing, you agree to our{" "}
          <Link href="/privacy" className="underline">
            Privacy Policy
          </Link>
          .
        </p>
      </div>
    </main>
  );
}
