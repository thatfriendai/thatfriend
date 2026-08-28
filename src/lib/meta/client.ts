import "server-only";

const GRAPH_VERSION = "v21.0";

function getAccessToken() {
  const token = process.env.META_ACCESS_TOKEN;
  if (!token) throw new Error("META_ACCESS_TOKEN is not configured.");
  return token;
}

function getPhoneNumberId() {
  const id = process.env.META_PHONE_NUMBER_ID;
  if (!id) throw new Error("META_PHONE_NUMBER_ID is not configured.");
  return id;
}

/** Sends a plain-text WhatsApp message via Meta's Cloud API. */
export async function sendWhatsAppText(to: string, body: string): Promise<void> {
  const res = await fetch(
    `https://graph.facebook.com/${GRAPH_VERSION}/${getPhoneNumberId()}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${getAccessToken()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to,
        type: "text",
        text: { body },
      }),
    }
  );

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`WhatsApp send failed (${res.status}): ${detail}`);
  }
}

/** Resolves a media id (from an incoming message) to a short-lived download URL. */
async function getMediaUrl(mediaId: string): Promise<string> {
  const res = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${mediaId}`, {
    headers: { Authorization: `Bearer ${getAccessToken()}` },
  });
  if (!res.ok) throw new Error(`Could not resolve media ${mediaId} (${res.status}).`);
  const data = await res.json();
  return data.url as string;
}

/** Downloads an incoming media attachment (e.g. a forwarded screenshot) as base64. */
export async function downloadWhatsAppMedia(
  mediaId: string
): Promise<{ base64: string; mimeType: string }> {
  const url = await getMediaUrl(mediaId);
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${getAccessToken()}` },
  });
  if (!res.ok) throw new Error(`Could not download media ${mediaId} (${res.status}).`);
  const mimeType = res.headers.get("content-type") ?? "image/jpeg";
  const buffer = Buffer.from(await res.arrayBuffer());
  return { base64: buffer.toString("base64"), mimeType };
}
