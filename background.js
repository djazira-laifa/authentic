// background.js
// Service worker. Responsibilities:
//   1. Classify images via the Sightengine API, behind a request queue with
//      limited concurrency and a configurable daily budget.
//   2. Cache verdicts locally so the same pin is never re-checked.
//   3. Maintain counters (blocked pins, API checks) and a status flag that
//      the popup reads to surface problems (missing credentials, quota
//      reached, API errors).

const SIGHTENGINE_ENDPOINT = "https://api.sightengine.com/1.0/check.json";
const CACHE_TTL_MS = 1000 * 60 * 60 * 24 * 14; // 14 days
const MAX_CONCURRENT = 3;
const DEFAULT_DAILY_LIMIT = 100; // API checks per day (1 check = 5 Sightengine ops)

// ---------------------------------------------------------------------------
// Status flag (read by the popup)
// ---------------------------------------------------------------------------

// Possible values: "ok" | "no_credentials" | "quota_reached" | "api_error"
async function setStatus(status, detail = "") {
  await chrome.storage.local.set({ apiStatus: status, apiStatusDetail: detail });
}

// ---------------------------------------------------------------------------
// Credentials, cache, counters
// ---------------------------------------------------------------------------

async function getCredentials() {
  const { sightengineUser, sightengineSecret } =
    await chrome.storage.sync.get(["sightengineUser", "sightengineSecret"]);
  if (!sightengineUser || !sightengineSecret) return null;
  return { user: sightengineUser, secret: sightengineSecret };
}

async function getCachedVerdict(url) {
  const key = "cache:" + url;
  const result = await chrome.storage.local.get(key);
  const entry = result[key];
  if (!entry) return null;
  if (Date.now() - entry.ts > CACHE_TTL_MS) return null;
  return entry.verdict;
}

async function setCachedVerdict(url, verdict) {
  const key = "cache:" + url;
  await chrome.storage.local.set({
    [key]: { ts: Date.now(), verdict },
  });
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

// Returns true if we are allowed to make one more API check today,
// and increments the daily counter if so.
async function consumeDailyBudget() {
  const { dailyLimit = DEFAULT_DAILY_LIMIT } =
    await chrome.storage.sync.get("dailyLimit");
  const { checksToday = 0, checksDate = "" } =
    await chrome.storage.local.get(["checksToday", "checksDate"]);

  const today = todayStr();
  const count = checksDate === today ? checksToday : 0;

  if (count >= dailyLimit) {
    await setStatus("quota_reached",
      "Daily check limit reached (" + dailyLimit + "). Resets at midnight.");
    return false;
  }

  await chrome.storage.local.set({
    checksToday: count + 1,
    checksDate: today,
  });
  return true;
}

// ---------------------------------------------------------------------------
// Request queue with limited concurrency
// ---------------------------------------------------------------------------

const queue = [];
let activeCount = 0;

function enqueue(task) {
  return new Promise((resolve) => {
    queue.push({ task, resolve });
    pump();
  });
}

async function pump() {
  while (activeCount < MAX_CONCURRENT && queue.length > 0) {
    const { task, resolve } = queue.shift();
    activeCount++;
    task()
      .then(resolve)
      .catch(() => resolve({ aiScore: 0, error: "api_failed" }))
      .finally(() => {
        activeCount--;
        pump();
      });
  }
}

// ---------------------------------------------------------------------------
// Sightengine call
// ---------------------------------------------------------------------------

async function checkImageWithSightengine(url, creds) {
  const params = new URLSearchParams({
    url: url,
    models: "genai",
    api_user: creds.user,
    api_secret: creds.secret,
  });

  const response = await fetch(
    SIGHTENGINE_ENDPOINT + "?" + params.toString()
  );

  if (!response.ok) {
    throw new Error("HTTP " + response.status);
  }

  const data = await response.json();

  if (data.status === "failure") {
    // media_error (code 18) means the image itself couldn't be downloaded
    // by Sightengine. Not our fault, not a credentials problem: treat the
    // image as unknown and move on without flipping the global status.
    if (data.error?.type === "media_error") {
      return { aiScore: 0, mediaError: true };
    }
    throw new Error(data.error?.message || "Sightengine reported failure");
  }

  const aiScore = data?.type?.ai_generated;
  return { aiScore: typeof aiScore === "number" ? aiScore : 0 };
}

async function handleCheckImage(url) {
  // 1. Cache lookup (free).
  const cached = await getCachedVerdict(url);
  if (cached) return cached;

  // 2. Credentials check.
  const creds = await getCredentials();
  if (!creds) {
    await setStatus("no_credentials",
      "Add your Sightengine credentials in Settings.");
    return { aiScore: 0, error: "no_credentials" };
  }

  // 3. Daily budget check.
  const allowed = await consumeDailyBudget();
  if (!allowed) {
    return { aiScore: 0, error: "quota_reached" };
  }

  // 4. Queued API call.
  return enqueue(async () => {
    try {
      const verdict = await checkImageWithSightengine(url, creds);
      // Cache everything, including media errors, so we don't retry
      // an image Sightengine can't download.
      await setCachedVerdict(url, { aiScore: verdict.aiScore });
      await setStatus("ok");
      return { aiScore: verdict.aiScore };
    } catch (err) {
      console.warn("[Authentic] Sightengine check failed:", err);
      await setStatus("api_error", String(err.message || err));
      return { aiScore: 0, error: "api_failed" };
    }
  });
}

// ---------------------------------------------------------------------------
// Block counter
// ---------------------------------------------------------------------------

async function incrementCount() {
  const stored = await chrome.storage.local.get([
    "blockedCount",
    "blockedToday",
    "lastDate",
  ]);
  const today = todayStr();
  const update = {
    blockedCount: (stored.blockedCount || 0) + 1,
    blockedToday: today === stored.lastDate
      ? (stored.blockedToday || 0) + 1
      : 1,
    lastDate: today,
  };
  await chrome.storage.local.set(update);
}

// ---------------------------------------------------------------------------
// Message router
// ---------------------------------------------------------------------------

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === "CHECK_IMAGE") {
    handleCheckImage(msg.url).then(sendResponse);
    return true; // keep the channel open for the async response
  }
  if (msg.type === "INCREMENT_COUNT") {
    incrementCount();
    return false;
  }
  if (msg.type === "TEST_CONNECTION") {
    // Used by the options page. Tests with a known Sightengine-hosted image
    // so the image download can't fail.
    (async () => {
      const creds = await getCredentials();
      if (!creds) {
        sendResponse({ ok: false, message: "No credentials saved yet." });
        return;
      }
      try {
        const verdict = await checkImageWithSightengine(
          "https://sightengine.com/assets/img/examples/example-prop-c2.jpg",
          creds
        );
        await setStatus("ok");
        sendResponse({
          ok: true,
          message: "Connection works. Test image AI score: "
            + verdict.aiScore.toFixed(3),
        });
      } catch (err) {
        sendResponse({ ok: false, message: String(err.message || err) });
      }
    })();
    return true;
  }
});
