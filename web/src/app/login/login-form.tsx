"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { PhotoField } from "@/components/photo-field";
import { createClient } from "@/lib/supabase/client";
import { uploadAvatarFile } from "@/lib/upload-avatar";
import { recordSignupCompleted, recordSignupStarted } from "./actions";

type Step = "phone" | "code" | "profile";

const PHONE_HINT = "Dutch mobiles are 06 plus 8 digits, like 06 1234 5678.";

function signupEntry(next: string): "direct" | "plan_page" | "episode_page" | "public_episode" {
  const from = new URLSearchParams(next.split("?")[1] ?? "").get("from");
  if (from === "public_episode") return "public_episode";
  if (from === "episode") return "episode_page";
  if (from === "plan_page" || next.startsWith("/p/")) return "plan_page";
  return "direct";
}

function otpError(message: string) {
  const text = message.toLowerCase();
  if (
    (text.includes("invalid") && text.includes("phone")) ||
    text.includes("not a valid phone")
  ) {
    return PHONE_HINT;
  }
  if (
    text.includes("unsupported phone") ||
    text.includes("phone provider") ||
    text.includes("sms provider") ||
    text.includes("twilio") ||
    (text.includes("sending") && text.includes("sms"))
  ) {
    return `We couldn't send a code. ${message}`;
  }
  return message;
}

// 06 1234 5678, 0031 6…, +31 6… — Dutch mobiles are +316 and eight more digits.
function parsePhone(raw: string): { ok: true; phone: string } | { ok: false; error: string } {
  const digits = raw.replace(/[\s\-().]/g, "");
  let phone: string;
  if (digits.startsWith("00")) phone = `+${digits.slice(2)}`;
  else if (digits.startsWith("+")) phone = digits;
  else if (/^06\d{8}$/.test(digits)) phone = `+31${digits.slice(1)}`;
  else if (digits.startsWith("31") && digits.length >= 11) phone = `+${digits}`;
  else if (digits.startsWith("0")) phone = `+31${digits.slice(1)}`;
  else if (/^\d{8,15}$/.test(digits)) phone = `+${digits}`;
  else return { ok: false, error: PHONE_HINT };

  if (phone.startsWith("+31")) {
    return /^\+316\d{8}$/.test(phone) ? { ok: true, phone } : { ok: false, error: PHONE_HINT };
  }
  return /^\+\d{8,15}$/.test(phone) ? { ok: true, phone } : { ok: false, error: PHONE_HINT };
}

export function LoginForm({
  next,
  campuses,
  signedInAsHost,
  guestFirstName,
}: {
  next: string;
  campuses: { id: string; name: string }[];
  signedInAsHost: boolean;
  guestFirstName: string;
}) {
  const router = useRouter();
  const [step, setStep] = useState<Step>(signedInAsHost ? "profile" : "phone");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [firstName, setFirstName] = useState(guestFirstName);
  const [confirmed18, setConfirmed18] = useState(false);
  const [campusId, setCampusId] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  // A guest's anonymous account is upgraded in place so their plans and photos carry over.
  const [claimingGuest, setClaimingGuest] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const entry = signupEntry(next);
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
          void recordSignupStarted(entry);
          return;
        }
        // The number already belongs to a host account: sign in to that one instead.
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
      void recordSignupStarted(entry);
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
        .select("first_name, is_18_plus_confirmed")
        .eq("id", data.user.id)
        .maybeSingle();

      if (profile?.is_18_plus_confirmed) {
        await recordSignupCompleted(entry, claimingGuest);
        router.replace(next);
        router.refresh();
        return;
      }
      if (profile?.first_name) setFirstName(profile.first_name);
      setStep("profile");
    });
  }

  function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setStep("phone");
        return;
      }
      let photoPath: string | undefined;
      if (photo) {
        try {
          photoPath = await uploadAvatarFile(user.id, photo);
        } catch (err) {
          setError(err instanceof Error ? err.message : "Couldn't save that photo.");
          return;
        }
      }
      const { error } = await supabase.from("profiles").upsert({
        id: user.id,
        first_name: firstName.trim(),
        is_18_plus_confirmed: true,
        campus_id: campusId || null,
        ...(photoPath ? { photo_path: photoPath } : {}),
      });
      if (error) {
        setError(error.message);
        return;
      }
      await recordSignupCompleted(entry, claimingGuest);
      router.replace(next);
      router.refresh();
    });
  }

  if (step === "phone") {
    return (
      <form onSubmit={sendCode} className="flex flex-col gap-4">
        <h1 className="text-3xl font-bold tracking-tight">What&apos;s your number?</h1>
        <p className="text-stone-600">
          Hosts sign in with their phone. We text you a code, nothing else.
        </p>
        <input
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
        {error && <p className="text-sm text-red-700">{error}</p>}
        <button className="btn-primary" disabled={pending}>
          {pending ? "Sending…" : "Text me a code"}
        </button>
      </form>
    );
  }

  if (step === "code") {
    return (
      <form onSubmit={verifyCode} className="flex flex-col gap-4">
        <h1 className="text-3xl font-bold tracking-tight">Enter the code</h1>
        <p className="text-stone-600">We sent a 6-digit code to {phone}.</p>
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
            setStep("phone");
          }}
        >
          Use a different number
        </button>
      </form>
    );
  }

  return (
    <form onSubmit={saveProfile} className="flex flex-col gap-4">
      <h1 className="text-3xl font-bold tracking-tight">Almost done</h1>
      <label className="flex flex-col gap-2">
        <span className="text-sm font-medium">First name</span>
        <input
          className="input"
          autoComplete="given-name"
          maxLength={40}
          value={firstName}
          onChange={(e) => setFirstName(e.target.value)}
          required
          autoFocus
        />
      </label>
      <PhotoField onFile={setPhoto} />
      {campuses.length > 0 && (
        <label className="flex flex-col gap-2">
          <span className="text-sm font-medium">Campus (optional)</span>
          <select className="input" value={campusId} onChange={(e) => setCampusId(e.target.value)}>
            <option value="">Skip</option>
            {campuses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
      )}
      <label className="flex items-start gap-3 text-sm">
        <input
          type="checkbox"
          className="mt-0.5 size-5"
          checked={confirmed18}
          onChange={(e) => setConfirmed18(e.target.checked)}
          required
        />
        <span>I&apos;m 18 or older</span>
      </label>
      {error && <p className="text-sm text-red-700">{error}</p>}
      <button className="btn-primary" disabled={pending || !firstName.trim() || !confirmed18}>
        {pending ? "Saving…" : "Done"}
      </button>
    </form>
  );
}
