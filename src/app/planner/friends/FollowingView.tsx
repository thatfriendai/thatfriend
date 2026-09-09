"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ExploreNav } from "@/components/planner/ExploreNav";

export interface PersonRow {
  id: string;
  name: string;
  username: string | null;
  publicTripCount: number;
  mutualFriendCount: number;
  metOn: string | null;
  followsYouBack: boolean;
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

function mutualFriendsPart(p: PersonRow) {
  return p.mutualFriendCount > 0 ? `${p.mutualFriendCount} mutual friend${p.mutualFriendCount === 1 ? "" : "s"}` : null;
}

/** "Started following you": mutual friends first, then how you crossed paths. */
function metContextLine(p: PersonRow) {
  return [mutualFriendsPart(p), p.metOn ? `met on ${p.metOn}` : null].filter(Boolean).join(" · ") || null;
}

/** "Following": handle first, then how active they are. */
function followingLine(p: PersonRow) {
  const parts = [
    p.username ? `@${p.username}` : null,
    `${p.publicTripCount} public trip${p.publicTripCount === 1 ? "" : "s"}`,
    p.followsYouBack ? "Follows you back" : null,
  ];
  return parts.filter(Boolean).join(" · ");
}

/** "People you've travelled with": the trip first, then mutual friends. */
function travelledWithLine(p: PersonRow) {
  return [p.metOn, mutualFriendsPart(p)].filter(Boolean).join(" · ") || null;
}

function Avatar({ name }: { name: string }) {
  return (
    <div
      className="flex h-10 w-10 flex-none items-center justify-center rounded-full text-[13px] text-on-accent"
      style={{ background: "var(--color-accent)" }}
    >
      {initialsOf(name)}
    </div>
  );
}

function FollowBackButton({ username, onDone }: { username: string; onDone: () => void }) {
  const [pending, setPending] = useState(false);
  return (
    <button
      type="button"
      disabled={pending}
      onClick={async () => {
        setPending(true);
        const res = await fetch(`/api/v2/users/${username}/follow`, { method: "POST" });
        setPending(false);
        if (res.ok) onDone();
      }}
      className="rounded-full bg-accent px-4 py-1.5 text-[13px] text-on-accent disabled:opacity-50"
    >
      {pending ? "…" : "Follow back"}
    </button>
  );
}

function FollowToggleButton({ username, following: initial, onChange }: { username: string; following: boolean; onChange: (v: boolean) => void }) {
  const [following, setFollowing] = useState(initial);
  const [pending, setPending] = useState(false);

  async function toggle() {
    const next = !following;
    setFollowing(next);
    setPending(true);
    const res = await fetch(`/api/v2/users/${username}/follow`, { method: next ? "POST" : "DELETE" });
    setPending(false);
    if (!res.ok) {
      setFollowing(!next);
      return;
    }
    onChange(next);
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={pending}
      className={`rounded-full px-4 py-1.5 text-[13px] disabled:opacity-50 ${
        following ? "border border-input-border bg-card text-ink" : "bg-accent text-on-accent"
      }`}
    >
      {pending ? "…" : following ? "Following" : "Follow"}
    </button>
  );
}

function PersonRowView({ person, caption, right }: { person: PersonRow; caption: string | null; right: React.ReactNode }) {
  const inner = (
    <>
      <Avatar name={person.name} />
      <div className="min-w-0 flex-1">
        <p className="text-[15px] text-ink-body">{person.name}</p>
        {caption && <p className="mt-0.5 truncate text-[12.5px] text-muted">{caption}</p>}
      </div>
    </>
  );
  return (
    <div className="flex items-center gap-3 px-5 py-3.5">
      {person.username ? (
        <Link href={`/planner/u/${person.username}`} className="flex min-w-0 flex-1 items-center gap-3 hover:opacity-80">
          {inner}
        </Link>
      ) : (
        <div className="flex min-w-0 flex-1 items-center gap-3">{inner}</div>
      )}
      <div className="flex-none">{right}</div>
    </div>
  );
}

export function FollowingView({
  startedFollowingYou: initialStarted,
  following: initialFollowing,
  followerCount,
  travelledWith: initialTravelledWith,
  viewerUsername,
  tripsAndSavedCount,
}: {
  startedFollowingYou: PersonRow[];
  following: PersonRow[];
  followerCount: number;
  travelledWith: PersonRow[];
  viewerUsername: string | null;
  tripsAndSavedCount: number;
}) {
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [following, setFollowing] = useState(initialFollowing);
  const [travelledWith, setTravelledWith] = useState(initialTravelledWith);
  const [query, setQuery] = useState("");

  const visibleStarted = initialStarted.filter((p) => !dismissed.has(p.id));

  const filteredFollowing = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return following;
    return following.filter((p) => p.name.toLowerCase().includes(q) || (p.username ?? "").toLowerCase().includes(q));
  }, [following, query]);

  const inviteHref = `sms:?&body=${encodeURIComponent(
    `Come plan trips with me on That Friend${viewerUsername ? ` — thatfriend.co/@${viewerUsername}` : ""}`
  )}`;

  return (
    <div className="min-h-screen">
      <header className="flex items-center gap-5 border-b border-border bg-card px-5 py-5 sm:px-10">
        <Link href="/planner/home" className="text-[23px] tracking-tight font-display text-ink">
          &ldquo;that friend&rdquo;
        </Link>
      </header>

      <div className="mx-auto max-w-[760px] px-6 py-10 pb-28 sm:px-10">
        <ExploreNav active="following" tripsAndSavedCount={tripsAndSavedCount} />

        <h1 className="mb-2 text-[42px] leading-[1.06] font-display tracking-tight text-ink">Following</h1>
        <p className="mb-8 max-w-[560px] text-[15px] leading-relaxed text-body">
          Following someone puts their public trips in your Explore feed. It&rsquo;s one-way — no request
          to accept, and they can follow you back or not.
        </p>

        <div className="mb-10 flex flex-col gap-3 sm:flex-row">
          <div className="flex flex-1 items-center gap-3 rounded-full border border-input-border bg-card px-5 py-3">
            <span className="text-muted" aria-hidden="true">
              🔍
            </span>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Find someone by name, @username, or phone"
              className="w-full bg-transparent text-[15px] text-ink outline-none placeholder:text-muted"
            />
          </div>
          <a
            href={inviteHref}
            className="whitespace-nowrap rounded-full bg-ink px-6 py-3 text-center text-[14.5px] text-cream hover:bg-accent"
          >
            Invite by text
          </a>
        </div>

        {visibleStarted.length > 0 && (
          <div className="mb-10">
            <p className="mb-3 font-mono text-[11px] tracking-[0.1em] text-muted uppercase">Started following you</p>
            <div className="overflow-hidden rounded-2xl border border-border bg-card">
              {visibleStarted.map((p, i) => (
                <div key={p.id} className={i > 0 ? "border-t border-border-soft" : ""}>
                  <PersonRowView
                    person={p}
                    caption={metContextLine(p)}
                    right={
                      <div className="flex items-center gap-3">
                        <FollowBackButton
                          username={p.username ?? ""}
                          onDone={() => {
                            setFollowing((list) => [p, ...list]);
                            setDismissed((s) => new Set(s).add(p.id));
                            setTravelledWith((list) => list.filter((x) => x.id !== p.id));
                          }}
                        />
                        <button
                          type="button"
                          onClick={() => setDismissed((s) => new Set(s).add(p.id))}
                          className="text-[12.5px] text-muted hover:text-ink"
                        >
                          Dismiss
                        </button>
                      </div>
                    }
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="mb-3 flex items-baseline justify-between">
          <p className="font-mono text-[11px] tracking-[0.1em] text-muted uppercase">
            Following &middot; {following.length}
          </p>
          <p className="font-mono text-[11px] tracking-[0.1em] text-faint uppercase">{followerCount} follow you</p>
        </div>

        {filteredFollowing.length === 0 ? (
          <p className="mb-10 text-[14px] text-muted">
            {query ? "Nothing matches that search." : "You're not following anyone yet."}
          </p>
        ) : (
          <div className="mb-10 overflow-hidden rounded-2xl border border-border bg-card">
            {filteredFollowing.map((p, i) => (
              <div key={p.id} className={i > 0 ? "border-t border-border-soft" : ""}>
                <PersonRowView
                  person={p}
                  caption={followingLine(p)}
                  right={
                    <FollowToggleButton
                      username={p.username ?? ""}
                      following
                      onChange={(v) => {
                        if (!v) setFollowing((list) => list.filter((x) => x.id !== p.id));
                      }}
                    />
                  }
                />
              </div>
            ))}
          </div>
        )}

        {travelledWith.length > 0 && (
          <div>
            <p className="mb-3 font-mono text-[11px] tracking-[0.1em] text-muted uppercase">
              People you&rsquo;ve travelled with
            </p>
            <div className="overflow-hidden rounded-2xl border border-border bg-card">
              {travelledWith.map((p, i) => (
                <div key={p.id} className={i > 0 ? "border-t border-border-soft" : ""}>
                  <PersonRowView
                    person={p}
                    caption={travelledWithLine(p)}
                    right={
                      <FollowToggleButton
                        username={p.username ?? ""}
                        following={false}
                        onChange={(v) => {
                          if (v) setTravelledWith((list) => list.filter((x) => x.id !== p.id));
                        }}
                      />
                    }
                  />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
