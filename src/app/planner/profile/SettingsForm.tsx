"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { DigestFrequency, PlannerUser } from "@/lib/supabase/planner-types";
import { formatPhoneDisplay } from "@/lib/planner/phone";
import { Toggle } from "@/components/planner/Toggle";
import { signOut } from "../actions";
import { AvatarUploader } from "./AvatarUploader";
import { EmailChangePanel } from "./EmailChangePanel";
import { PhoneLinkPanel } from "./PhoneLinkPanel";
import { DeleteAccountPanel } from "./DeleteAccountPanel";

const DIGEST_OPTIONS: { value: DigestFrequency; label: string; hint: string }[] = [
  { value: "instant", label: "Right away", hint: "As things happen" },
  { value: "daily", label: "Daily digest", hint: "One summary a day" },
  { value: "weekly", label: "Weekly digest", hint: "Mondays" },
  { value: "urgent", label: "Only urgent", hint: "Deadlines and payments" },
];

function fieldsOf(u: PlannerUser) {
  return {
    name: u.name ?? "",
    username: u.username ?? "",
    location: u.location ?? "",
    tagline: u.tagline ?? "",
    isPublicProfile: u.is_public,
    notifySms: u.notify_sms,
    notifyEmail: u.notify_email,
    notifyInapp: u.notify_inapp,
    digestFrequency: u.digest_frequency,
    defaultTripPublic: u.default_trip_public,
  };
}

type Fields = ReturnType<typeof fieldsOf>;

function previewCopy(f: Fields) {
  const channels = [f.notifySms && "text", f.notifyEmail && "email"].filter(Boolean) as string[];
  if (channels.length === 0) {
    return `With text and email off, nudges like "four of six have picked dates" only show up in the app.`;
  }
  const timing =
    f.digestFrequency === "instant"
      ? "right away"
      : f.digestFrequency === "daily"
        ? "in tomorrow's digest"
        : f.digestFrequency === "weekly"
          ? "in Monday's digest"
          : "only if it's urgent";
  return `Four of six have picked dates for Lisbon — you'd get this by ${channels.join(" and ")}, ${timing}.`;
}

