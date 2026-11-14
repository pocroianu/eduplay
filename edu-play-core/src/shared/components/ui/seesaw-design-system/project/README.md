# EduPlay Design System

A design system for **EduPlay**, a K-5 classroom platform for teachers, students, and families. Visually inspired by Seesaw — the same warm purple-and-green DNA, Lexend everywhere, friendly classroom-photography vibe — but its own brand.

> ⚠️ **Status:** This is a from-scratch design system whose **visual + structural inspiration** is the Seesaw teacher web app. We pulled tokens (color, type scale, motion, layout) and component patterns (sidebar, class-context header, feature cards, journal feed) from authenticated Seesaw HTML captures, then rebuilt them under the EduPlay name with our own logo and product naming. The system is for EduPlay use; it is not affiliated with or endorsed by Seesaw.

---

## What is EduPlay?

EduPlay is a **classroom platform for elementary educators**. Teachers build a class, post activities, students respond with multimedia (drawing, photo, video, audio), families see the journal in real time.

Audiences:
- **Teachers** (the primary surface): build classes, create activities, post to the journal, message families, grade work, run AI-assisted lesson prep with **EduPlay AI**.
- **Students** (planned): a simplified web/iPad surface with the same purple/green DNA, big tap targets, read-aloud support.
- **Families** (planned): a mobile-first journal view + 1:1 messaging.

Personality: **warm, bright, K-5 classroom-friendly**. Saturated purple as the brand spine, a forest-green "Post to Journal" accent, hot-pink notification dots, sunshine-yellow "New" badges, Lexend everywhere. Curves are soft, shadows are gentle, density is modest.

---

## Source materials

This system was assembled from:

- **Captured HTML snapshots** of the authenticated Seesaw teacher web app (`app.seesaw.me`) exported to `uploads/` with computed styles inlined. ~40 screens including Home, Class Journal / Activities / Gradebook / Notifications, Class Settings, Create Activity (assessment + AI generate), Seesaw AI, Explore Libraries, My Library, Messages, Account Settings, Add Students/Families, and various settings subpages.
- **Screen previews** (PNG) for Home, Class Settings, Index, Select Language.

The captures preserve the visible DOM with scripts removed and computed styles inlined — so the dimensions, color tokens, font stacks, and component structure are verbatim from production at capture time. We use them as a *visual reference* for what a well-built K-5 eduplay UI looks like, then rebuild under the EduPlay brand.

No Figma file, codebase, or brand-guide PDF was provided. Anything that wasn't directly observable in the captures (dark-mode behavior, exact pressed-state animations, custom illustration library) is reasoned from screenshots and is flagged in the caveats below.

---

## Files in this system

### Foundations
- [`colors_and_type.css`](./colors_and_type.css) — CSS custom properties: full color palette, type scale, radii, shadows, spacing, layout dimensions, motion tokens. Import this first.
- [`README.md`](./README.md) — this file.
- [`SKILL.md`](./SKILL.md) — agent-skill manifest, compatible with Claude Code Agent Skills.

### Assets
- [`assets/eduplay-logo.svg`](./assets/eduplay-logo.svg) — EduPlay logo (tile mark + Lexend wordmark).
- [`assets/class-icon-placeholder.svg`](./assets/class-icon-placeholder.svg) — class avatar placeholder.

### UI Kits
- [`ui_kits/teacher_web/`](./ui_kits/teacher_web) — interactive React/JSX recreation of the EduPlay teacher web app. App shell + sidebar, Home, Class drill-in (Journal · Activities · Gradebook · Notifications), EduPlay AI, Explore, Library, Messages.

### Preview cards
- [`preview/*.html`](./preview) — small specimen cards (≈700×variable) registered to the Design System tab.

---

## CONTENT FUNDAMENTALS

EduPlay's copy is **warm, plain-spoken, and second-person**. It addresses teachers as **"you"** and refers to students as **"students"** or by name. It avoids edu-jargon, ALL-CAPS shouting, and exclamation marks. Sentence case is the default everywhere except small eyebrow labels (CLASS SETTINGS, STUDENTS) which are uppercase with wide tracking.

### Voice & tone
- **Encouraging, not cheerleading.** "Welcome, Geani Pocroianu" — a polite greeting, not "Hi superstar! 🎉".
- **Helpful subtitles.** Big CTAs always carry a one-line clarifier explaining *what* the action gives you:
  - "Post to Journal" → *A portfolio with photos, videos, and more*
  - "Create Activity" → *With engaging multimedia responses*
  - "Generate Activity" → *From resource, topic or YouTube video*
  - "Message Family" → *Announcements, group, and 1:1*
