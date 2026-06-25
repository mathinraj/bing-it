# bing it

A Manifest V3 browser extension that automates Bing searches with human-like behavior. Works on **Microsoft Edge** and **Google Chrome**.

## Features

- **Human-like typing** — characters typed one-by-one with variable delays (45–580 ms), including occasional "thinking" pauses
- **Page scrolling** — scrolls search results in random increments with reading pauses to simulate genuine browsing
- **Floating timer** — live countdown overlay on the Bing tab itself showing progress, status, and time to next search
- **Configurable timing** — full control over normal delays and coffee break duration (in seconds) via a dedicated Settings page
- **Coffee break toggle** — enable/disable long breaks, set frequency (every N searches) and duration range
- **Include delay in reading** — option to overlap the delay timer with result scrolling for faster sessions
- **Google Trends integration** — pulls real-world trending queries so your search history looks 100% natural
- **500+ fallback queries** — diverse built-in pool across 20+ categories when Trends is unavailable
- **Background execution** — searches run in an inactive tab so you can keep using your browser

## Installation

1. Clone or download this repository
2. Open your browser's extension management page:
   - **Edge**: `edge://extensions/`
   - **Chrome**: `chrome://extensions/`
3. Enable **Developer mode** (toggle in the top-right corner)
4. Click **Load unpacked** and select the project folder
5. Pin the extension to your toolbar for easy access

## Usage

1. **Sign in** to your Microsoft account in the browser before starting
2. Click the extension icon → set search count → **Bing it!**
3. A background Bing tab opens with a **floating timer overlay** in the bottom-right corner
4. Open **Settings** (link in popup footer) to customize:
   - Normal delay range (seconds)
   - Coffee break on/off, frequency, duration (seconds)
   - Include delay in reading time (overlaps wait with scrolling)
5. Click **Stop** at any time to cancel

## Project Structure

```
bing-it/
├── manifest.json              # MV3 extension manifest
├── README.md
├── .gitignore
├── scripts/
│   ├── background.js          # Service worker — orchestration, alarms, Trends API
│   └── content.js             # Bing page — typing, scrolling, floating overlay
├── popup/
│   ├── popup.html             # Extension popup UI
│   ├── popup.js               # Start/stop, progress rendering
│   └── popup.css              # Blinkit-inspired light theme
├── options/
│   ├── options.html           # Settings page
│   ├── options.js             # Settings logic (auto-save)
│   └── options.css            # Settings styles
└── assets/
    └── queries.json           # 500+ fallback search queries
```

## Disclaimer

This extension is provided for educational purposes. Automating searches may violate Microsoft's Terms of Service. Use at your own risk — you are solely responsible for how you use this tool.