export function SettingsForm({ user }: { user: PlannerUser }) {
  const [saved, setSaved] = useState(fieldsOf(user));
  const [fields, setFields] = useState(saved);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checkedUsername, setCheckedUsername] = useState<{ name: string; available: boolean } | null>(null);

  const dirty = JSON.stringify(fields) !== JSON.stringify(saved);
  const usernameUnchanged = fields.username === saved.username;
  const usernameEmpty = !fields.username.trim();
  const checkingUsername = !usernameUnchanged && !usernameEmpty && checkedUsername?.name !== fields.username;
  const usernameAvailable = usernameUnchanged
    ? true
    : usernameEmpty
      ? null
      : checkedUsername?.name === fields.username
        ? checkedUsername.available
        : null;

  function set<K extends keyof Fields>(key: K, value: Fields[K]) {
    setFields((f) => ({ ...f, [key]: value }));
  }

  useEffect(() => {
    if (usernameUnchanged || usernameEmpty) return;
    const candidate = fields.username;
    const timer = setTimeout(async () => {
      const res = await fetch(`/api/v2/users/username-check?u=${encodeURIComponent(candidate)}`);
      const data = await res.json().catch(() => ({}));
      setCheckedUsername({ name: candidate, available: typeof data.available === "boolean" ? data.available : true });
    }, 300);
    return () => clearTimeout(timer);
  }, [fields.username, usernameUnchanged, usernameEmpty]);

  async function save() {
    if (!fields.username.trim()) {
      setError("Pick a username.");
      return;
    }
    if (usernameAvailable === false) {
      setError("That username is taken.");
      return;
    }
    if (fields.tagline.length > 160) {
      setError("Bio is too long — trim it to 160 characters.");
      return;
    }
    setSaving(true);
    setError(null);
    const res = await fetch("/api/v2/users/me", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: fields.name,
        username: fields.username,
        location: fields.location,
        tagline: fields.tagline,
        is_public: fields.isPublicProfile,
        notify_sms: fields.notifySms,
        notify_email: fields.notifyEmail,
        notify_inapp: fields.notifyInapp,
        digest_frequency: fields.digestFrequency,
        default_trip_public: fields.defaultTripPublic,
      }),
    });
    const data = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) {
      setError(data.error ?? "Could not save.");
      return;
    }
    const resolved = { ...fields, username: data.user.username ?? fields.username };
    setFields(resolved);
    setSaved(resolved);
  }

  return (
    <div className="pb-24">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 lg:items-start">
        <div className="flex flex-col gap-6">
          <div className="rounded-2xl border border-border bg-card p-6">
            <p className="mb-4 font-mono text-[11px] tracking-[0.1em] text-muted uppercase">Your profile</p>

            {user.auth_user_id ? (
              <AvatarUploader
                authUserId={user.auth_user_id}
                name={fields.name || user.email || "?"}
                initialAvatarUrl={user.avatar_url}
              />
            ) : (
              <div className="flex items-center gap-4">
                <div
                  className="flex h-16 w-16 flex-none items-center justify-center rounded-full text-[20px] text-on-accent"
                  style={{ background: "var(--color-accent)" }}
                >
                  {(fields.name || "?").slice(0, 2).toUpperCase()}
                </div>
                <p className="text-[13px] text-muted">Sign in with email or Google to add a profile photo.</p>
              </div>
            )}

            <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <p className="mb-1.5 font-mono text-[10.5px] tracking-[0.08em] text-faint uppercase">
                  Display name
                </p>
                <input
                  value={fields.name}
                  onChange={(e) => set("name", e.target.value)}
                  className="w-full rounded-full border border-input-border bg-card px-4 py-2 text-[15px] text-ink outline-none focus:border-ink"
                />
              </div>
              <div>
                <div className="mb-1.5 flex items-center justify-between">
                  <p className="font-mono text-[10.5px] tracking-[0.08em] text-faint uppercase">Username</p>
                  <span
                    className={`font-mono text-[9.5px] tracking-[0.08em] uppercase ${
                      checkingUsername
                        ? "text-faint"
                        : usernameAvailable === false
                          ? "text-caution"
                          : usernameAvailable === true
                            ? "text-positive"
                            : "text-faint"
                    }`}
                  >
                    {checkingUsername ? "Checking…" : usernameAvailable === false ? "Taken" : usernameAvailable === true ? "Free" : ""}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 rounded-full border border-input-border bg-card px-4 py-2 focus-within:border-ink">
                  <span className="text-[15px] text-muted">@</span>
                  <input
                    value={fields.username}
                    onChange={(e) => set("username", e.target.value.toLowerCase())}
                    className="w-full bg-transparent text-[15px] text-ink outline-none"
                  />
                </div>
                <p className="mt-1 text-[12px] text-faint">thatfriend.co/@{fields.username || "…"}</p>
              </div>
            </div>

            <div className="mt-4">
              <p className="mb-1.5 font-mono text-[10.5px] tracking-[0.08em] text-faint uppercase">Location</p>
              <input
                value={fields.location}
                onChange={(e) => set("location", e.target.value)}
                placeholder="Chicago"
                className="w-full rounded-full border border-input-border bg-card px-4 py-2 text-[15px] text-ink outline-none focus:border-ink"
              />
              <p className="mt-1.5 text-[12.5px] text-muted">Shown next to your username on your public profile.</p>
            </div>

            <div className="mt-4">
              <div className="mb-1.5 flex items-center justify-between">
                <p className="font-mono text-[10.5px] tracking-[0.08em] text-faint uppercase">Bio</p>
                <span className={`text-[11px] ${fields.tagline.length > 160 ? "text-caution" : "text-faint"}`}>
                  {fields.tagline.length}/160
                </span>
              </div>
              <textarea
                value={fields.tagline}
                onChange={(e) => set("tagline", e.target.value)}
                rows={3}
                placeholder="The kind of traveller you are, in a sentence."
                className="w-full resize-none rounded-2xl border border-input-border bg-card px-4 py-3 text-[14.5px] text-ink outline-none focus:border-ink"
              />
              <p className="mt-1.5 text-[12.5px] text-muted">
                Appears on your public profile above your rated places.
              </p>
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-card p-6">
            <p className="mb-4 font-mono text-[11px] tracking-[0.1em] text-muted uppercase">Account</p>
            <div className="flex flex-col gap-5">
              <div>
                <div className="mb-1.5 flex items-center justify-between gap-3">
                  <p className="font-mono text-[10.5px] tracking-[0.08em] text-faint uppercase">Email</p>
                  <EmailChangePanel hasEmail={Boolean(user.email)} />
                </div>
                <p className="text-[15px] text-ink">{user.email ?? "No email on this account"}</p>
              </div>

              <div className="border-t border-border-soft pt-5">
                <p className="mb-1.5 font-mono text-[10.5px] tracking-[0.08em] text-faint uppercase">Phone</p>
                <PhoneLinkPanel currentPhone={user.phone} initialWhatsAppOptIn={user.whatsapp_opt_in} />
                <p className="mt-2 text-[13px] leading-relaxed text-muted">
                  Texting runs on this number. Forward a link or photo to That Friend and it lands on your
                  trip&rsquo;s map, and reminders can go out over text.
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-card p-6">
            <p className="mb-4 font-mono text-[11px] tracking-[0.1em] text-muted uppercase">Trip privacy</p>
            <div className="flex items-start justify-between gap-6">
              <div>
                <p className="mb-1 text-[15px] text-ink">New trips are public by default</p>
                <p className="text-[13px] text-muted">
                  Public trips show on your profile for friends to browse and copy. You can flip any single
                  trip later.
                </p>
              </div>
              <Toggle checked={fields.defaultTripPublic} onChange={(v) => set("defaultTripPublic", v)} />
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-6">
          <div className="rounded-2xl border border-border bg-card p-6">
            <p className="mb-1 font-mono text-[11px] tracking-[0.1em] text-muted uppercase">Notifications</p>
            <p className="mb-5 text-[13px] text-muted">Nudges, decisions closing, and payment reminders.</p>

            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-[15px] text-ink">Text messages</p>
                  {user.phone && <p className="text-[13px] text-muted">To {formatPhoneDisplay(user.phone)}</p>}
                </div>
                <Toggle checked={fields.notifySms} onChange={(v) => set("notifySms", v)} />
              </div>
              <div className="flex items-center justify-between gap-4 border-t border-border-soft pt-4">
                <div>
                  <p className="text-[15px] text-ink">Email</p>
                  {user.email && <p className="text-[13px] text-muted">To {user.email}</p>}
                </div>
                <Toggle checked={fields.notifyEmail} onChange={(v) => set("notifyEmail", v)} />
              </div>
              <div className="flex items-center justify-between gap-4 border-t border-border-soft pt-4">
                <div>
                  <p className="text-[15px] text-ink">In the app</p>
                  <p className="text-[13px] text-muted">Always on for trips you own</p>
                </div>
                <Toggle checked={fields.notifyInapp} onChange={(v) => set("notifyInapp", v)} />
              </div>
            </div>

            <p className="mt-6 mb-3 font-mono text-[10.5px] tracking-[0.08em] text-faint uppercase">How often</p>
            <div className="grid grid-cols-2 gap-2.5">
              {DIGEST_OPTIONS.map((opt) => {
                const active = fields.digestFrequency === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => set("digestFrequency", opt.value)}
                    className={`rounded-xl border px-4 py-3 text-left transition-colors ${
                      active
                        ? "border-ink bg-ink text-cream"
                        : "border-input-border bg-card text-ink hover:border-ink"
                    }`}
                  >
                    <p className="text-[14.5px]">{opt.label}</p>
                    <p className={`text-[12.5px] ${active ? "text-cream/70" : "text-muted"}`}>{opt.hint}</p>
                  </button>
                );
              })}
            </div>

            <div className="mt-5 rounded-xl border border-warm-border bg-warm-bg p-4">
              <p className="mb-1 font-mono text-[10.5px] tracking-[0.08em] text-accent uppercase">That Friend</p>
              <p className="text-[13.5px] leading-relaxed text-ink-body">{previewCopy(fields)}</p>
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl border border-border bg-card">
            <div className="flex items-center justify-between gap-3 px-6 py-4">
              <span className="text-[15px] text-ink">Your public profile</span>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => set("isPublicProfile", !fields.isPublicProfile)}
                  className={`rounded-full px-3 py-1 font-mono text-[10px] tracking-[0.08em] uppercase ${
                    fields.isPublicProfile ? "bg-ink text-cream" : "border border-input-border text-muted"
                  }`}
                >
                  {fields.isPublicProfile ? "Public" : "Private"}
                </button>
                {saved.username ? (
                  <Link href={`/planner/u/${saved.username}`} className="text-[14px] text-muted hover:text-accent">
                    @{saved.username} →
                  </Link>
                ) : (
                  <span className="text-[13px] text-muted">Set a username to get a link</span>
                )}
              </div>
            </div>
            <form action={signOut}>
              <button
                type="submit"
                className="flex w-full items-center justify-between gap-3 border-t border-border-soft px-6 py-4 text-left text-[15px] text-ink hover:bg-surface-sunk"
              >
                Sign out
                <span aria-hidden="true">→</span>
              </button>
            </form>
          </div>

          <div className="rounded-2xl border border-border bg-card p-6">
            <p className="mb-1.5 text-[15px] text-ink">Delete account</p>
            <p className="mb-4 text-[13px] leading-relaxed text-muted">
              Removes your ratings and membership from every trip. Any trip you created stays for the group,
              just without your name on it.
            </p>
            <DeleteAccountPanel />
          </div>
        </div>
      </div>

      <div className="fixed right-0 bottom-0 left-0 z-10 border-t border-border bg-card/95 backdrop-blur">
        <div className="mx-auto flex max-w-[1080px] items-center justify-end gap-4 px-6 py-4 sm:px-10">
          {error && <span className="mr-auto text-[13px] text-red-700">{error}</span>}
          <span className="text-[13.5px] text-muted">{dirty ? "Unsaved changes" : ""}</span>
          <button
            type="button"
            onClick={save}
            disabled={!dirty || saving}
            className="rounded-full bg-ink px-5 py-2.5 text-[14px] text-cream hover:bg-accent disabled:opacity-40"
          >
            {saving ? "Saving…" : "Save changes"}
          </button>
        </div>
      </div>
    </div>
  );
}
