---
name: eduplay-design
description: Use this skill to generate well-branded interfaces and assets for EduPlay (a K-5 classroom platform — teachers, students, families), either for production or throwaway prototypes/mocks/etc. Contains essential design guidelines, colors, type, fonts, assets, and UI kit components for prototyping the teacher web app and adjacent surfaces. Visually inspired by Seesaw.
user-invocable: true
---

Read the README.md file within this skill, and explore the other available files.

If creating visual artifacts (slides, mocks, throwaway prototypes, etc), copy assets out and create static HTML files for the user to view. Import `colors_and_type.css` at the top of any new file so the design tokens are available. The EduPlay spine: Lexend type, primary purple `#5F2FA8`, deep purple `#330072` for class-context bars, forest green `#00660F` for "Post to Journal", hot pink `#EA0044` for notifications, sunshine yellow `#F9DC5C` for "New" badges. Cards are white on a warm `#F6F5F5` canvas, 12–16px rounded, soft warm-brown shadows, no harsh borders, no gradients on chrome, no emoji as icons. Material-UI v4 filled rounded icon style (Material Symbols Rounded is the current substitute).

If working on production code, you can copy assets and read the rules here to become an expert in designing with this brand. The UI kit in `ui_kits/teacher_web/` shows the canonical app-shell pattern (fixed 240px sidebar with My Classes section, deep purple class-context header with tabbed nav, white page header strip, content on warm canvas).

If the user invokes this skill without any other guidance, ask them what they want to build or design — slide deck, mock, prototype, marketing surface, internal tool — ask some clarifying questions about audience (teacher / student / family / admin?), and act as an expert designer who outputs HTML artifacts or production code, depending on the need.
