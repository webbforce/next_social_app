# Upfor — Best-of-Breed Concept (Pulse + Riff)

> **Upfor is an internal placeholder name.** It is already used by several apps in this exact category (see §9), so the product needs a different public name before launch.

Synthesis of the three proposals in this folder:

- `pulse_next_level_social_app.md` — real-time coordination ("What should we do?")
- `riff_social_app_concept.md` — AI-native multiplayer remixing
- `next-level-social-app.md` — generic principles for fast growth + a 12-month exit

**One-line pitch:** *See which friends are up for something right now — and every time you do something together, your group gets an episode you can remix and share.*

---

## 1. What we take from each proposal

| Source | Keep | Drop / change |
|---|---|---|
| **Pulse** | Core loop (Now → Do → Moments → Replay), finite home screen, "moment involving multiple people" as the core object, join-via-web-link without install, Missions, campus-density launch, metrics dashboard, "What not to build" list | Nothing major — this is the backbone |
| **Riff** | AI remixing as the *content* layer, horizontal "chain" of versions, "Made with" watermarked exports tuned for TikTok/Reels, campus unlock threshold for FOMO | Standalone generative-video feed (expensive inference, weak retention without friends), forced contact tagging + SMS blasts (spam/TCPA/GDPR risk, app-store risk), generating people's likeness without consent, high-school launch, 10M DAU target |
| **General doc** | Under-60s time-to-value, retention over vanity, avoid moderation/regulatory landmines, monetization *optionality* (not live), clean data + privacy by design as diligence assets | Its four "pick a wedge" options — we've picked: utility-first social graph (#3) with AI co-creation (#1) as the share engine |

**Why this combination:** Pulse alone has great retention but produces modest content; Riff alone produces viral content but has no reason to come back tomorrow. Utility drives retention, remixable episodes drive distribution — each fixes the other's weak side.

---

## 2. Product

### Core screens (unchanged from Pulse, with Riff folded in)

