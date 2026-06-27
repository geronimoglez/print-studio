# Launch playbook — Print Studio

Ready-to-edit drafts for announcing the project. **Nothing here is auto-posted** — copy, tweak in your own
voice, and post yourself. Replace links if the repo/demo move.

- **Repo:** https://github.com/geronimoglez/print-studio
- **Live demo:** https://print-studio-sable.vercel.app
- **License:** AGPL-3.0

## The one-liner (use everywhere)
> Open-source app to run an on-demand 3D-printing business: import models → compute real cost & pricing →
> a 🟢🟡🔴 legal-risk light (IP + file license) → publish to marketplaces with AI copy → monitor listing health.
> Self-host (Docker) or 1-click Vercel. White-label in 2 minutes.

## What makes it worth a click (pick 2–3 per post)
- **Legal-risk traffic light** — the core. Flags third-party brands/characters (by name **and** by vision/VLM)
  and checks the file **license**; publishing is **fail-closed** on brand/IP. Real "good-faith diligence".
- **Costing that reflects reality** — filament + power + depreciation + labor + post-processing + failure rate,
  then margin and **profit per printer-hour** (the machine is the bottleneck, so that's the number that matters).
- **White-label + AI setup assistant** — first-run wizard sets name/logo/colors, by hand or generated with AI
  (fal.ai / OpenAI / Claude, **bring your own key**). No code changes; degrades to 100% manual without a token.
- **Non-technical operable** — from the browser or a bot HTTP API.
- **Open-core, honestly** — public repo is the single-tenant self-host app; multi-tenant/SaaS layers mount via
  seams without touching this code.
- **4 UI languages** (EN/ES/PT/FR), marketplace content language configured separately.

---

## Show HN
**Title:** `Show HN: Print Studio – open-source app to run a 3D-printing business (cost, legal risk, selling)`

**Body:**
```
I run a small on-demand 3D-printing shop and built this to replace the spreadsheet + guesswork.
It does three things I couldn't find together anywhere:

1. Real costing. Each model's cost = filament + power + printer depreciation + labor + post-processing +
   a failure-rate buffer, then price (markup + marketplace fee + shipping) and — the number I actually
   optimize — profit per printer-hour. Change one config value and the whole catalog recomputes.

2. A legal-risk traffic light. Before you list something, it checks whether it's a third-party brand/character
   (by name and with a vision model) and whether the file's license even allows commercial use. Publishing is
   fail-closed on brand/IP. It's not legal advice, but it's the diligence step I kept skipping.

3. Selling. Publish to a marketplace (Mercado Libre today) with AI-generated descriptions, then a health
   dashboard watches the listings.

It's white-label out of the box (a /setup wizard sets name/logo/colors, optionally AI-generated with your own
API key) and runs single-tenant: Docker or one-click Vercel. AGPL-3.0.

Stack: Next.js 16, Prisma 7 + Postgres, Tailwind v4, next-intl. The repo is only the software — no models,
meshes, or catalog images, and it's not affiliated with any marketplace or brand.

Demo (empty instance you can click around): https://print-studio-sable.vercel.app
Code: https://github.com/geronimoglez/print-studio

Happy to talk about the costing model or the open-core seams (how the SaaS layer mounts without touching the
public code). Feedback welcome — especially from other people selling prints.
```
**Tips:** post Tue–Thu ~8–10am ET. First comment = a short "why I built this". Reply fast, stay non-defensive,
no marketing speak (HN allergic to it). Don't ask for upvotes.

---

## Reddit
**r/3Dprinting** (read rules — self-promo is touchy; lead with utility, not the link)
**Title:** `I built a free, open-source tool to price prints and avoid selling copyrighted models`
```
After underpricing jobs for months, I built an app that computes the real cost of a print (filament, power,
printer wear, labor, failures) and shows profit per printer-hour. It also flags models that are branded/IP or
have a non-commercial license before you list them — the thing that gets sellers in trouble.

It's open-source (AGPL) and self-hostable. Not selling anything; sharing in case it's useful. Demo + code in
comments. Curious how others here handle pricing and licensing.
```
(Put links in the first comment if the sub frowns on link posts.)

**r/selfhosted**
**Title:** `Print Studio – self-hostable app to run a 3D-printing shop (Docker / Postgres, AGPL)`
```
Single-tenant, no account system (deploy behind your own auth/reverse proxy). Docker compose brings up the app
+ Postgres and applies migrations. Costing engine, a legal-risk check on what you list, marketplace publishing,
and a white-label /setup wizard. AI features are all optional and bring-your-own-key. Feedback on the self-host
story appreciated.
```

**r/opensource** — angle: open-core done transparently (public single-tenant core + seams for a private SaaS
overlay), AGPL + CLA, and a white-label first-run wizard.

---

## Product Hunt
**Tagline:** `Run a 3D-printing business — cost, legal-risk check & selling, open-source`
**First comment:**
```
Hi PH 👋 I make and sell 3D prints. Print Studio is the tool I wish I'd had: it computes the real cost and the
profit per printer-hour, warns me when a model is branded/IP or has a non-commercial license, and publishes to
marketplaces with AI-written copy. It's open-source (AGPL), self-hostable, and white-label in ~2 minutes with an
AI setup assistant (bring your own key). Demo is a clean instance you can poke at. Would love your feedback.
```
**Assets:** the hero screenshot in `docs/screenshots/`, plus 3–4 shots (dashboard, the risk light, a model's
costing, the /setup wizard). Launch 12:01am PT; line up a few people to try it that day.

---

## dev.to / Hashnode (the technical story — drives the most durable traffic)
**Title:** `Building an open-core app: how the SaaS layer mounts without touching the public code`
Outline:
- The problem (one product, two shapes: self-host single-tenant + a future multi-tenant SaaS) without a
  closed fork or feature flags everywhere.
- **Seams**: `tenant`, `auth`, `bot-auth`, `secretos`, `branding`, `db` — registry pattern, no-op/constant
  defaults in the public repo, overlay replaces the file contents at build.
- Why **AGPL + CLA** (network-copyleft to keep it open; CLA to allow your own commercial SaaS).
- The **white-label runtime theming** (Tailwind v4 CSS vars + DB-stored branding, no redeploy).
- Lessons from i18n with next-intl on Next 16 (cookie strategy, no route prefix).
Cross-post to Hashnode; link the repo and demo.

**Second post idea:** `A 'legal-risk traffic light' for a marketplace: name lists + a VLM, fail-closed`.

---

## X / Twitter (thread)
```
1/ I open-sourced the app I use to run my 3D-printing shop.

Import a model → it tells you the real cost, the profit per printer-hour, whether it's legally safe to sell,
and then lists it for you with AI copy.

AGPL, self-hostable. Demo 👇

2/ The costing isn't a markup field. It's filament + power + printer depreciation + labor + post-processing +
failure rate → margin → profit/printer-hour. Change the config, the whole catalog recomputes.

3/ The part I'm proudest of: a 🟢🟡🔴 legal-risk light. It checks if a model is a third-party brand/character
(name + a vision model) and whether the file license even allows commercial use. Publishing is fail-closed.

4/ White-label in ~2 min: a /setup wizard sets your name/logo/colors — by hand or generated with AI (your own
key). No code changes.

5/ Self-host with Docker or one-click Vercel. Repo + live demo:
https://github.com/geronimoglez/print-studio
```

## LinkedIn (founder voice, 1 paragraph)
```
I open-sourced Print Studio — the software I built to run my on-demand 3D-printing business. It computes the
true cost and profit-per-printer-hour of each model, flags anything that's branded/IP or non-commercial before
it goes live, and publishes to marketplaces with AI-generated copy — all operable by a non-technical person.
It's AGPL-licensed and self-hostable, with a 2-minute white-label setup. If you make and sell prints (or run
any small maker business), I'd love your feedback. Demo and code in the comments.
```

---

## Before you post — checklist
- [ ] Demo instance is up and looks clean (consider the empty-state — it's a feature: shows the wizard).
- [ ] README hero screenshot renders on GitHub.
- [ ] Repo "About" + topics set; LICENSE, CONTRIBUTING, SECURITY visible.
- [ ] Pin a "feedback welcome / roadmap" issue.
- [ ] Pick ONE primary channel per day (don't blast all at once); engage in comments for the first few hours.
- [ ] Have 3–4 good screenshots ready (dashboard, risk light, costing, wizard).
