"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function FollowButton({ username, initialFollowing }: { username: string; initialFollowing: boolean }) {
  const router = useRouter();
  const [following, setFollowing] = useState(initialFollowing);
  const [pending, setPending] = useState(false);

  async function toggle() {
    setPending(true);
    const res = await fetch(`/api/v2/users/${username}/follow`, { method: following ? "DELETE" : "POST" });
    setPending(false);
    if (!res.ok) {
      router.push("/planner/login");
      return;
    }
    setFollowing((v) => !v);
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={pending}
      className={`rounded-full px-6 py-2.5 text-[14px] disabled:opacity-50 ${
        following ? "border border-input-border bg-card text-ink" : "bg-accent text-cream"
      }`}
    >
      {pending ? "…" : following ? "Following" : "Follow"}
    </button>
  );
}
