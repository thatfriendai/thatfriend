"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

export interface ProfilePersonRow {
  id: string;
  name: string;
  username: string | null;
  publicTripCount: number;
  /** Does this person and the profile owner follow each other? */
  mutual: boolean;
  /** Does the current viewer (or the owner, when isSelf) already follow this person? */
  viewerFollowsInitial: boolean;
}

function initialsOf(name: string) {
  return (
    name
      .split(/\s+/)
      .map((p) => p[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "?"
  );
}

function FollowToggle({ username, initial }: { username: string; initial: boolean }) {
  const [following, setFollowing] = useState(initial);
  const [pending, setPending] = useState(false);

  async function toggle() {
    const next = !following;
    setFollowing(next);
    setPending(true);
    const res = await fetch(`/api/v2/users/${username}/follow`, { method: next ? "POST" : "DELETE" });
    setPending(false);
    if (!res.ok) setFollowing(!next);
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={pending || !username}
      className={`flex-none rounded-full px-4 py-1.5 text-[13.5px] transition-colors disabled:opacity-50 ${
        following ? "border border-input-border bg-card text-ink-soft" : "bg-accent text-on-accent"
      }`}
    >
      {pending ? "…" : following ? "Following" : "Follow"}
    </button>
  );
}

export function PeoplePanel({
  isSelf,
  firstName,
  initialTab,
  followers,
  following,
  followersCount,
  followingCount,
  viewerCanFollow,
  onClose,
}: {
  isSelf: boolean;
  firstName: string;
  initialTab: "followers" | "following";
  followers: ProfilePersonRow[];
  following: ProfilePersonRow[];
  followersCount: number;
  followingCount: number;
  viewerCanFollow: boolean;
  onClose: () => void;
}) {
  const [tab, setTab] = useState(initialTab);
  const [query, setQuery] = useState("");

  const list = tab === "followers" ? followers : following;
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return list;
    return list.filter((p) => p.name.toLowerCase().includes(q) || (p.username ?? "").toLowerCase().includes(q));
  }, [list, query]);

  const subtitle =
    tab === "followers"
      ? isSelf
        ? "People who see your public trips in their Explore."
        : `People who follow ${firstName}.`
      : isSelf
        ? "Their public trips show up in your Explore. Following is one-way — nothing to accept."
        : `People whose trips ${firstName} follows.`;

  return (
    <div className="mt-5 overflow-hidden rounded-2xl border border-border bg-card">
      <div className="flex flex-wrap items-center gap-3.5 border-b border-border-soft px-4.5 py-3">
        <div className="flex items-center gap-1 rounded-full border border-border p-1">
          <button
            type="button"
            onClick={() => setTab("followers")}
            className={`rounded-full px-4 py-1.5 text-[13.5px] ${tab === "followers" ? "bg-ink text-cream" : "text-ink-soft"}`}
          >
            Followers · {followersCount}
          </button>
          <button
            type="button"
            onClick={() => setTab("following")}
            className={`rounded-full px-4 py-1.5 text-[13.5px] ${tab === "following" ? "bg-ink text-cream" : "text-ink-soft"}`}
          >
            Following · {followingCount}
          </button>
        </div>
        <span className="min-w-[180px] flex-1 text-[13.5px] text-muted">{subtitle}</span>
        <button type="button" onClick={onClose} className="flex-none px-1 text-[13.5px] text-muted hover:text-ink">
          Close
        </button>
      </div>

      {isSelf && (
        <div className="flex items-center gap-2.5 border-b border-border-soft px-4 py-2.5">
          <span className="text-muted" aria-hidden="true">
            🔍
          </span>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Find someone by name, @username, or phone"
            className="min-w-0 flex-1 bg-transparent py-1 text-[15px] text-ink outline-none placeholder:text-muted"
          />
          <button type="button" onClick={() => {}} className="flex-none rounded-full bg-ink px-4 py-2 text-[13.5px] text-cream">
            Invite by text
          </button>
        </div>
      )}

      <div className="px-2 py-2">
        {filtered.length === 0 ? (
          <p className="px-4 py-8 text-center text-[15px] text-muted">No one matches that.</p>
        ) : (
          filtered.map((p) => {
            const meta = [
              p.username ? `@${p.username}` : null,
              `${p.publicTripCount} public trip${p.publicTripCount === 1 ? "" : "s"}`,
              p.mutual ? (isSelf ? "follows you back" : "follows back") : null,
            ]
              .filter(Boolean)
              .join(" · ");
            return (
              <div key={p.id} className="flex flex-wrap items-center gap-3.5 border-b border-border-soft px-3 py-3 last:border-b-0">
                <div
                  className="flex h-8.5 w-8.5 flex-none items-center justify-center rounded-full text-[12px] text-on-accent"
                  style={{ background: "var(--color-accent)" }}
                >
                  {initialsOf(p.name)}
                </div>
                <div className="min-w-0 flex-1">
                  {p.username ? (
                    <Link href={`/planner/u/${p.username}`} className="block hover:opacity-80">
                      <div className="truncate text-[15.5px] text-ink-body">{p.name}</div>
                      <div className="truncate text-[13px] text-muted">{meta}</div>
                    </Link>
                  ) : (
                    <>
                      <div className="truncate text-[15.5px] text-ink-body">{p.name}</div>
                      <div className="truncate text-[13px] text-muted">{meta}</div>
                    </>
                  )}
                </div>
                {viewerCanFollow ? (
                  <FollowToggle username={p.username ?? ""} initial={p.viewerFollowsInitial} />
                ) : (
                  <Link href="/planner/login" className="flex-none text-[12.5px] text-muted hover:text-accent">
                    Sign in to follow
                  </Link>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
