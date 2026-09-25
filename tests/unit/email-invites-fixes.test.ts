import { describe, expect, it, vi } from "vitest";

// resend instantiates a client at import (needs an API key) — stubbed so
// importing email.ts in a test doesn't require a real one.
vi.mock("resend", () => ({ Resend: class {} }));

import { sendWithRetry } from "@/lib/planner/email";
import { MAX_EMAIL_RETRIES } from "@/config/limits";

describe("sendWithRetry", () => {
  it("succeeds on the first attempt without retrying", async () => {
    const send = vi.fn().mockResolvedValue({ ok: true, id: "abc" });
    const result = await sendWithRetry(send);
    expect(result).toEqual({ status: "sent", error: null, attempts: 1 });
    expect(send).toHaveBeenCalledTimes(1);
  });

  it("retries a transient failure up to MAX_EMAIL_RETRIES times, then succeeds", async () => {
    const send = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, error: { kind: "transient", message: "network blip" } })
      .mockResolvedValueOnce({ ok: true, id: "abc" });
    const result = await sendWithRetry(send);
    expect(result).toEqual({ status: "sent", error: null, attempts: 2 });
    expect(send).toHaveBeenCalledTimes(2);
  });

  it("gives up after MAX_EMAIL_RETRIES transient failures", async () => {
    const send = vi.fn().mockResolvedValue({ ok: false, error: { kind: "transient", message: "still down" } });
    const result = await sendWithRetry(send);
    expect(result.status).toBe("failed");
    expect(result.error).toBe("still down");
    expect(send).toHaveBeenCalledTimes(MAX_EMAIL_RETRIES + 1);
  });

  it("never retries a permanent failure", async () => {
    const send = vi.fn().mockResolvedValue({ ok: false, error: { kind: "permanent", message: "invalid address" } });
    const result = await sendWithRetry(send);
    expect(result).toEqual({ status: "failed", error: "invalid address", attempts: 1 });
    expect(send).toHaveBeenCalledTimes(1);
  });

  it("never retries a config failure (no API key)", async () => {
    const send = vi.fn().mockResolvedValue({ ok: false, error: { kind: "config", message: "RESEND_API_KEY is not set" } });
    const result = await sendWithRetry(send);
    expect(result).toEqual({ status: "failed", error: "RESEND_API_KEY is not set", attempts: 1 });
    expect(send).toHaveBeenCalledTimes(1);
  });
});
