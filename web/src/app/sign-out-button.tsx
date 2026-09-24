import { signOut } from "@/app/login/actions";

export function SignOutButton() {
  return (
    <form action={signOut}>
      <button type="submit" className="text-sm text-stone-500 underline">
        Sign out
      </button>
    </form>
  );
}
