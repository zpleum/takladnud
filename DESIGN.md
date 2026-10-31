---
name: ตากลาดนัด
description: A calm, code-led market atlas for stall booking and shop discovery.
colors:
  market-green: "#285b49"
  market-green-deep: "#1f4c3b"
  wayfinding-gold: "#d8ad5b"
  map-paper: "#fbfbf8"
  surface-white: "#ffffff"
  soft-paper: "#f3f6f2"
  route-ink: "#25342d"
  quiet-ink: "#53645a"
  divider: "#d8e2d9"
typography:
  display:
    fontFamily: "IBM Plex Sans Thai, Tahoma, sans-serif"
    fontSize: "clamp(34px, 4vw, 49px)"
    fontWeight: 500
    lineHeight: 1.2
    letterSpacing: "-0.035em"
  body:
    fontFamily: "IBM Plex Sans Thai, Tahoma, sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.7
  data:
    fontFamily: "Manrope, IBM Plex Sans Thai, sans-serif"
    fontSize: "24px"
    fontWeight: 600
rounded:
  sm: "9px"
  md: "12px"
  lg: "15px"
  pill: "20px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "32px"
components:
  button-primary:
    backgroundColor: "{colors.market-green}"
    textColor: "{colors.surface-white}"
    rounded: "{rounded.sm}"
    padding: "0 17px"
    height: "45px"
  button-primary-hover:
    backgroundColor: "{colors.market-green-deep}"
  surface-card:
    backgroundColor: "{colors.surface-white}"
    textColor: "{colors.route-ink}"
    rounded: "{rounded.md}"
    padding: "20px"
---

# Design System: ตากลาดนัด

## Overview

**Creative North Star: "Market Route Atlas"**

The interface treats the market as a route atlas: stall codes connect the booking flow, customer map, and shop directory. Its visual language is calm and practical, using map-paper surfaces, precise geometry, and clear Thai-first labels to support quick decisions on a phone or at a market desk.

White surfaces and fine dividers keep operational tasks easy to scan. Market green carries primary actions, muted gold marks wayfinding details, and restrained map grids stay inside actual map surfaces rather than becoming page decoration.

**Key Characteristics:**
- Stall codes are the shared visual anchor between maps, bookings, and shop details.
- Thai copy remains clear and prominent; Manrope is reserved for selected numerals.
- Flat surfaces and fine borders do most of the hierarchy work.
- Map geometry is purposeful and limited to map surfaces.

## Colors

The palette pairs route-green with warm paper neutrals and a restrained wayfinding gold.

### Primary
- **Market Green** (#285b49): Primary actions, active navigation, selected stalls, and positive system status.
- **Deep Market Green** (#1f4c3b): Hover state for primary actions.

### Secondary
- **Wayfinding Gold** (#d8ad5b): Small route, market, and status accents; not a substitute for readable text.

### Neutral
- **Map Paper** (#fbfbf8): Booking and public-map canvas.
- **Soft Paper** (#f3f6f2): Main page background, quiet secondary surfaces, and browser theme color.
- **Surface White** (#ffffff): Panels, cards, and form fields.
- **Route Ink** (#25342d): Primary text.
- **Quiet Ink** (#53645a): Supporting text on light surfaces.
- **Fine Divider** (#d8e2d9): Borders and separators.

**The Route-First Rule.** Use color to reinforce a location or state, while keeping stall codes and text labels readable without color.

## Typography

**Display Font:** IBM Plex Sans Thai (with Tahoma, sans-serif)  
**Body Font:** IBM Plex Sans Thai (with Tahoma, sans-serif)  
**Data Font:** Manrope (with IBM Plex Sans Thai, sans-serif)

**Character:** Thai interface text is direct and readable, with restrained weight changes. Manrope gives selected counts and measurements a compact, stable shape without taking over the page.

### Hierarchy
- **Display** (500, `clamp(34px, 4vw, 49px)`, line-height 1.2): Main page heading.
- **Headline** (500, 30px, line-height 1.2): Market and major section headings.
- **Title** (500–600, 18–22px): Panel and dialog titles.
- **Body** (400, 14–15px, line-height 1.6–1.8): Instructions, descriptions, and detail copy.
- **Label** (400–600, 12px): Controls, metadata, legends, and status labels.
- **Data** (600, 21–28px): Counts and prices, using Manrope where suitable.

## Layout

The desktop content column is capped at 1260px, with a 64px total page gutter at wider widths. The top navigation is 82px high. Dashboard content uses a broad map column with a supporting bookings column; public discovery pairs the map with the shop directory.

At 760px and below, the navigation and market summary adapt for narrow screens and multi-column content stacks. At 420px and below, the brand mark and header details compact further. Preserve comfortable gaps between task groups; use tighter 4–8px spacing only within related controls.

## Elevation & Depth

The system is flat by default: white panels rely on a fine border, not a resting shadow. Use diffuse offset shadows only for overlays such as dialogs and transient feedback. Map depth comes from stall boundaries, route lines, and restrained tonal fills rather than stacked cards.

### Shadow Vocabulary
- **Dialog** (`0 18px 48px #25342d24`): Separate a focused modal from the page.
- **Toast** (`0 10px 24px #25342d20`): Keep short-lived feedback legible above content.

## Shapes

Controls use compact 9px corners, panels use 12px, and the market banner uses 15px. Small status pills may use a 20px radius. Prefer fine 1px borders and simple clipping; keep decorative geometry tied to market maps and route diagrams.

## Components

### Buttons
- **Shape:** 9px radius.
- **Primary:** Market green with white text, 45px minimum height, and 17px horizontal padding.
- **Hover / Focus:** Deep green on hover; a 3px gold focus outline with offset on keyboard focus.
- **Secondary:** White or soft-paper fill with a fine divider-colored border.

### Chips
- **Style:** Compact stall-code labels with pale green, neutral, or gold-tinted fills.
- **State:** Keep a readable code and a clear text status; color is supporting information.

### Cards / Containers
- **Corner Style:** 12px.
- **Background:** White against map-paper or soft-paper.
- **Shadow Strategy:** Flat at rest; use a divider for structure.
- **Border:** Fine neutral divider.
- **Internal Padding:** About 16–22px, adjusted to the content.

### Inputs / Fields
- **Style:** White fill, 1px soft-green divider, and compact rounded corners.
- **Focus:** Visible 3px gold outline with offset.
- **Error / Disabled:** Use explicit error or disabled text and state, not color alone.

### Navigation
- **Style:** Sticky, compact links with clear labels and simple SVG icons where appropriate.
- **State:** Active links use a soft-paper surface and route ink; narrow layouts wrap and compact the navigation.

### Market Map
- **Style:** Subtle two-axis grid on map surfaces only, with distinct stall-code markers, route labels, and an adjacent textual legend.
- **Behavior:** Keep customer shop details tied to the selected stall code.

## Do's and Don'ts

### Do:
- **Do** use Market Green for primary actions and selected navigation.
- **Do** keep stall codes consistent across maps, reservations, and shop details.
- **Do** retain visible keyboard focus and clear text labels for status.
- **Do** reserve the subtle grid treatment for actual map surfaces.

### Don't:
- **Don't** use color as the only way to distinguish a booking or stall state.
- **Don't** put map-grid decoration on general page backgrounds.
- **Don't** add dashboard ornament that separates counts from the market floor.
