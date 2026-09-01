# LumiScore

Production-quality frontend prototype for **LumiScore**, an international book-discovery and rating platform. The app is built with Next.js App Router, React, TypeScript, and a global design-token system.

## Run locally

Requirements: Node.js 22.13+ and pnpm.

```bash
pnpm install
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

Production checks:

```bash
pnpm build
pnpm lint
```

## Open Library seed importer

The importer is a server-only script. It fetches metadata for 100 seed books
from Open Library and inserts or updates `authors`, `works`, and `editions`
without duplicating Open Library IDs.

Add the following values to `.env.local`:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=your-project-url
SUPABASE_SECRET_KEY=your-server-only-secret-key
```

Keep the secret key server-side and never prefix it with `NEXT_PUBLIC_`. Then
run the matching tests, followed by the importer, explicitly from the project
root:

```bash
pnpm test:importer-matching
pnpm import:open-library
```

The script is not part of the app runtime and never runs during development,
builds, or deployments. The balanced seed catalog lives in
`scripts/open-library-seeds.ts`; every entry includes a category, expected
author, and original or approximate first-publish year. Add an original-language
title to `alternateTitles` when Open Library's canonical work title differs from
the familiar English title. Set `preferredDisplayTitle` when LumiScore should
store a different reader-facing title in `works.title`; Open Library IDs remain
unchanged for deduplication. The matching test also guards the total count,
category distribution, unique seed identities, and the original ten titles.

## Included

- Ink dark and Paper light themes with first-visit system preference detection and persisted selection
- Responsive editorial hero and personalized recommendation panel
- Typed local book data separated from presentation code
- Client-side title, author, and genre filtering
- Persistent “Want to read” controls
- Mobile expandable search and swipeable book shelf
- Keyboard focus states and `Ctrl/⌘ + K` search shortcut
- Open Graph and X social-preview metadata

## Project structure

```text
app/
  components/LumiScoreHome.tsx  # Reusable page components and interactions
  data/books.ts                 # Typed mock data
  globals.css                   # Theme tokens and responsive presentation
  layout.tsx                    # Metadata and pre-hydration theme setup
  page.tsx                      # App Router entry page
public/
  assets/                       # Original generated hero scenes
  og.png                        # LumiScore social card
```

## Generated art

All three project images were created with OpenAI’s built-in image-generation tool for this implementation. They contain no scraped book-cover artwork.

### `public/assets/dark-reading-scene.png`

```text
Use case: photorealistic-natural
Asset type: website hero background for a premium international book-discovery platform
Primary request: a moody, cinematic private library reading scene with tall shadowed bookshelves, a warm brass reading lamp, a stack of hardback books and an open book resting on a dark wooden desk
Scene/backdrop: refined old-world library interior, deep midnight ink-blue shadows, no people
Style/medium: photorealistic editorial interior photography with restrained cinematic polish
Composition/framing: wide landscape composition; main books and warm lamp clustered toward the right half; calm dark negative space on the left for large website headline; crop must remain convincing at desktop and mobile
Lighting/mood: a single warm pool of amber lamplight, quiet, intelligent, premium, literary
Color palette: #071720, #0B1F29, #102B35, warm amber and subtle muted teal
Materials/textures: natural book cloth, softly worn paper edges, dark wood grain, aged brass
Constraints: no readable text, no logos, no trademarks, no watermark, no people, no bright daylight, no floating objects
Avoid: fantasy magic effects, generic corporate styling, excessive orange, cluttered composition
```

### `public/assets/light-book-stack.png`

```text
Use case: photorealistic-natural
Asset type: website hero background for the light theme of a premium international book-discovery platform
Primary request: an elegant sunlit editorial still life with a stack of tasteful clothbound hardback books on pale stone or marble, beside a matte ivory ceramic vase holding a few natural green leafy stems
Scene/backdrop: warm cream bookstore-editorial environment, softly textured plaster wall, natural window light, no people
Style/medium: photorealistic high-end lifestyle and interiors photography, restrained and believable
Composition/framing: wide landscape composition; vase and books clustered toward the right half; generous softly lit cream negative space on the left for a large website headline; crop must remain convincing at desktop and mobile
Lighting/mood: calm diffused morning daylight, quiet, refined, inviting, premium independent bookstore
Color palette: #F4EFE6, #FFFAF2, pale warm greys, muted sage green, subtle #42646B accents
Materials/textures: uncoated paper, book cloth, pale honed stone, matte ceramic, real leaf texture
Constraints: no readable text, no logos, no trademarks, no watermark, no people, no hard black shadows, no saturated colors
Avoid: sterile corporate stock photo, glossy luxury excess, clutter, fake typography, dramatic dark lighting
```

### `public/og.png`

```text
Use case: ads-marketing
Asset type: social-preview image, 16:9 landscape
Primary request: Create one cohesive premium literary editorial brand card for a book-discovery product.
Scene/backdrop: Deep ink-blue field with refined warm off-white editorial paper shapes and very subtle abstract book-spine, page, and library-shelf motifs; elegant, restrained, atmospheric, not literal stock photography.
Subject: The typographic LumiScore brand and its reading-discovery message.
Style/medium: Premium literary editorial design, contemporary book-journal sophistication, crisp print-inspired typography, subtle paper grain, generous negative space, tasteful fine rules and softly luminous page-edge details.
Composition/framing: Exact 16:9 landscape card; balanced central hierarchy; the title is the strongest element, with headline directly beneath it; subtle motifs frame rather than compete; safe margins for social preview cropping.
Lighting/mood: Quietly luminous, intelligent, inviting, refined.
Color palette: Ink #071720 as the dominant background, muted teal #42646B, golden ochre #E2A24C, and warm off-white only.
Text (verbatim): "LumiScore" and "Find your next great read"
Typography: Render “LumiScore” exactly, large and exceptionally legible, in a high-contrast premium editorial serif; render “Find your next great read” exactly, clearly legible, in a clean complementary typeface. Spell the title L-u-m-i-S-c-o-r-e. Preserve capitalization exactly.
Constraints: exactly one finished social card; only the two supplied text strings; no other text, letters, numbers, logos, icons, badges, watermarks, UI, mockup frame, or private data. No misspellings or extra punctuation. Keep all copy fully legible at thumbnail size.
Avoid: generic tech aesthetic, neon colors, busy collage, photorealistic people, visible book titles, illegible microtype, decorative glyphs that resemble text, gradients outside the specified palette.
```
