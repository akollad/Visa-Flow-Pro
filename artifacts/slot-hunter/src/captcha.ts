import type { Page } from "playwright";

const TWO_CAPTCHA_BASE = "https://2captcha.com";
const POLL_INTERVAL_MS = 5000;
const MAX_POLL_ATTEMPTS = 24;

export type CaptchaResult = "solved" | "no_key" | "failed";

async function submitCaptchaTask(
  apiKey: string,
  siteKey: string,
  pageUrl: string
): Promise<string | null> {
  const params = new URLSearchParams({
    key: apiKey,
    method: "userrecaptcha",
    googlekey: siteKey,
    pageurl: pageUrl,
    json: "1",
  });

  const res = await fetch(`${TWO_CAPTCHA_BASE}/in.php?${params.toString()}`);
  const data = (await res.json()) as { status: number; request: string };

  if (data.status !== 1) {
    console.error("[captcha] Submission failed:", data.request);
    return null;
  }

  return data.request;
}

async function pollCaptchaSolution(
  apiKey: string,
  captchaId: string
): Promise<string | null> {
  for (let i = 0; i < MAX_POLL_ATTEMPTS; i++) {
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));

    const params = new URLSearchParams({
      key: apiKey,
      action: "get",
      id: captchaId,
      json: "1",
    });

    const res = await fetch(`${TWO_CAPTCHA_BASE}/res.php?${params.toString()}`);
    const data = (await res.json()) as { status: number; request: string };

    if (data.status === 1) {
      return data.request;
    }

    if (data.request !== "CAPCHA_NOT_READY") {
      console.error("[captcha] Poll error:", data.request);
      return null;
    }

    console.log(`[captcha] Waiting for solution... attempt ${i + 1}/${MAX_POLL_ATTEMPTS}`);
  }

  console.error("[captcha] Timed out waiting for solution");
  return null;
}

async function injectCaptchaSolution(page: Page, token: string): Promise<void> {
  await page.evaluate((tok: string) => {
    const textarea = document.getElementById("g-recaptcha-response") as HTMLTextAreaElement | null;
    if (textarea) {
      textarea.value = tok;
      textarea.style.display = "block";
    }
    const callbacks = (window as unknown as { ___grecaptcha_cfg?: { clients?: Record<string, Record<string, { callback?: (t: string) => void }>> } }).___grecaptcha_cfg?.clients;
    if (callbacks) {
      for (const key of Object.keys(callbacks)) {
        const client = callbacks[key];
        for (const subKey of Object.keys(client)) {
          if (client[subKey]?.callback) {
            try { client[subKey].callback!(tok); } catch { /* ignore */ }
          }
        }
      }
    }
  }, token);
}

export async function detectAndSolveCaptcha(
  page: Page,
  twoCaptchaApiKey: string | undefined
): Promise<CaptchaResult> {
  const hasCaptcha = await page.evaluate(() => {
    return !!(
      document.querySelector(".g-recaptcha") ||
      document.querySelector("[data-sitekey]") ||
      document.querySelector("iframe[src*='recaptcha']")
    );
  });

  if (!hasCaptcha) return "solved";

  console.log("[captcha] reCAPTCHA detected on page");

  if (!twoCaptchaApiKey) {
    console.warn("[captcha] No 2captcha key configured — skipping");
    return "no_key";
  }

  const siteKey = await page.evaluate(() => {
    const el = document.querySelector("[data-sitekey]") as HTMLElement | null;
    return el?.getAttribute("data-sitekey") ?? "";
  });

  if (!siteKey) {
    console.error("[captcha] Could not find sitekey");
    return "failed";
  }

  const pageUrl = page.url();
  console.log(`[captcha] Submitting to 2captcha (siteKey: ${siteKey.slice(0, 10)}...)`);

  const captchaId = await submitCaptchaTask(twoCaptchaApiKey, siteKey, pageUrl);
  if (!captchaId) return "failed";

  const token = await pollCaptchaSolution(twoCaptchaApiKey, captchaId);
  if (!token) return "failed";

  await injectCaptchaSolution(page, token);
  console.log("[captcha] Solution injected successfully");
  return "solved";
}
