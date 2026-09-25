import type { Metadata } from "next";
import { BrandLink } from "@/components/brand";

export const metadata: Metadata = { title: "Privacy" };

export default function PrivacyPage() {
  return (
    <main className="flex flex-1 flex-col gap-6 py-10">
      <BrandLink />
      <h1 className="text-3xl font-bold tracking-tight">Privacy</h1>
      <p className="text-lg text-stone-600">
        upFor keeps what a plan needs, and tells you where else a place or a pin goes.
      </p>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">Phone number</h2>
        <p className="text-stone-700">
          Hosts sign in with a code sent to their phone. The code is sent by the sign-in provider.
          Guests join from the plan link and are not asked for a number.
        </p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">Name, photo, and pictures</h2>
        <p className="text-stone-700">
          Your first name and profile photo are shown to people on a plan with you. Photos you add
          are visible to people who are in or maybe on that plan. You can remove your own photos.
          The host can remove any.
        </p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">Place and pin</h2>
        <p className="text-stone-700">
          A host can type a place. If they search, those words are sent to OpenStreetMap. If they
          share a pin, opening it sends the coordinates to Apple Maps or Google Maps.
        </p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">Recaps</h2>
        <p className="text-stone-700">
          A recap stays with the people on the plan. A public link exists only if someone on the
          plan creates one. Deleting your account takes that recap down and rebuilds it without you.
        </p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">How long it stays</h2>
        <p className="text-stone-700">
          Delete account and your name comes off plans now. Upcoming plans you host are cancelled.
          Photos you uploaded, your profile photo, and a host phone number are erased within 30
          days, including the phone record used to sign in. I&apos;m free expires at 04:00, or when
          you clear it.
        </p>
        <p className="text-stone-700">
          Updates you wrote, and events tied to your account, are deleted when you delete the
          account. Reports you filed are deleted too. A report someone else filed can be kept with
          your details removed, so it can still be reviewed.
        </p>
      </section>
    </main>
  );
}
