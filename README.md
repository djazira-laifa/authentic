<div align="center">

# Authentic

### Actually block AI-generated content on Pinterest.

*Other blockers only hide pins that Pinterest has already labeled as AI. Authentic uses real visual detection to catch the rest.*

[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](https://opensource.org/licenses/MIT)
[![Chrome Web Store](https://img.shields.io/badge/Chrome-Web%20Store-blue?logo=googlechrome&logoColor=white)](#install)
[![Powered by Sightengine](https://img.shields.io/badge/Powered%20by-Sightengine-0e7c86)](https://sightengine.com/)

<br>


</div>

## The problem

Pinterest's feed is increasingly flooded with AI-generated content. Synthetic interiors, fake portraits, generic AI illustrations. For people who come to Pinterest looking for real photography, real design, real craftsmanship, this is exhausting.

Pinterest does label some AI content. But most of it slips through unlabeled. The existing AI blockers on the Chrome Web Store only hide pins that carry Pinterest's `AI-generated` tag, which means they miss most of the synthetic content in your feed.

Authentic solves this by running actual visual AI detection on the pins themselves.

## Why this is different

| | Pinterest's label | Visual AI detection | Catches unlabeled AI |
|---|:---:|:---:|:---:|
| PinSight | yes | no | no |
| Pinterest AI Content Filter | yes | no | no |
| Pinterest Feed Blocker | yes | no | no |
| **Authentic** | yes | yes | yes |

## Features

* **Real visual detection** powered by the [Sightengine genai model](https://sightengine.com/detect-ai-generated-images), not just Pinterest's own labels.
* **Three display modes**: hide flagged pins entirely, blur them with a click-to-reveal button, or keep them with an `AI` badge.
* **Quota friendly by design**: pins are only checked when they actually scroll into view, image URLs are normalized so each pin costs at most one API call ever, results are cached for 14 days, and a configurable daily limit protects your free tier.
* **Built-in status alerts**: the popup tells you if credentials are missing, the daily limit is reached, or the API is failing.
* **Personal analytics**: see how many AI pins were blocked today and all time. Stored locally, never uploaded.
* **Privacy first**: no account, no tracking, permissions limited to Pinterest and Sightengine.

## Install (5 minutes)

### 1. Get the extension

Either download the latest release zip and unzip it, or:

```bash
git clone https://github.com/[USERNAME]/authentic.git
```

### 2. Load it in Chrome

1. Open `chrome://extensions`
2. Turn on **Developer mode** (top right)
3. Click **Load unpacked** and select the `authentic` folder

### 3. Get free Sightengine credentials

1. Sign up at [dashboard.sightengine.com/signup](https://dashboard.sightengine.com/signup) (free, no credit card)
2. Open the **API keys** section of your dashboard
3. Copy your **API user** and **API secret**

### 4. Configure Authentic

1. Click the Authentic icon in your toolbar, then **Settings**
2. Paste your API user and API secret, click **Save**
3. Click **Test connection** to confirm everything works

### 5. Browse Pinterest

Open Pinterest and scroll. AI-detected pins get blurred by default. Switch to Hide or Label mode from the popup.

## About API usage and the free tier

Sightengine's free tier includes about 2000 operations per month, and each image check costs 5 operations, so roughly **400 free checks per month**. Authentic is engineered to stretch that budget:

* Pins are checked only when they become visible on screen, never in advance.
* The same image at different Pinterest sizes maps to one single check.
* Every verdict is cached for 14 days. Re-seeing a pin is free.
* A daily check limit (default 100, adjustable in Settings) stops API calls before your quota runs out. When reached, detection pauses until midnight and the popup tells you.

For typical daily Pinterest browsing this is comfortable. Heavy users can upgrade their Sightengine plan or lower the daily limit.

## How it works

```
+-----------------+     +---------------------+     +---------------+
| Pinterest feed  | --> | Visibility observer | --> |  Sightengine  |
| (your browser)  |     | + URL normalization |     |  genai model  |
+-----------------+     | + 14 day cache      |     +---------------+
                        | + daily budget      |             |
                        +---------------------+             v
                                |                   +---------------+
                                v                   |  AI verdict   |
                       +-------------------+        |  + score      |
                       | Hide / blur /     | <------+---------------+
                       | label the pin     |
                       +-------------------+
```

## Tech stack

* Chrome Extension Manifest V3, vanilla JavaScript, zero dependencies
* Sightengine genai model for AI image classification
* Chrome Storage API for settings, cache, and local stats
* IntersectionObserver for visibility-gated detection, MutationObserver for infinite scroll

## Roadmap

* [x] Visual AI detection on the Pinterest feed
* [x] Hide / blur / label modes
* [x] Quota protection: visibility gating, caching, daily limit
* [x] Built-in connection test and status alerts
* [ ] Detection on pin detail pages
* [ ] Per-board whitelisting (e.g. allow AI on `digital art` boards)
* [ ] Multi language UI (FR, EN, ES)

Have an idea? [Open an issue](https://github.com/[USERNAME]/authentic/issues).

## Contributing

Contributions are welcome: PRs, bug reports, feature ideas, translations, design feedback. The codebase is intentionally small (about 500 lines, no build step, no dependencies).

If Pinterest changes its markup and pins stop being detected, the fix is usually one line: the `PIN_SELECTORS` list at the top of `content.js`.

## License

[MIT](./LICENSE). Free to use, fork, modify, and distribute.

## About the author

Built by **Djazira LAIFA**.

This extension is part of a broader interest of mine: protecting human attention and authenticity in an increasingly synthetic web.


## Support

Authentic is and will remain 100% free and open source. If it is useful to you:

* Star this repo. Free, takes two seconds, helps a lot.
* [Buy me a matcha] 

<div align="center">

*Made with intention and with Claud's help <3.*

</div>
