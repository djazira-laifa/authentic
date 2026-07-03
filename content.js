// content.js
// Runs inside every Pinterest tab. Watches the feed, asks the service worker
// whether each pin's image is AI generated, and applies the user's chosen
// treatment (hide, blur, or label).
//
// Quota-saving design:
//  - Pins are only checked when they become VISIBLE (IntersectionObserver),
//    not as soon as they enter the DOM. You never pay for pins you never see.
//  - Image URLs are normalized so the same pin at different sizes maps to
//    one single cache entry and one single API call.
//  - Tiny images (avatars, icons) are skipped.

const PROCESSED = new WeakSet();

const DEFAULT_SETTINGS = {
  enabled: true,
  mode: "blur",      // "hide" | "blur" | "label"
  threshold: 0.5,    // confidence above which a pin is flagged
};

let settings = { ...DEFAULT_SETTINGS };

async function loadSettings() {
  const stored = await chrome.storage.sync.get(DEFAULT_SETTINGS);
  settings = { ...DEFAULT_SETTINGS, ...stored };
}

// React to settings changes live (e.g. user switches mode in the popup).
chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "sync") return;
  for (const [key, { newValue }] of Object.entries(changes)) {
    settings[key] = newValue;
  }
  reapplyTreatments();
});

// ---------------------------------------------------------------------------
// Pin discovery
// ---------------------------------------------------------------------------

// Pinterest's markup changes from time to time. We try several selectors,
// most specific first. If Authentic ever stops detecting pins, add the new
// selector here.
const PIN_SELECTORS = [
  '[data-test-id="pin"]',
  '[data-grid-item="true"]',
  'div[role="listitem"]',
];

function findPins(root = document) {
  for (const selector of PIN_SELECTORS) {
    const found = root.querySelectorAll(selector);
    if (found.length > 0) return found;
  }
  return [];
}

function getImageUrl(pin) {
  const img = pin.querySelector("img[src]");
  if (!img) return null;
  // Skip tiny images: avatars, icons, UI chrome. Real pin images are larger.
  if (img.naturalWidth > 0 && img.naturalWidth < 100) return null;
  if (!img.src.includes("pinimg.com")) return null;
  return normalizePinImageUrl(img.src);
}

// Pinterest serves the same image at several sizes:
//   https://i.pinimg.com/236x/ab/cd/ef/hash.jpg
//   https://i.pinimg.com/564x/ab/cd/ef/hash.jpg
//   https://i.pinimg.com/originals/ab/cd/ef/hash.jpg
// We normalize everything to the 236x variant. Benefits: one cache entry per
// pin instead of three, and a smaller download for Sightengine.
function normalizePinImageUrl(url) {
  return url.replace(
    /(i\.pinimg\.com\/)[^/]+\//,
    "$1236x/"
  );
}

// ---------------------------------------------------------------------------
// Visibility-gated processing
// ---------------------------------------------------------------------------

// The IntersectionObserver fires when a pin actually scrolls into view
// (with a 200px lookahead so treatment is applied just before it appears).
const visibilityObserver = new IntersectionObserver(
  (entries) => {
    for (const entry of entries) {
      if (entry.isIntersecting) {
        visibilityObserver.unobserve(entry.target);
        processPin(entry.target);
      }
    }
  },
  { rootMargin: "200px 0px" }
);

function watchPin(pin) {
  if (PROCESSED.has(pin)) return;
  PROCESSED.add(pin);
  visibilityObserver.observe(pin);
}

async function processPin(pin) {
  if (!settings.enabled) return;

  const imageUrl = getImageUrl(pin);
  if (!imageUrl) return;

  try {
    const verdict = await chrome.runtime.sendMessage({
      type: "CHECK_IMAGE",
      url: imageUrl,
    });

    if (verdict && typeof verdict.aiScore === "number"
        && verdict.aiScore >= settings.threshold) {
      flagPin(pin, verdict);
    }
  } catch (err) {
    // The service worker may have been suspended briefly. Silent fail is OK.
    console.warn("[Authentic] check failed:", err);
  }
}

// ---------------------------------------------------------------------------
// Treatments
// ---------------------------------------------------------------------------

function flagPin(pin, verdict) {
  pin.dataset.authenticAi = "true";
  pin.dataset.authenticScore = verdict.aiScore.toFixed(2);
  applyTreatment(pin);
  chrome.runtime.sendMessage({ type: "INCREMENT_COUNT" });
}

function applyTreatment(pin) {
  pin.classList.remove(
    "authentic-hidden",
    "authentic-blurred",
    "authentic-labelled"
  );
  pin.querySelector(".authentic-badge")?.remove();
  pin.querySelector(".authentic-reveal")?.remove();

  switch (settings.mode) {
    case "hide":
      pin.classList.add("authentic-hidden");
      break;
    case "blur":
      pin.classList.add("authentic-blurred");
      addRevealButton(pin);
      break;
    case "label":
      pin.classList.add("authentic-labelled");
      addLabel(pin);
      break;
  }
}

function reapplyTreatments() {
  document
    .querySelectorAll('[data-authentic-ai="true"]')
    .forEach((pin) => applyTreatment(pin));
}

function addLabel(pin) {
  const badge = document.createElement("div");
  badge.className = "authentic-badge";
  badge.textContent = "AI";
  pin.style.position = "relative";
  pin.appendChild(badge);
}

function addRevealButton(pin) {
  const btn = document.createElement("button");
  btn.className = "authentic-reveal";
  btn.textContent = "Show anyway";
  btn.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    pin.classList.remove("authentic-blurred");
    btn.remove();
  });
  pin.style.position = "relative";
  pin.appendChild(btn);
}

// ---------------------------------------------------------------------------
// Bootstrapping
// ---------------------------------------------------------------------------

// MutationObserver finds new pins as Pinterest's infinite scroll adds them,
// then hands them to the IntersectionObserver, which decides when to check.
const domObserver = new MutationObserver(() => {
  findPins().forEach(watchPin);
});

(async function init() {
  await loadSettings();
  findPins().forEach(watchPin);
  domObserver.observe(document.body, { childList: true, subtree: true });
})();
