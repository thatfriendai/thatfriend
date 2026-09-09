"use client";

import { useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

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

export function AvatarUploader({
  authUserId,
  name,
  initialAvatarUrl,
}: {
  authUserId: string;
  name: string;
  initialAvatarUrl: string | null;
}) {
  const [avatarUrl, setAvatarUrl] = useState(initialAvatarUrl);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Pick an image file.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError("Keep it under 5MB.");
      return;
    }

    setPending(true);
    setError(null);

    const supabase = createClient();
    const ext = file.name.split(".").pop() || "jpg";
    const path = `${authUserId}/avatar-${Date.now()}.${ext}`;
    const { error: uploadError } = await supabase.storage
      .from("avatars")
      .upload(path, file, { cacheControl: "3600", upsert: true });

    if (uploadError) {
      setPending(false);
      setError(uploadError.message);
      return;
    }

    const {
      data: { publicUrl },
    } = supabase.storage.from("avatars").getPublicUrl(path);

    const res = await fetch("/api/v2/users/me", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ avatar_url: publicUrl }),
    });
    setPending(false);
    if (!res.ok) {
      setError("Uploaded, but couldn't save it. Try again.");
      return;
    }
    setAvatarUrl(publicUrl);
  }

  async function remove() {
    setPending(true);
    setError(null);
    const res = await fetch("/api/v2/users/me", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ avatar_url: null }),
    });
    setPending(false);
    if (!res.ok) {
      setError("Could not remove it.");
      return;
    }
    setAvatarUrl(null);
  }

  return (
    <div className="flex items-center gap-4">
      <div className="relative h-16 w-16 flex-none">
        {avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={avatarUrl} alt="" className="h-16 w-16 rounded-full object-cover" />
        ) : (
          <div
            className="flex h-16 w-16 items-center justify-center rounded-full text-[20px] text-on-accent"
            style={{ background: "var(--color-accent)" }}
          >
            {initialsOf(name)}
          </div>
        )}
        {avatarUrl && (
          <button
            type="button"
            onClick={remove}
            disabled={pending}
            aria-label="Remove photo"
            className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full border border-border bg-card text-ink shadow hover:border-ink disabled:opacity-50"
          >
            <svg width="9" height="9" viewBox="0 0 10 10" fill="none" aria-hidden="true">
              <path d="M1 1l8 8M9 1l-8 8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
            </svg>
          </button>
        )}
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={pending}
          aria-label="Upload photo"
          className="absolute -right-1 -bottom-1 flex h-6 w-6 items-center justify-center rounded-full border border-border bg-card text-ink shadow hover:border-ink disabled:opacity-50"
        >
          <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path
              d="M5 3.5 6.2 2h3.6l1.2 1.5H13a1.5 1.5 0 0 1 1.5 1.5v6.5A1.5 1.5 0 0 1 13 13H3A1.5 1.5 0 0 1 1.5 11.5V5A1.5 1.5 0 0 1 3 3.5h2Z"
              stroke="currentColor"
              strokeWidth="1.1"
              strokeLinejoin="round"
            />
            <circle cx="8" cy="8" r="2.3" stroke="currentColor" strokeWidth="1.1" />
          </svg>
        </button>
      </div>
      <div>
        <p className="mb-1 text-[15px] text-ink">Profile photo</p>
        <p className="mb-2 text-[13px] text-muted">
          Shown next to your saved places and votes. Square, at least 400px.
        </p>
        {pending && <p className="text-[13px] text-muted">Working…</p>}
        {error && <p className="text-[13px] text-red-700">{error}</p>}
      </div>
      <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
    </div>
  );
}
