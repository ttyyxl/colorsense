# Home Dashboard Redesign Design

## Goal

Refactor the ColorSense home page into an app-like dashboard entry point with an approachable luxury visual tone. The page should feel refined, warm, and interactive while preserving the existing multi-page product structure.

## Non-Goals

- Do not merge `/upload`, `/outfit`, `/history`, or `/result/[id]` into the home page.
- Do not remove or break existing routes.
- Do not implement the full color diagnosis flow on the home page.
- Do not implement persistent palette exploration state on the home page.

## Route Strategy

The home page remains a dashboard and preview surface. Primary actions and preview cards navigate to existing routes:

- Start diagnosis: `/upload`
- View history: `/history`
- Today's outfit: `/outfit`
- Style profile: `/profile/style`

## Component Architecture

```text
src/
  app/
    page.tsx
    globals.css
  components/
    home/
      HomeDashboard.tsx
      HeroBanner.tsx
      ColorQuizCard.tsx
      StyleDashboard.tsx
      PaletteExplorer.tsx
      DashboardQuickActions.tsx
      SeasonPreviewStack.tsx
      MobileActionBar.tsx
```

### Responsibilities

`src/app/page.tsx`

- Imports static season data.
- Passes display data and route links into the home dashboard.
- Avoids detailed UI markup.

`HomeDashboard`

- Owns the main page composition.
- Places the watercolor background layer, desktop grid, mobile layout, and motion sequencing.

`HeroBanner`

- Presents the main product promise and primary calls to action.
- Uses immersive dashboard styling rather than a traditional landing-page hero.

`ColorQuizCard`

- Shows a lightweight preview of the color test flow.
- Uses local step state only.
- Navigates to `/upload` for the real diagnosis flow.

`StyleDashboard`

- Shows a compact style recommendation preview.
- Links to existing style and outfit routes.

`PaletteExplorer`

- Lets users switch through sample palettes and copy colors.
- Does not save or submit data.

`DashboardQuickActions`

- Provides route cards for diagnosis, outfit, history, and profile.

`SeasonPreviewStack`

- Displays layered seasonal color result cards using existing season data.

`MobileActionBar`

- Provides thumb-friendly fixed actions on small screens.

## Data Flow

```text
SEASONS
  -> src/app/page.tsx
  -> HomeDashboard
  -> preview components
  -> route links
```

The redesign does not require new backend APIs. It uses existing static season data and client-side interaction state for previews.

## Visual System

The visual direction is approachable luxury with a Morandi monochrome watercolor palette. The current indigo brand direction is retained, but softened through greyed, low-saturation tonal extensions.

Planned CSS variables:

```css
:root {
  --brand-ink: #302f4d;
  --brand-deep: #4d4a73;
  --brand: #6f6a9f;
  --brand-muted: #9a96bd;
  --brand-mist: #d9d7e8;
  --brand-wash: #f3f1f8;
  --surface-glass: rgba(255, 255, 255, 0.68);
  --shadow-soft: 0 24px 80px rgba(77, 74, 115, 0.16);
}
```

Style principles:

- Watercolor wash background with soft tonal gradients.
- Lightweight glassmorphism for major cards.
- Soft shadows and subtle overlapping layers.
- Monochromatic Morandi indigo-lavender palette.
- Restrained contrast and warm, readable text.

## Interaction Strategy

Use Framer Motion for:

- Initial card fade and lift.
- Card hover and tap feedback.
- Preview step transitions.
- Layered card reveal effects.

Interactions should feel native-app-like, but all major actions remain route navigation.

## Responsive Strategy

Desktop:

- Multi-column dashboard grid.
- Layered cards with controlled overlap.
- Hero and preview modules visible in the first viewport.

Mobile:

- Full-width large cards.
- Fixed bottom action bar.
- Touch-friendly spacing and tap targets.
- No text overlap or cramped cards.

## Error Handling

The home page only uses static data and client-side preview state. If clipboard copying fails, palette copy interactions should degrade silently or show a small local status message. Route navigation remains handled by Next.js links.

## Verification

Required checks:

- `npm run build`
- Browser visual check for desktop and mobile viewports

Focus areas:

- No route regressions.
- No text overflow on mobile.
- Cards remain readable over watercolor background.
- Mobile bottom action bar does not block primary content.


## Performance & Motion Appendices

### Motion Specifications

- **Curve:** Strictly forbid linear/standard cubic-bezier transitions for macro movements. Use spring-based physics for card lifting and switching.
  - Recommended configuration: `type: "spring", stiffness: 150, damping: 22`
- **Shared Layout:** Palette switches and tab toggles inside preview components must utilize Framer Motion's `layoutId` to achieve continuous morphing visual effects.

### CSS Performance Optimization

- **Hardware Acceleration:** Apply `transform: translateZ(0)` and `will-change: transform` to all cards utilizing `backdrop-filter: blur()` to guarantee stable 60fps scrolling on mobile devices.
- **Background Layering:** The watercolor wash must be rendered via layered CSS radial gradients (`background-image`) combined with CSS opacity animations, avoiding heavy raster image assets to protect the First Contentful Paint (FCP).

### Layout Safeguards

- **Mobile Viewport Spacing:** The main scroll container must feature a bottom padding matrix (`pb-[calc(5rem+env(safe-area-inset-bottom))]`) to perfectly clear the persistent `MobileActionBar`.
- **Tablet Strategy:** Screens between `768px` and `1024px` will fluidly transition to a balanced 2-column layout, ensuring no content compression or premature text wrapping.