- **Imperatives for actions, declaratives for status.** Buttons read "Add", "Scan", "Post", "Assign". Status reads "3 students", "1 post", "Teacher · 1 class".
- **Grade-level specificity.** Headings name the grade: "Find Ready-to-Teach Activities in 1st Grade", "Popular Community Activities in 1st Grade".
- **No emoji in chrome.** Despite being a K-5 product, the *teacher* surface never uses emoji as icons. Emoji appear only inside student/family generated content.

### Casing
- **Sentence case** for buttons, card titles, page titles, menu items.
- **Title Case** for proper-noun product features: "EduPlay AI", "Explore Libraries", "My Library", "My Classes", "Home Learning Codes".
- **UPPERCASE with wide tracking** for small group labels inside settings panels: "STUDENTS", "CLASS SETTINGS".
- **No all-caps in body copy or buttons.**

### Vibe
- The platform feels like a **friendly teacher's planner**, not a SaaS dashboard.
- Copy assumes the reader is a **busy teacher** — short, scannable.
- Microcopy is generous: every nav item has a label *and* an icon.
- **Notifications are subtle.** A small magenta dot on a class chip, not a number badge with motion.

---

## VISUAL FOUNDATIONS

### Color
- **Primary purple `#5F2FA8`** is the spine. Logo, active-nav fill, primary CTA, focus ring base, every primary icon. Used liberally but always on white or lavender.
- **Deep purple `#330072`** is reserved for the **class-context top bar** — the wide dark strip across the top of a class when you've drilled into Journal/Activities/Gradebook/Notifications.
- **Forest green `#00660F`** is the **"Post to Journal"** card and only Post to Journal. It signals capturing/saving student work. Generic success messages use a calmer `#006D3F`.
- **Hot pink `#EA0044`** is for **notification dots and destructive confirmations**. Never decorative.
- **Sunshine yellow `#F9DC5C`** is the "New" badge background and the occasional spotlight banner. Always with `#1E0D03` text.
- **Surface neutrals are slightly warm.** `#FAF6FA` (lavender-tinted) for the app shell sidebar and page tints; `#F6F5F5` for canvases; `#F2F5F8` (cool) for inset panels. White is reserved for cards.
- **Text is `#1E0D03`** — almost black, but warmed with a hint of brown. Pure `#000` is never used for body copy.

