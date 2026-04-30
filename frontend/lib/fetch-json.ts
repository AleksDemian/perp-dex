export async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url);

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(
      `Request failed: ${res.status}${body ? `: ${body.slice(0, 200)}` : ""}`
    );
  }

  return res.json() as Promise<T>;
}
