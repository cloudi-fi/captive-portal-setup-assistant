# Captive Portal Setup Assistant

A static page that turns a Cloudi-Fi location's splash page URL into paste-ready controller configuration
(CLI or a settings sheet) for ~35 network platforms, following the Cloudi-Fi deployment KB
(help.cloudi-fi.com, "Captive Portal deployment"). It is published as-is on GitHub Pages: what is merged
into `main` is what customers see.

## Who you are working with

Most contributors are Cloudi-Fi colleagues who know captive portals and network controllers well and do not
write code. Speak in their terms (platform, SSID, walled garden, RADIUS), not code terms. Before editing,
say in one or two plain sentences what you will change and in which file. After editing, show the result
on the page, not the diff.

## Ground rules

- **No secrets in the repository.** RADIUS shared secrets, VPN pre-shared keys, UAM secrets, API keys and
  passwords stay empty in the code (`value=""`, `def: ""`). A secret reaches the page only through the
  shareable link, typed by the user. If someone asks to prefill a secret, explain why it cannot be in a
  public repository and suggest sharing a link that contains it. Example data uses made-up values; never a
  real customer's company hash, location hash or splash URL.
- **No build step.** Plain HTML, CSS and JavaScript files loaded by `index.html`. The page uses no npm
  packages, bundler or framework; external resources: Google Fonts only. The one npm dependency lives in
  `tests/` and is for testing only.
- **The KB is the source.** Every platform links to its KB article (`kb` in `assets/js/platforms.js`).
  Where the KB is unclear, contradicts itself, or the CLI is translated from GUI steps, write it as a
  `notes` entry or a `VERIFY:` comment in the generated CLI instead of guessing silently.
- **Interface text is English**, short and plain. Action labels are short verbs ("Copy", "Copy link").

## How the page is built

Scripts load in this order (each file uses names defined by the files above it):

| File | What lives there |
|---|---|
| `assets/js/config.js` | Cloudi-Fi infrastructure: RADIUS server IPs, portal endpoints, walled-garden domains per login method (`VENDORS`) |
| `assets/js/generators.js` | One function per platform (`g9800`, `gForti`…) that returns the CLI blocks / settings sheets and the "Before you deploy" notes |
| `assets/js/troubleshooting.js` | Troubleshooting commands per platform family (`TS`, mapped by `TSMAP`) |
| `assets/js/platforms.js` | The platform catalogue `P`: name, KB article, `/sp/` value, extra fields, generator; plus `KB_INDEX` |
| `assets/js/app.js` | The form, the shareable link, splash URL parsing, rendering |
| `assets/css/style.css` | Styles; colors are tokens on `:root`, redefined for dark mode |

Adding a platform: an entry in `P` (`platforms.js`), a generator (`generators.js`), and a `TSMAP` entry
(`troubleshooting.js`). Add per-platform inputs as `fields` on the entry; `app.js` renders them and adds
them to the shareable link with no further work.

## Shareable link

The whole form is saved in the URL fragment (`#platform=fortios&loc=Paris&…`) so a link reproduces the
configuration. The fragment is never sent to a server, which is why secrets may travel in it.
Only values that differ from the defaults, and only fields visible for the current platform, are written.
A new input in `index.html` must have an `id` and be listed in `STATIC` (`app.js`) to be saved in the link;
platform `fields` are saved automatically.

The splash URL box stays in sync both ways with the rest of the form, and is what the link saves:
- "Company hash" (`/ch/`) and "Location hash" (`/lh/`) are read from the URL and written back into it.
- `/sp/` follows the platform: picking a platform writes its `sp` value into the URL (none for the SAML
  forms), and typing or pasting a URL whose `/sp/` belongs to another platform switches to the first
  platform in `P` with that value. Extreme WiNG keeps the URL exactly as pasted, as its KB article says.

## Form layout

One field per line: a label, then the control. Explanations go in a `?` tooltip next to the label (the
`hint` property for platform fields; the `.tip` markup in `index.html` for the others), never as a
subtitle under the label. Use a tooltip only when the label alone leaves a real question.

## Checking a change

A change is done when all of these hold:

1. `npm test` in `tests/` passes (first time: `npm install` there; it drives the Chrome already installed
   on the machine, set `CHROME_PATH` if Chrome is elsewhere). When you change how the form behaves, add or
   update a test in `tests/browser.test.js` in the same change.
2. Open `index.html` in a browser (double-clicking the file works, no server needed) and the developer
   console shows no errors.
3. The platforms you touched render without a "Generator error" box, with the default splash URL
   (`https://login.cloudi-fi.net/start/ch/acme/lh/demo`).
4. "Copy link", opened in a new tab, brings back the same form and output.
5. The page still reads well in light and dark mode and at phone width (no sideways scrolling).
6. `git diff` contains no secret and no real customer data.

## Contributing

Work on a branch and open a pull request into `main`; merging publishes the page. Commit messages and pull
request text are in English.
