# Custom Google Translate Integration

A drop-in replacement for the default Google Translate widget that renders a fully custom, searchable language picker while keeping the actual translation powered by the Google Translate API — no API key required.

---

## Files

| File | Purpose |
|---|---|
| `components/Translator/ScriptOne.js` | Loads the hidden Google Translate widget, patches React's DOM mutations, exports `changeLanguage` and `resetToEnglish` |
| `components/Translator/GoogleTranslator.js` | Custom floating UI (button + searchable dropdown) |

---

## How It Works

### 1. Loading the Widget Without Showing It

Google Translate works by injecting a `<select>` element (`.goog-te-combo`) into the DOM that, when changed, translates the entire page. We load the widget normally but **hide every visible piece of it** with injected CSS:

```css
.goog-te-banner-frame,
#goog-gt-tt,
.goog-te-balloon-frame,
.skiptranslate iframe {
  display: none !important;
}
body {
  top: 0 !important;        /* prevents the page from shifting down */
}
#google_translate_element {
  display: none !important;
}
```

The widget is still fully functional — it just has no visible UI.

### 2. Initialising the Widget

```js
window.googleTranslateElementInit = () => {
  new window.google.translate.TranslateElement(
    {
      pageLanguage: "en",
      includedLanguages: "fr,es,de,pt,...",
      multilanguagePage: true,
    },
    "google_translate_element"   // id of the hidden div
  );
};
```

The Google Translate script calls `window.googleTranslateElementInit` automatically once it loads.

### 3. Programmatically Changing the Language

The hidden `<select>` is the control surface. To translate the page:

```js
export function changeLanguage(langCode) {
  const attempt = (tries) => {
    const select = document.querySelector(".goog-te-combo");
    if (select) {
      select.value = langCode;           // e.g. "fr", "es", "zh-CN"
      select.dispatchEvent(new Event("change"));
      return;
    }
    // Retry because the widget loads asynchronously
    if (tries > 0) setTimeout(() => attempt(tries - 1), 300);
  };
  attempt(10);  // up to ~3 seconds of retries
}
```

The retry loop is essential — the script loads with `strategy="afterInteractive"` and the `<select>` isn't in the DOM immediately.

### 4. Resetting to English

Simply setting `select.value = ""` is not always enough because Google Translate also writes a **`googtrans` cookie** that persists the language choice. Both must be cleared:

```js
export function resetToEnglish() {
  // 1. Clear the cookie on the root path and domain
  const expiry = "expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
  document.cookie = `googtrans=; ${expiry}`;
  document.cookie = `googtrans=; ${expiry} domain=${window.location.hostname}`;

  // 2. Reset the hidden select
  const attempt = (tries) => {
    const select = document.querySelector(".goog-te-combo");
    if (select) {
      select.value = "";
      select.dispatchEvent(new Event("change"));
      return;
    }
    if (tries > 0) setTimeout(() => attempt(tries - 1), 300);
  };
  attempt(10);
}
```

### 5. Fixing the React + Google Translate Crash

Google Translate wraps every text node in a `<font>` element. When React then tries to reconcile state changes, it calls `removeChild` on nodes that have been moved, throwing:

```
NotFoundError: Failed to execute 'removeChild' on 'Node':
The node to be removed is not a child of this node.
```

**Fix:** Patch `Node.prototype` to no-op instead of throw:

```js
if (typeof Node === "function" && Node.prototype) {
  const originalRemoveChild = Node.prototype.removeChild;
  Node.prototype.removeChild = function (child) {
    if (child.parentNode !== this) return child;   // <-- guard
    return originalRemoveChild.apply(this, arguments);
  };

  const originalInsertBefore = Node.prototype.insertBefore;
  Node.prototype.insertBefore = function (newNode, referenceNode) {
    if (referenceNode && referenceNode.parentNode !== this) return newNode; // <-- guard
    return originalInsertBefore.apply(this, arguments);
  };
}
```

This patch runs once in a `useEffect` before the translate script loads.

### 6. Custom UI (`GoogleTranslator.js`)

The custom picker is a standard React component that:

- Renders a floating `<button>` showing the current flag + language name
- On click, opens a dropdown panel with a search `<input>` and a scrollable `<ul>`
- On language select, calls `changeLanguage(code)` or `resetToEnglish()`
- Closes on outside click via a `mousedown` listener
- Matches `isDarkMode` prop for dark/light theming

```jsx
<GoogleTranslate isDarkMode={isDarkMode} />
```

The `<Scripter />` (the hidden widget) is rendered inside `GoogleTranslate` so they are always co-located.

---

## Usage

Place the component wherever you want the language picker to appear (e.g. in a layout or page):

```jsx
import GoogleTranslate from "@/components/Translator/GoogleTranslator";

export default function Page() {
  const { isDarkMode } = useTheme();
  return (
    <>
      <GoogleTranslate isDarkMode={isDarkMode} />
      {/* rest of page */}
    </>
  );
}
```

---

## Language Codes

Google Translate uses standard [BCP 47](https://tools.ietf.org/html/bcp47) codes with two exceptions:

| Language | Code used |
|---|---|
| Hebrew | `iw` (not `he`) |
| Chinese Simplified | `zh-CN` |
| Chinese Traditional | `zh-TW` |

---

## Limitations

- **No API key** — uses the free embeddable widget. Google may rate-limit heavy usage.
- **Cannot translate back perfectly** — Google Translate modifies the live DOM; extremely complex React subtrees may have minor visual glitches after translation.
- **Cookie persistence** — the `googtrans` cookie persists the selected language across page navigations within the same session. `resetToEnglish()` clears it.
