# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- Shop owners use the service to manage a stall business, choose market sessions, reserve stalls, and keep public shop details current.
- Customers use a phone to open a market map from a QR code, find shops, and plan a visit without creating an account.
- Market administrators are a future audience and are outside the current MVP.

## Product Purpose

ตากลาดนัด helps local markets organize stall reservations and helps customers discover shops and plan where to visit.

## Positioning

Market stall reservations and a customer-facing, searchable stall map are connected in one service; a market QR code opens the relevant session map directly.

## Operating Context

- Shop owners use the web app to register with email, manage a shop profile, select one or more stalls in a market session, and review or change reservations.
- Customers commonly arrive from a QR code on a mobile phone and browse the map and public shop information without signing in.
- Shop contact phone numbers are intentionally public when a shop is listed.

## Capabilities and Constraints

- Shop reservations are confirmed immediately; one shop may reserve multiple stalls.
- A shop owner may edit or cancel their reservations at any time.
- Registration and sign-in use email and password without email verification.
- Market map imagery and stall positions are supplied by the market operator/developer; market administration tools are not in the MVP.
- Payment, chat, and delivery are not currently specified.

## Brand Commitments

- Product name: ตากลาดนัด.
- Use clear, approachable Thai language for the primary interface.

## Evidence on Hand

- Product requirements are recorded in `spec.md`.
- The project includes an example market map at `public/images/market-map.svg` and a working web application.
- Do not invent market operators, customer testimonials, or performance claims.

## Product Principles

- Keep stall reservations and the customer map connected to the same market-session data.
- Make public shop discovery useful without requiring a customer account.
- Preserve shop-owner control over their profile and reservations.
- Make market and reservation status explicit and understandable.

## Accessibility & Inclusion

- The interface serves a broad age range, with particular consideration for adults around 30–60.
- Support mobile use, readable Thai text, keyboard navigation, visible focus, and status communication that does not rely on color alone.