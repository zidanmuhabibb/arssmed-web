"use client";

import { LogOut } from "lucide-react";
import { useTransition } from "react";
import { signOutAction } from "@/app/actions/auth";

export function SignOutButton({ label, className }: { label: string; className: string }) {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      className={className}
      onClick={() =>
        start(async () => {
          const to = await signOutAction();
          window.location.replace(to);
        })
      }
    >
      <LogOut aria-hidden="true" className="size-5" />
      {label}
    </button>
  );
}
