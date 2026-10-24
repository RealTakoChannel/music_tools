<div align="center">

# 🎵 Music Tools

**Small tasks in music production, made easier.**

Lightweight tools for everyday audio work and mixing quotes. Open your browser and get started.

**English** · [日本語](README.ja.md) · [简体中文](README.zh-CN.md)

React · Tailwind CSS · On-device processing · Offline support

[Open the app](https://takoserver.top/) · [Tools](#tools) · [Getting started](#getting-started) · [Development](#development)

</div>

---

## Tools

| Tool | Purpose | Main features |
| :--- | :--- | :--- |
| ♫ **Audio Joiner** | Combine WAV clips into one file | Natural filename sorting, 1–2 second gaps, original sample data preserved |
| ⏱ **BPM Calculator** | Detect and adjust tempo | Six-band BPM detection, multiplier corrections, range mapping, Tap Tempo |
| ¥ **Mixing Price Calculator** | Quote by active vocal duration | Separate lead/harmony pricing, multiple files, fixed-price options, rounding |

### ♫ Audio Joiner

Drop in WAV files to sort them by filename, insert silence between clips, and export a single WAV.

- **Natural sorting:** `clip 2.wav` comes before `clip 10.wav`.
- **Adjustable gaps:** choose 1–2 seconds, with 1 / 1.5 / 2 second presets. No extra silence is added at the beginning or end.
- **Sample preservation:** keep the original sample rate, bit depth, channels, and encoding without resampling or requantization.
- **Format validation:** incompatible sample rates, bit depths, channel layouts, or encodings block the merge and show an explanation.
- **Export and preview:** edit the output filename, download the merged WAV, and preview it when supported by your browser.

Common PCM and IEEE Float WAV formats are supported. Outputs exceeding the RIFF size limit use RF64. Audio samples and essential format information are retained; artwork, markers, BWF descriptions, timecode, and other metadata are not merged. RF64 playback requires compatible software.

### ⏱ BPM Calculator

Drop in audio for automatic BPM detection, enter a detected tempo manually, or tap the button or Space key to measure tempo.

- **Multiplier corrections:** apply `÷ 2`, `× 2`, `× 2/3`, or `× 3/2` for half-time, double-time, and 1.5× detection differences.
- **Range mapping:** set a lower bound `L` to map a positive BPM into `[L, 2L)`.
- **Tap Tempo:** average recent tap intervals; a long pause starts a new sequence.
- **Quick copy:** copy the mapped BPM to your clipboard.
- **Progress and cancellation:** monitor a full-track analysis and stop it when needed.

Input formats depend on browser decoding support, including MP3, WAV, M4A, FLAC, and OGG. The file limit is 250 MB. Audio is decoded to 48 kHz; only the first channel enters six fourth-order Butterworth low-pass, high-pass, or band-pass filters. The detector computes positive differences of mean absolute amplitudes in non-overlapping 1024-sample frames, applies a full-track Hann window, and sums the six bands' correlation magnitudes for integer candidates from 60 to 240 BPM.

The strongest qualifying local peak wins; ties retain the lower BPM. Boundary candidates 60 and 240 are excluded, so the detector returns an integer from 61 to 239. Silence, no usable peak, or fewer than two complete frames produces **BPM unknown**, clears the previous detected value, and never substitutes zero. An incomplete final frame is excluded. The entire track is analyzed, with no 180-second cutoff or stereo downmixing. Range mapping and multiplier corrections are separate controls and do not alter the detector's candidate selection.

Decoding and resampling use Web Audio locally, without FFmpeg; numerical results are not guaranteed to match FFmpeg bit for bit. The analysis gain targets a common peak of approximately −12 dBFS and does not modify or export the source audio. A weak first channel, changing tempo, or a very short clip can limit the result. Use a clear beat and preferably more than 10 seconds of audio, then check against listening or Tap Tempo.

### ¥ Mixing Price Calculator

Add dry lead vocals and harmonies separately. Multiple files, drag and drop, and additional batches are supported. The tool excludes silence, adds the active durations, fills the time fields, and calculates a quote.

| Item | Pricing rule |
| :--- | :--- |
| Lead vocals | **CNY 30 per minute** |
| Harmonies | **CNY 20 per minute** |
| Lead fixed prices | For nonzero duration, select **CNY 70** when the time-based price reaches CNY 70, or **CNY 20** when it is below CNY 20; manual overrides are available |
| Total rounding | Optionally round down to the nearest **CNY 5** |

Each file is peak-normalized to **−6 dBFS** in decoded memory, using a shared gain across its channels. Active sound is measured against the default **−60 dBFS** threshold. Adjust the threshold or edit the billable duration, such as `1:30` or `1:30.25`. Source files are not modified.

Durations are summed per file within each category, including overlapping performances on different tracks. Two channels in one stereo file do not double the billable duration. This is sound-activity estimation, not a vocal classifier: accompaniment, breaths, and noise can count. Use isolated dry vocals and check the result.

See the [detailed pricing documentation (Chinese)](cashier/README.md) for detection and billing rules.

## Getting started

### Use the website

Open [takoserver.top](https://takoserver.top/). No installation is required.

### Local development and builds

Node.js and npm are required. See [package.json](package.json) for the declared version range and use a maintained release with current security patches. From the repository root:

```sh
npm ci
npm run dev
```

Open the local URL printed in your terminal. The source `index.html` is a Vite entry point and should be served through the development server.

```sh
npm run build
npm run preview
```

The build creates two versions:

- **`dist/`:** a static site with one app entry point. Tools use `#/audiojoin`, `#/bpmcalc`, and `#/cashier`; the original tool URLs redirect to the corresponding views. `CNAME` is copied automatically. Deploy the contents of `dist/`.
- **`dist/offline/index.html`:** one self-contained HTML file with React, all tools, JavaScript, and styles embedded. Open it directly or copy it to another location; navigation works without extra files or a network connection.

**Audio stays in your browser and is never uploaded.** The offline build requires no CDN or network access. Development dependencies are needed only for installation, development, and builds.

### GitHub Pages

The public site is [takoserver.top](https://takoserver.top/). [The Pages workflow](.github/workflows/pages.yml) validates code, tests, and builds on pull requests, then publishes `dist/` when `main` changes. Pull requests do not deploy to production. Deployment can also be started manually from Actions.

In **Settings → Pages**, select **GitHub Actions** as the source. The build copies the custom-domain `CNAME` and creates `.nojekyll`. Asset paths follow the Pages path prefix, supporting custom-domain roots and repository subdirectories. Hash routing supports direct tool links and refreshes without server-side route configuration.

### Windows desktop package

```sh
npm run build:desktop
```

The Windows build creates a launcher and an offline web ZIP in `outputs/audiojoin/`. The launcher opens the same React app in a browser app window. See the [desktop instructions (Chinese)](audiojoin/使用说明.txt).

### Languages and interaction

The app supports **English, Japanese, and Simplified Chinese**, selectable at the top of every view. This README's language links switch documentation; the app has its own language selector.

- Language preference is saved when browser storage is available.
- Switching languages preserves files, inputs, manual pricing choices, and results, while updating messages and accessibility labels.
- Prices remain in CNY in all languages; there is no currency conversion.
- Mobile layouts and the system's reduced-motion preference are supported.
- Navigation cards and the shared navigation bar switch tools without reloading. Browser history and direct tool links work as expected.
- Files, inputs, quotes, and exports are retained for the current session. Analysis continues when you switch tools. Audio preview pauses when you leave the joiner; keyboard shortcuts and drops apply to the current tool. Closing or refreshing the app clears session data.

The GitHub Star badge links to this repository and fetches its current star count through the public GitHub API. It refreshes every minute while the page is visible, with throttled checks on focus or reconnection. Failed or rate-limited requests back off and retain the last result; an unavailable initial count displays `—`. The offline HTML does not make this request.

## Development

The app uses **React 19, Vite 6, Tailwind CSS 4, and Motion for React**. Navigation, drop zones, status messages, file lists, and animated values are shared components. Language state uses React Context; tempo detection, time parsing, pricing, and WAV processing are separated from rendering.

Tailwind theme tokens live in `src/styles.css`; reusable utility strings are in `src/ui/styles.js`. Styles are compiled locally by the Vite plugin, and the same compiled CSS is embedded in the offline build.

React Strict Mode is enabled in development. Analysis queues use immutable reducer updates; refs coordinate asynchronous jobs and file handles. Effects clean up subscriptions, timers, and processing tasks. `useSyncExternalStore` subscribes to hash navigation, while language context values and translation callbacks are stable. ESLint checks Hooks rules, dependencies, rendering purity, and Fast Refresh; Prettier handles formatting.

Motion animates navigation, view transitions, cards, file lists, and values. `MotionConfig reducedMotion="user"` and CSS media queries honor reduced-motion settings. Tools load lazily and retain state after their first visit. Static hosting requires no server-side routing fallback.

```text
music_tools/
├── src/
│   ├── main.jsx               # Strict Mode entry point
│   ├── App.jsx                # Tool navigation and session state
│   ├── navigation.js          # Hash subscriptions and active-tool context
│   ├── components.jsx         # Shared navigation, drop zones, and animation
│   ├── i18n.js                # Language context and translation Hooks
│   ├── providers/             # Language state provider
│   ├── styles.css             # Tailwind theme and base styles
│   ├── ui/                    # Shared Tailwind utilities
│   ├── pages/                 # Home, WAV joiner, BPM, and pricing
│   ├── hooks/                 # Audio-analysis and Star-refresh state
│   └── lib/                   # Tempo detection, time parsing, and pricing
├── audiojoin/                 # Legacy redirect, WAV engine, desktop packaging
├── bpmcalc/                   # Legacy redirect
├── cashier/                   # Legacy redirect, vocal engine, translations
├── shared/                    # Translation catalog and language preference
├── scripts/build-offline.mjs   # Self-contained offline build
├── tests/                     # Algorithm and browser regression tests
├── README.md                  # English documentation (default)
├── README.ja.md               # Japanese documentation
├── README.zh-CN.md            # Simplified Chinese documentation
├── vite.config.mjs            # Static app build configuration
├── CNAME                      # Custom domain
└── LICENSE                    # GNU AGPLv3
```

Maintain home, BPM, and joiner strings in `shared/translations.js`; pricing strings are in `cashier/translations.js`. Keep placeholders consistent across languages. The WAV and vocal-analysis engines retain browser/CommonJS compatibility for independent tests; React manages UI state and rendering.

### Verification

After installing dependencies, run from the repository root:

```sh
npm test
npm run lint
npm run format:check
npm run build
npm run test:e2e
npm run test:e2e:dev
```

Browser tests require a build first. `test:e2e` checks production artifacts; `test:e2e:dev` exercises the same flows in Strict Mode. On Windows, tests use an installed Edge automatically. Elsewhere, run `npx playwright install chromium` or set `BROWSER_PATH` to a compatible browser executable.

Coverage includes vocal activity, integer BPM detection and boundary rules, pricing, byte-preserving WAV joins, format validation, translations, drag and drop, queued analysis, cancellation, clipboard operations, mobile layouts, reduced motion, offline `file://` use, state retention, background processing, event isolation, redirects, and browser history. Screenshots are written to `tmp/react-qa/`.

## License

Licensed under the [GNU Affero General Public License v3.0](LICENSE).
