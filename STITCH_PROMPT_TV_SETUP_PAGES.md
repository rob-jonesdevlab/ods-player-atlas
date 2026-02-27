# Stitch Prompt: ODS Player TV Setup Pages (Network Setup + Player Link)

## 🎯 Objective
Design **two related full-screen TV pages** that share an identical visual language so the transition between them feels seamless — like a state change, not a page switch. Both display on a 1920×1080 TV connected to a Raspberry Pi running Chromium in kiosk mode.

---

## 📋 Context

**These are the first two screens a user sees after powering on an ODS Player device.** They are sequential steps in the device onboarding flow:

1. **Network Setup** — displayed when the device has no internet. Shows a QR code for connecting to the device's WiFi AP to configure network credentials.
2. **Player Link** — displayed after the device connects to internet. Shows a QR code + pairing code for registering the device to a user's ODS Cloud account.

**The transition between these two pages must feel seamless.** Same card design, same background, same layout — only the content inside changes.

---

## 🎨 Shared Design System

### Background
- **Image**: `ODS_Background.png` — a dark, branded ODS wallpaper with 3D isometric shapes (blue, purple, white tiles) clustered in the lower-right quadrant
- **Overlay**: Dark gradient overlay to ensure card readability
- **No additional ambient glows or blur shapes needed** — the wallpaper handles visual interest

### Glass Card (Central Element)
- **Position**: Centered horizontally and vertically on screen
- **Shape**: Large rounded rectangle (border-radius ~16px)
- **Background**: Semi-transparent white glass effect — `rgba(255, 255, 255, 0.85)` with subtle gradient
- **Border**: `1px solid rgba(255, 255, 255, 0.6)`
- **Shadow**: Layered box-shadow for depth
- **Padding**: Generous — ~40px on desktop, ~56px on large screens
- **Width**: Auto (content-driven), centered

### Typography
- **Font**: Inter (system fallback: -apple-system, BlinkMacSystemFont)
- **All text on the card is dark**: `#1a1a2e` (near-black)
- **ONLY exception**: URL/link text in instructions → blue `#3c83f6`
- **Headings**: Bold, well-spaced
- **Body**: Medium weight, comfortable line-height

### Status Pill (Bottom)
- **Position**: Fixed at 90% vertical height, centered horizontally
- **Design**: Pill-shaped glass element (rounded-full)
- **Contents**: Animated dot (amber/pulsing = waiting, green/solid = connected) + status text
- **Font size**: ~1.05rem, medium weight

---

## 📐 Page 1: Network Setup

### Card Content (top to bottom):

```
┌────────────────────────────────────────────────────┐
│                                                    │
│              Network Setup                         │    ← Bold heading, text-3xl
│        Scan QR code to configure WiFi              │    ← Subtitle, text-xl, semi-transparent
│                                                    │
│            ┌─────────────────────┐                 │
│            │                     │                 │
│            │     [QR CODE]       │                 │    ← 380×380px, white bg, rounded, shadow
│            │     (380×380)       │                 │
│            │                     │                 │
│            └─────────────────────┘                 │
│                                                    │
│            ODS-VIVID-STONE-RICH                    │    ← Device SSID, large bold text (~36-48px)
│                                                    │
│            ① Scan QR code to connect               │    ← Blue numbered circle, dark text
│            ② Open your favorite browser            │    ← Gray numbered circle, dark text
│            ③ Enter network info and connect         │    ← Gray numbered circle, dark text
│                                                    │
└────────────────────────────────────────────────────┘

              ◉ Waiting for network...                    ← Glass pill, amber pulsing dot
```

### Instruction Step Styling
- **Step number circles**: 40×40px, rounded-full
  - Step 1: Blue background (`#3c83f6` at 20% opacity), blue text, blue border (30% opacity)
  - Steps 2-3: Light gray background (`#f3f4f6`), dark text, light gray border (`#e5e7eb`)
- **Step text**: `text-xl`, dark `#1a1a2e`, `font-medium`
- **Spacing**: 16px between steps (`space-y-4`)
- **Alignment**: Left-aligned text, vertically centered with circle

---

## 📐 Page 2: Player Link (Pairing)

