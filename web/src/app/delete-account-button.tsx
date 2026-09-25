"use client";

import { useTransition } from "react";
import { deleteAccount } from "@/app/login/actions";

export function DeleteAccountButton() {
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      className="text-sm text-stone-500 underline disabled:opacity-50"
      disabled={pending}
      onClick={() => {
        if (
          !confirm(
            "Delete your account? Your name comes off plans now, and upcoming plans you host are cancelled. Recaps that include you are taken down and rebuilt without you. Photos you uploaded, and a phone number on this account, are erased within 30 days.",
          )
        ) {
          return;
        }
        startTransition(async () => {
          const { error } = await deleteAccount();
          if (error) alert(error);
        });
      }}
    >
      {pending ? "Deleting…" : "Delete account"}
    </button>
  );
}