| Screen | Function |
|---|---|
| **Now** | Who in your circles is free / what they want to do. Finite — readable in ~20 seconds. |
| **Do** | One-tap plan or Mission. AI suggests who, when, where. |
| **Circles** | Small private groups (the social graph we're building). |
| **Moments** | Photos/clips captured during a plan or Mission. |
| **Episode** | AI-generated recap of a plan — and the **Riff** entry point. |

### The two mechanics

1. **Primary (utility → retention):** "See which of your friends are up for doing something right now."
2. **Secondary (content → distribution):** "Every time you do something together, you get an episode — and your friends can riff on it."

### Riff, scoped safely

Riff becomes a mode on **Episodes and Missions**, not a public feed:

- Any participant can hit **Riff** on an episode and apply a style/prompt ("90s anime", "nature documentary", "movie trailer").
- Riffs form a horizontal **chain** of versions; the group votes the best one up.
- **Only people who were in the moment appear in it**, and anyone can opt out of AI transformation of their face. No generating people who didn't consent.
- Start with cheap transformations (style filters, captions, music, templated edits, stills) — generative video only once unit economics are known.

### Missions (entertainment layer)

From Pulse, made remixable:

- "Everyone photograph what you're looking at. NOW." / "€20 night." / "Worst outfit wins."
- Results auto-package into an episode → riff chain → export.
- **Circle vs circle** challenges are the cross-group viral unit, especially on campus.

### AI role

Invisible catalyst, not the category (Pulse's stance):

- Before: spots overlap in availability, suggests plans, picks places.
- After: builds the episode and powers riffs.

---

## 3. Growth engine

The loop:

> **Alice starts a plan → shares a link in WhatsApp/iMessage → friends tap "I'm in" on the web without installing → they show up, add photos → episode is generated → people riff on it → best version is exported to TikTok/Reels/Stories with "made with Upfor" → viewers' groups start their own plans**

Growth rules:

- **No install required to join** a plan (web participation). Install prompt comes *after* a good experience.
- **Invites are user-initiated and personal**, never automated contact blasts.
- **Exports are the main acquisition channel** — every episode is designed to be worth posting elsewhere.
- **Campus unlock:** a campus "opens" once enough students join the waitlist (Riff's FOMO mechanic), then goes for density, not breadth.

---

## 4. Launch market

- **18–24 university students, 18+ only.** Drop Riff's high-school idea — minors + location + AI-edited faces is the fastest way to fail diligence.
- One campus → high penetration → replicate. Target shape: *~70% of a campus, ~45%+ DAU/MAU* beats 100k scattered users.
- Expansion path (from Pulse): Amsterdam → Rotterdam → Utrecht → London → Berlin → Paris.

---

## 5. Guardrails (what keeps it acquirable)

- **Location/presence is opt-in and coarse** by default ("around", "at campus"), per-circle visibility, auto-expiring.
- **Consent-first AI likeness**, content in private circles by default, public only via deliberate export.
- GDPR posture from day one (EU launch), minimal data retention, clean event data for the metrics story.
- **Not building in year one** (Pulse's list stands): public feed, marketplace, ads system, creator monetization, crypto, AI influencers, anonymous stranger messaging, desktop app.
- Monetization kept as *optionality* for the pitch: premium riff styles, venue/event partnerships, group plans.

---

## 6. Metrics

Pulse's targets, plus two for the Riff layer:

| Metric | Aspirational target |
|---|---:|
| Invite recipients per new user | 3+ |
| D1 / D7 / D30 retention | >60% / >35% / >20% |
| DAU / MAU | >40% |
| % plans involving 3+ people | Rising |
| Organic installs | 70%+ |
| External shares per user per week | >1 |
| **Riffs per episode** | Rising (measures co-creation) |
| **Installs attributed to exports** | Rising (measures the distribution engine) |
| **AI cost per active user** | Tracked weekly, capped |

---

## 7. 12-month plan

| Months | Focus |
|---|---|
| **0–2** | Manual trial, then **Stage A** (web only): plan link, RSVP, photos, episode, guest → host loop, "I'm free" test. If it passes, **Stage B**: native app with Now, Circles, push (see `docs/mvp-spec.md`). |
| **2–4** | One campus. Add Missions, Riff chains (cheap transforms), exports, campus unlock. Maximise viral coefficient. |
| **4–6** | 3–5 new campuses using the same playbook — prove it *replicates*. |
| **6–9** | Expand city by city via ambassadors, campus orgs, nightlife/event partners. Paid only to amplify a working organic loop. Introduce generative video if cost per user allows. |
| **8–12** | Package metrics and data room; open conversations with strategics (messaging, camera/creation, events, AI assistants). |

Acquisition story: *"We found a new behaviour — friends turning 'who's free?' into real plans and shareable episodes — and proved it replicates campus after campus, mostly organically."*

---

## 8. Main risks

| Risk | Mitigation |
|---|---|
| Cold start — Now screen is empty without friends | Launch per campus with density targets; web joins make each plan recruit people; Missions work even with few friends |
| AI inference cost during viral spikes | Cheap transforms first, generative video gated, per-user cost cap |
| Privacy of presence/location | Opt-in, coarse, expiring, per-circle |
| Novelty fade of AI styles | Retention rests on the planning utility, not the effects |
| 12-month exit is a long shot | Plan is designed to be a healthy company even if no buyer appears in year one |
| Crowded "who's free" category (§9) | Lead with episodes, no-install joins and campus density — not availability sharing alone |

---

## 9. Competitive landscape

"Share that you're free and see who's in" is **not** a new idea. Several apps are building it right now, and some well-funded ones have failed. The concept only wins if its differences matter.

### Direct competitors (same core idea)

| App | What it does | Status (Sep 2026) |
|---|---|---|
| [UpFor](https://upfor.rsvp/) | "Anti-scheduling hangout app": tell your people when you're free and what you want to do | Beta since Feb 2026 |
| [Up4](https://apps.apple.com/us/app/up4/id6760973544) | Post what you're up for, live map of friends' plans, circles/groups, lock-screen Live Activities; 13+ | Live on iOS, $4.99/mo premium |
| [Upfor: Do Things Together](https://apps.apple.com/us/app/upfor-do-things-together/id6448855345) | "Who's up for what", suggested plans, temporary plan chats | On the App Store, small |
| [Up For X](https://www.upforxapp.com/) | Set what you're up for, see friends' | Hobby project |
| UpFor Events | Social event planning with memories | [Shut down 2025](https://getupfor.app/) |

### Adjacent products

| App | Overlap | Lesson |
|---|---|---|
| **Partiful** | Event invites with web RSVP, no install needed — the same trick as our web join | Web-first invites clearly work; we must not look like "Partiful for small plans" |
| **BeReal** | Authentic, real-moment sharing among friends; acquired by Voodoo (2024) | Novelty mechanics spike fast and fade; retention needs utility |
| **Zenly** | Friends' live location; hugely popular with students, shut down by Snap (2023) | Presence apps can grow fast — and precise location is a liability |
| **IRL** | Event/plans social app; shut down (2023) after it emerged most of its users were fake | Metrics must be real and auditable — the data room is part of the product |
| **Snap Map / Find My / Life360** | Where friends are | Incumbents own location; we shouldn't compete on maps |
| **WhatsApp / iMessage groups** | Where plans are made today | The real competitor is "we'll figure it out in the group chat" — we plug into it, not replace it |

### How Upfor differs

| | Direct competitors | Upfor |
|---|---|---|
| Core output | A plan | A plan **and an episode** worth posting |
| Growth channel | Invites to friends | Invites **plus** exported episodes on TikTok/Reels/Stories |
| Joining without the app | Mostly app-only | Web join from any group-chat link |
| Launch | Broad, user by user | One campus at a time, density first |
| Location | Live maps (Up4) | No GPS; coarse, expiring status |
| Entertainment layer | None | Missions and riff chains (Months 2–4) |
| Age | 13+ (Up4) | 18+ only |

**Implication:** the availability screen alone is a commodity. The MVP must prove the parts competitors don't have — episodes getting shared and web joins turning into new users (MVP spec §9). If those fail, there is little reason to exist beside Up4 and UpFor.