### Card Content (top to bottom):

```
┌────────────────────────────────────────────────────┐
│                                                    │
│              Pair Your Device                      │    ← Bold heading, text-3xl (was missing!)
│        Register this screen to your account        │    ← Subtitle, text-xl, semi-transparent
│                                                    │
│            ┌─────────────────────┐                 │
│            │                     │                 │
│            │     [QR CODE]       │                 │    ← 256×256px, white bg, rounded, shadow
│            │     (256×256)       │                 │
│            │                     │                 │
│            └─────────────────────┘                 │
│                                                    │
│                PAIRING CODE                        │    ← Uppercase label, text-2xl, tracking-wide
│               98S-X8N                              │    ← Monospace, ~72px, bold, dark
│                                                    │
│        ① Scan the QR code or visit                 │    ← Blue circle
│           ods-cloud.com/pair                       │       URL text is BLUE #3c83f6
│        ② Log in to your ODS Cloud account          │    ← Gray circle, all dark text
│        ③ Enter the code above to register          │    ← Gray circle, all dark text
│          this screen                               │
│                                                    │
└────────────────────────────────────────────────────┘

         ◉ Waiting for pairing...  Code 3/5             ← Glass pill, amber pulsing dot
```

### Key Differences from Network Setup
| Element | Network Setup | Player Link |
|---------|--------------|-------------|
| Heading | "Network Setup" | "Pair Your Device" |
| Subtitle | "Scan QR code to configure WiFi" | "Register this screen to your account" |
| QR size | 380×380 | 256×256 |
| Prominent text | Device SSID (ODS-VIVID-STONE-RICH) | Pairing code (98S-X8N) in monospace |
| Label above prominent | *(none or "Network")* | "PAIRING CODE" |
| Step 1 | "Scan QR code to connect" | "Scan the QR code or visit **ods-cloud.com/pair**" |
| Step 2 | "Open your favorite browser" | "Log in to your ODS Cloud account" |
| Step 3 | "Enter network info and connect" | "Enter the code above to register this screen" |
| Status pill | "Waiting for network..." | "Waiting for pairing... Code 3/5" |

---

## 🔑 Critical Design Constraints

1. **NO Tailwind CDN dependency for Network Setup** — this page renders in AP mode (no internet). All styling must be inline CSS or `<style>` block. Player Link has internet, so Tailwind CDN is fine.

2. **Text hierarchy matters** — the card should have clear visual hierarchy:
   - Heading (largest, boldest)
   - QR code (visual focus)
   - Prominent text (SSID or pairing code — second visual focus)
   - Instructions (supporting, readable but not dominant)
   - Status pill (tertiary, ambient)

3. **The card must fit on a 1920×1080 TV** with the status pill visible at 90% height. Don't let the card overflow.

4. **Only the URL in the instructions should be blue** (`#3c83f6`). Everything else on the card is dark `#1a1a2e`. Step 1 circle is blue-tinted, steps 2-3 circles are gray.

5. **Both pages transition via a JavaScript redirect.** When network connects, Network Setup auto-redirects to Player Link with a 3-second delay (pill turns green + "Connected!" first).

---

## ✅ Acceptance Criteria

- [ ] Both pages use identical card shell (glass-card, shadow, border, padding)
- [ ] Both pages use identical background (ODS_Background.png, center/cover)
- [ ] Both pages use identical status pill design (positioned at 90% vertical)
- [ ] Both pages use identical instruction step styling (circle + text)
- [ ] Card has a clear heading ("Network Setup" / "Pair Your Device")
- [ ] Instructions are readable but don't dominate the card
- [ ] Only URL text (ods-cloud.com/pair) is blue — all other text is dark
- [ ] Card fits on 1920×1080 without pushing status pill off screen
- [ ] Network Setup page works WITHOUT Tailwind CDN (CSS fallbacks)
- [ ] Transition between pages feels like a state change, not a page switch

---

## 🎯 Design Inspiration
Think Apple TV setup screens, Sonos speaker pairing, or Chromecast setup — clean, confident, minimal text, strong visual hierarchy with the QR code as the hero element and instructions as supporting guidance.