### Typography
- **Lexend** is *the* typeface. 95% of UI. Weights 400 (body), 500 (light emphasis), 600 (buttons, labels), 700 (headings), 800 (display).
- **Quicksand** is a soft rounded display option on student-facing chrome (class theme names, kids' avatars). Not used in the teacher dashboard.
- **DM Serif Text** is used very sparingly on marketing slides and the trial-upsell sheet.
- Headings are tight (`line-height: 1.2`, slight negative tracking). Body is `1.45`. No condensed weights.

### Backgrounds
- **No hand-drawn illustrations on chrome.** The teacher surface is clean white cards on a quiet warm-gray canvas.
- **Activity thumbnails are full-bleed photos** with white capsule captions overlaid — colorful, kid-warm imagery.
- **No gradients on UI surfaces.** The only gradient is on the EduPlay AI hero icon (purple-600 → purple-900) and inside teacher-picked class banners.
- **No repeating patterns or textures.** Surfaces are flat-color.

### Animation
- **MUI's `cubic-bezier(0.4, 0, 0.2, 1)`** is the universal easing.
- **200ms** is the standard duration for color/box-shadow transitions. **300ms** for layout/transform.
- **No bounces, no springs.** Even on student-facing surfaces, motion is gentle and brief.
- **Hover transitions** fade `background-color` and `box-shadow` together; never scale.

### Hover & press
- **Buttons**: on hover, background darkens ~10% (purple-600 → purple-500). On press, darkens further to purple-400 + 1px translateY, no scale.
- **Cards**: hover raises shadow from `sm` to `md` and lightens overlay 4%. No transform.
- **Nav items**: hover paints `#E5E1E6`; active state paints `#F3EBFF` with purple-600 text/icon.
- **Icon buttons**: subtle `background: rgba(95,47,168,0.08)` ring on hover.

### Borders
- **Default**: `1px solid #D8DDE3`. **Subtle divider**: `1px solid #E4E1E6`. **Hairline**: `1px solid #EAEBEB`.
- **No double borders, no dashed borders, no thick colored borders.**
- **No "left-edge accent border" cards** — EduPlay never uses that pattern.

### Shadows & elevation
- **Card resting**: `0 1px 3px rgba(30,13,3,0.08), 0 1px 2px rgba(30,13,3,0.04)`.
- **Hovered / popover**: `0 4px 12px rgba(30,13,3,0.08)`.
- **Dropdown / floating menu**: `0 8px 24px rgba(30,13,3,0.14)`.
- **Modal**: `0 24px 64px rgba(30,13,3,0.24)`.
- Shadows always use the warm-brown ink color at low alpha, never pure black.

### Protection gradients vs capsules
- Labels overlaying imagery (activity thumbnail captions) use **white capsule pills** (`background: rgba(255,255,255,0.95)`), not dark gradient scrims. Bright + kid-friendly, not cinematic.

### Layout rules
- **Fixed left sidebar** (240px expanded, 64px collapsed) — always visible, never overlays.
- **Class context bar** (88px, deep purple) at the top of any class drill-in, with tabbed nav (Journal · Activities · Gradebook · Notifications). Pushes content down — does not float.
- **Page header** (72px white strip) for global pages, with left-aligned title and right-aligned primary CTA.
- **Cards live on a quiet `#F6F5F5` canvas**, never directly on white.

### Transparency & blur
- **No backdrop-blur** anywhere in the teacher UI.
- Transparency appears only in modal overlays (`rgba(30, 13, 3, 0.25)` scrim) and rare image-caption pills.

### Imagery vibe
- **Warm.** Pastel pinks, peachy yellows, soft teals.
- **K-5 classroom-photography** style for activity thumbnails: real classrooms, real kid handwriting, real manipulatives. Never stock-art.
- **No grain, no duotone, no b&w.** Colors stay saturated and clean.

### Corner radii
- 4px chips/badges · 6px small inputs · 8px buttons/inputs · 12px cards · 16px feature cards · 20px modal sheets · 999px avatars + pills.
- **Nothing is sharp-cornered.** Even cells inside the gradebook have ≥ 4px rounding.

### What cards look like
- White (`#FFFFFF`) bg · **12–16px corner radius** · **no visible border** (shadow does the lifting) · padding 16px (small) / 24px (feature) · Lexend 16/22 body + 700/18 title · imagery clipped edge-to-edge by the radius.

---

## ICONOGRAPHY

EduPlay's icon set is **filled, rounded-corner**, modeled on Material-UI v4's `SvgIcon` set as seen in the Seesaw captures. Every icon is a 24×24 inline SVG with `fill: currentColor`, sized via `font-size`.

### Strategy in this design system
- **Library used:** [Material Symbols Rounded](https://fonts.google.com/icons) (Google Fonts variable icon font), loaded from CDN. **Substitution flagged** — production EduPlay should ship a custom MUI v4-style filled rounded set (with custom Journal/Activity/Library/Class-Theme glyphs) to match the source visual register.
- **No emoji as icons.** Anywhere.
- **No unicode-character icons** (no `▶`, `★`, etc).
- **Custom marks live in `assets/`** — the EduPlay logo, the class-icon placeholder.

### Tones
- `--ss-fg-muted` (#524B59) — resting nav icons, secondary glyphs.
- `--ss-primary` (#5F2FA8) — active nav, primary action icons.
- `--ss-success` (#006D3F) — submitted / completed indicators.
- `--ss-danger` (#EA0044) — notification dot, destructive icons.
- `--ss-ink-400` — disabled.

### Where to put what
- Sidebar nav: filled rounded, 24px, muted resting / primary active.
- Buttons: 20px, paired with text. Icon-only buttons get a tooltip.
- Card headers (Post to Journal, etc.): 28–32px white-on-color.
- Class header tabs: 24px white.

---

## Index

| Path | What it is |
| --- | --- |
| `colors_and_type.css` | Design tokens — colors, type, radii, shadows, spacing, motion. Import first. |
| `assets/eduplay-logo.svg` | EduPlay logo: tile mark + Lexend wordmark. |
| `assets/class-icon-placeholder.svg` | Class-avatar placeholder, color tile + abbreviation. |
| `preview/*.html` | Small specimen cards registered in the Design System tab. |
| `ui_kits/teacher_web/index.html` | Interactive recreation of the EduPlay teacher web app. |
| `ui_kits/teacher_web/components/*.jsx` | App shell, sidebar, class header, home cards, journal feed, AI page, etc. |
| `SKILL.md` | Agent-skill manifest (Claude Code compatible). |

---

## Caveats & known gaps

- **EduPlay-as-Seesaw mapping is one-directional.** The visual register, layout patterns, and component anatomy are reverse-engineered from Seesaw HTML captures. EduPlay-specific brand details (the *actual* EduPlay logotype, illustration system, marketing tone, mascot if any) are placeholders pending real EduPlay brand input.
- Dark-mode behavior is unknown; this system is light-mode only.
- Student and family product surfaces are not represented.
- Marketing website styling is not represented.
- Fonts load from Google Fonts. Lexend covers all needed weights; **a custom handwriting font for student writing-practice surfaces is a known gap.**
- Icon set is a Material Symbols Rounded substitution — flagged.
- Activity thumbnail imagery is represented by CSS gradients, not real photography. Real EduPlay activity photos are a known gap.
