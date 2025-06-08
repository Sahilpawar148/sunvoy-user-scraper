import fetch, { Response } from "node-fetch";
import * as fs from "fs/promises";
import * as path from "path";
import * as crypto from "crypto";

const BASE_URL = "https://challenge.sunvoy.com";
const API_URL = "https://api.challenge.sunvoy.com";
const USERS_URL = `${BASE_URL}/api/users`;
const TOKENS_URL = `${BASE_URL}/settings/tokens`;
const SETTINGS_API_URL = `${API_URL}/api/settings`;
const LOGIN_URL = `${BASE_URL}/login`;

const EMAIL = "demo@example.org";
const PASSWORD = "test";
const SECRET = "mys3cr3t";

const SESSION_FILE = path.resolve(__dirname, "..", "session.json");
const OUTPUT_FILE = path.resolve(__dirname, "..", "users.json");

async function saveSession(cookie: string) {
  await fs.writeFile(SESSION_FILE, JSON.stringify({ cookie }), "utf8");
}

async function loadSession(): Promise<string | null> {
  try {
    const raw = await fs.readFile(SESSION_FILE, "utf8");
    return JSON.parse(raw).cookie;
  } catch {
    return null;
  }
}

function extractCookies(res: Response): string {
  const set = res.headers.raw()["set-cookie"] || [];
  return set.map((c) => c.split(";")[0]).join("; ");
}

async function login(): Promise<string> {
  const getRes = await fetch(LOGIN_URL, {
    headers: { "User-Agent": "Mozilla/5.0" },
  });

  const initCookie = extractCookies(getRes);
  const html = await getRes.text();

  const m = html.match(/name="nonce" value="([^"]+)"/);
  if (!m) throw new Error("Login nonce not found");

  const nonce = m[1];
  const form = new URLSearchParams({
    nonce,
    username: EMAIL,
    password: PASSWORD,
  });

  const postRes = await fetch(LOGIN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": "Mozilla/5.0",
      Cookie: initCookie,
    },
    body: form.toString(),
    redirect: "manual",
  });

  if (postRes.status !== 302) {
    throw new Error(`Login failed (${postRes.status})`);
  }

  const sessionCookie = extractCookies(postRes);
  const combined = [initCookie, sessionCookie].filter(Boolean).join("; ");
  console.log("Logged in");
  await saveSession(combined);
  return combined;
}

async function fetchUsers(cookie: string): Promise<any[]> {
  const res = await fetch(USERS_URL, {
    method: "POST",
    headers: {
      "User-Agent": "Mozilla/5.0",
      "Content-Type": "application/json",
      Cookie: cookie,
    },
    body: "{}",
  });

  if (!res.ok) throw new Error(`Users fetch failed (${res.status})`);
  const j = await res.json();
  if (!Array.isArray(j)) throw new Error("Expected an array of users");
  console.log(`Fetched ${j.length} users`);
  return j;
}

async function getSignedFormPayload(cookie: string): Promise<string> {
  const res = await fetch(TOKENS_URL, {
    method: "GET",
    headers: {
      "User-Agent": "Mozilla/5.0",
      Cookie: cookie,
    },
  });

  const html = await res.text();
  const matches = [...html.matchAll(/<input[^>]+type="hidden"[^>]+id="([^"]+)"[^>]+value="([^"]+)"[^>]*>/g)];
  const data: Record<string, string> = {};

  for (const match of matches) {
    data[match[1]] = match[2];
  }

  const timestamp = Math.floor(Date.now() / 1000).toString();
  data["timestamp"] = timestamp;

  const sorted = Object.keys(data)
    .sort()
    .map((key) => `${key}=${encodeURIComponent(data[key])}`)
    .join("&");

  const hmac = crypto.createHmac("sha1", SECRET);
  hmac.update(sorted);
  const checkcode = hmac.digest("hex").toUpperCase();

  return `${sorted}&checkcode=${checkcode}`;
}

async function fetchCurrentUserFromAPI(cookie: string): Promise<any> {
  const fullPayload = await getSignedFormPayload(cookie);

  const res = await fetch(SETTINGS_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": "Mozilla/5.0",
      Cookie: cookie,
    },
    body: fullPayload,
  });

  if (!res.ok) {
    const body = await res.text();
    console.warn("Status:", res.status);
    console.warn("Body:", body);
    throw new Error("Current user fetch failed via internal API");
  }

  const userData = await res.json();
  console.log("Retrieved current user via API");
  return userData;
}

(async () => {
  try {
    let cookie = await loadSession();
    let valid = true;

    if (!cookie) {
      valid = false;
    } else {
      try {
        await fetchUsers(cookie!);
      } catch {
        valid = false;
        console.warn("Stored session invalid, re-logging in");
      }
    }

    if (!valid) {
      console.log("Logging in...");
      cookie = await login();
    } else {
      console.log("Reusing session cookie");
    }

    const users = await fetchUsers(cookie!);
    await fs.writeFile(OUTPUT_FILE, JSON.stringify(users, null, 2), "utf8");
    console.log(`Saved ${users.length} users to users.json`);

    try {
      const currentUser = await fetchCurrentUserFromAPI(cookie!);
      users.push({ currentUser });

      await fs.writeFile(OUTPUT_FILE, JSON.stringify(users, null, 2), "utf8");
      console.log("Updated users.json with current user info");
    } catch (e) {
      if (e instanceof Error) {
        console.warn("Failed to fetch current user via API:", e.message);
      } else {
        console.warn("Failed to fetch current user via API:", e);
      }
    }
  } catch (err: any) {
    console.error(err.message || err);
    process.exit(1);
  }
})();
