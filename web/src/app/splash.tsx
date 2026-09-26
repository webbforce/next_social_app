import Link from "next/link";
import { SaveAccount } from "@/app/save-account";

export function Splash() {
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
        <SaveAccount next="/" appearance="splash" allowPhone />
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
