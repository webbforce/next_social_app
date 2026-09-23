# Upfor — MVP Spec (v0.2)

Scope: the **Months 0–2** build from `ideation/best-of-breed-concept.md`, split into two stages.

| Stage | What | Why |
|---|---|---|
| **A — Web only** | Plan link → RSVP → photos → episode, all in the mobile browser | Tests what competitors don't have (web joins, shareable episodes) at the lowest build cost |
| **B — Native app** | Now screen, statuses, circles, push notifications | Only built if Stage A shows groups making plans again on their own |

Before Stage A: the manual trial (run plans and hand-make recaps for 3–5 friend groups for two weeks).

---

## 1. Goals and non-goals

### Stage A goals

1. Anyone can create a plan in under 30 seconds and drop the link into a group chat.
2. Friends join from that link **without installing or signing up**.
3. Participants add photos from their browser; the group gets an **episode** good enough to post.
4. Guests are pulled into **hosting their own plans** — the loop that makes it spread.
5. A cheap "I'm free" signal tests whether people will share availability at all (the core bet of Stage B).
6. Every step is instrumented so Stage A answers the questions in §9.

### Stage B goals

1. See which friends are free and what they feel like doing, in under 20 seconds.
2. Turn that into a plan in one or two taps.
3. Push notifications and circles make it a daily habit.

### Non-goals (both stages)

- Missions and circle-vs-circle challenges (Months 2–4)
- Riff / AI remix chains (Months 2–4)
- Generative AI video, LLM-based suggestions
- Face recognition of any kind (biometric data under GDPR)
- Public feed, profiles beyond name + photo, followers
- Chat beyond short plan updates
- GPS / maps of friends
- Monetization
- Desktop-specific experience

---

## 2. Users

- **Primary:** university students, 18–24, at one launch campus, in friend groups of roughly 4–12 people.
- **Host:** creates plans. Needs a verified phone number.
- **Guest:** joins from a link with a first name only. No account.
- **Age:** 18+ only. Hosts confirm at sign-up; guests confirm when joining.

---

## 3. Stage A — web only

Mobile-first web app. Everything must work in iOS Safari, Android Chrome, and the in-app browsers of WhatsApp and Instagram.

### 3.1 Host sign-in

1. Phone number → SMS one-time code.
2. First name, optional photo, confirm 18+.
3. Optional: pick campus from a list (used only for density metrics).

### 3.2 Create a plan

- Fields: activity (tag or free text), start time (now / today at… / pick), place (free text or pasted maps link).
- End time defaults by activity; the host can change it:

  | Activity | Default length |
  |---|---|
  | coffee, walk | 1.5 h |
  | food, gym, study | 2 h |
  | drinks, party | 5 h |
  | anything / free text | 3 h |

- On create: host gets the **share link** with a one-tap "Share to WhatsApp / iMessage / copy".
- No invitee list in Stage A — the group chat is the invite list.
- Plan states: `open` → `happening` (from start) → `ended` (at end time) → `cancelled`.

### 3.3 Plan page (the link)

Link preview (Open Graph): "**Tom wants drinks tonight · 7 people are in**".

Anyone with the link sees: activity, time, place, host, who's in (first names + photos), RSVP buttons **I'm in / Maybe / Can't**.

- Guest RSVP: first name + 18+ confirmation. Identity kept in a cookie.
- Cookies are unreliable in in-app browsers, so a returning guest can pick their name from "Is this you?" on the same plan instead of creating a duplicate.
- **Plan updates:** short text updates from participants ("running 10 min late").
- Host can edit, cancel, or remove a participant.
- Photos and the episode are visible only to people who RSVP'd **in** or **maybe**, not to everyone with the link.

### 3.4 Moments (photos)

- **Add photos** during `happening` and up to 12 h after `ended`: multi-select from camera roll or take a photo in the browser.
- Uploads work for guests and hosts alike; upload progress survives a flaky connection (resumable or per-photo).
- Uploaders delete their own; host can remove any.
- Photos only in Stage A; short clips are a stretch goal.

### 3.5 Episode — the product's main bet

Generated 12 h after a plan ends, or when the host taps "Make episode now".

**Two formats, so small plans still get something:**

| Photos | Format |
|---|---|
| 1–5 | **Card:** single vertical image — stats + photo grid |
| 6+ | **Reel:** 10–20 s vertical (9:16) slideshow + the card as a still |

**What makes it worth sharing** (all computed from photo timestamps, RSVPs and uploads — no AI):

- Stats line: "6 people · 41 photos · 3 h 20 min · Café de Jaren"
- Moments: "last photo 2:41 AM", "busiest 10 minutes: 22:10", "Emma took 23 photos"
- Chronological pacing: photos grouped into bursts, faster cuts during bursts
- 3–4 visual templates (e.g. film strip, polaroid, bold type, minimal) matched to activity type
- Music from a small built-in royalty-free library; any participant can switch track
- End card: "made with Upfor" + link

**Control and privacy:**

- Before anyone shares externally, each participant can **exclude photos they appear in** (they tap photos; no face detection).
- Episode page is private to participants. A **public share link** exists only if a participant creates one.
- Share via the browser's native share sheet (video file to Instagram Stories / TikTok / WhatsApp where the platform supports it) with **download** as fallback.

### 3.6 Guest → host loop

This is the most important flow in Stage A.

- After viewing an episode: "**Start your own plan →**" (leads to host sign-in, §3.1).
- After a plan ends: "Doing something else this week? Make a plan in 30 seconds."
- If a guest signs up on the same device, their guest history is claimed into the new account.
- A public episode page viewed by a non-participant shows a clear "Make a plan with your friends" call to action.

### 3.7 "I'm free" test (cheap Stage B probe)

- Signed-in users can tap **"I'm free tonight"** (optional tag: coffee, food, drinks, anything). Expires at 04:00.
- Visible on a simple "**Who's free**" page to people they've shared a plan with in the last 30 days (an implicit friend list; no circles, no push).
- From that page, one tap to create a plan pre-filled with the free people's shared tag.
- The goal is data, not polish: does anyone set it more than once, and does it lead to plans?

### 3.8 Safety basics

- Report plan, photo, or person from any page; reports reviewed manually by the team.
- Host can remove participants and photos.
- Plan links use unguessable slugs; hosts can reset a link.

---

## 4. Stage B — native app (only if Stage A passes)

Carries over from v0.1, built on the Stage A backend. Plans, RSVPs, moments and episodes stay as in Stage A.

### 4.1 Onboarding

Phone code (same account as Stage A) → name/photo → optional contacts matching (hashed; contacts never messaged) → join or create a circle → set first status → Now.

### 4.2 Statuses

- **State:** `free_now` (expires after 2 h) · `free_later` (time window) · `busy`
- **Intent tags:** coffee, food, drinks, gym, study, walk, party, anything
- **Note:** ≤ 60 chars
- **Visible to:** all circles or selected circles; always expires; can be cleared anytime

Design adjusts based on the §3.7 results (e.g. if people only use "free tonight", drop the time windows).

### 4.3 Now screen

- "**N friends are around**", grouped free now → free later → no status
- **Overlap card** (rule-based): ≥ 2 other members of a shared circle with ≥ 45 min overlapping free time and a shared intent tag; time alone if nobody set tags. "You, Emma and Thomas are free 16:00–18:00 and all want coffee. **Make a plan →**"
- Active plans pinned at top

### 4.4 Circles

Create (name, emoji), invite by link or contacts on Upfor. 2–30 members; any member can invite (revisit if abused). Leave, remove member (owner), mute. Stage A's "people you've done plans with" seeds suggested circles.

### 4.5 Notifications

Every notification is about a specific person or plan; throttled per user.

| Trigger | Recipient | Limit |
|---|---|---|
| Invited to a plan | Invitee | — |
| Someone RSVPs "in" to your plan | Host | Batched, max 1 per 10 min |
| Plan starts in 30 min | Participants in/maybe | — |
| Overlap found | Users in the overlap | Max 1 per day |
| Episode ready | Participants | — |
| Plan update posted | Participants | Batched, max 1 per 10 min |

No notification for every status change — that's what the Now screen is for.

### 4.6 Blocking

Block user: hides status and plans both ways.

---

## 5. Privacy rules

- No GPS. A plan's place is whatever the host types.
- No face recognition; photo exclusion is manual.
- Photos and episodes visible only to in/maybe participants, unless someone deliberately creates a public episode link.
- "I'm free" (Stage A) and statuses (Stage B) are visible only to the chosen audience and always expire.
- Contacts (Stage B) used only for hashed matching, never messaged, never stored in plain form.
- Account deletion removes profile, signals, uploads and personal data within 30 days (GDPR). Guests can remove their name and photos from a plan at any time.
- EU hosting.

---

## 6. Data model

Postgres-style. `id` columns are UUIDs; all tables have `created_at`.

### Stage A tables

**users** — hosts and anyone who signs in

| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| phone_e164 | text | unique |
| first_name | text | |
| photo_url | text | nullable |
| is_18_plus_confirmed | bool | |
| campus_id | uuid | FK campuses, nullable |
| deleted_at | timestamptz | soft delete before purge |

**campuses** — `id`, `name`, `city`

**guests**

| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| first_name | text | |
| is_18_plus_confirmed | bool | |
| cookie_token_hash | text | |
| claimed_by_user_id | uuid | FK users, set when the guest signs up |

**plans**

| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| host_user_id | uuid | FK users |
| activity | text | |
| starts_at | timestamptz | |
| ends_at | timestamptz | default by activity (§3.2) |
| place_text | text | nullable |
| place_url | text | nullable |
| state | enum | `open`, `happening`, `ended`, `cancelled` |
| share_slug | text | unique, unguessable, resettable |
| source | enum | `web_create`, `free_page` (Stage A); `overlap_card`, `friend_row`, `do_button` (Stage B) |

**plan_participants**

| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| plan_id | uuid | FK plans |
| user_id | uuid | FK users, nullable |
| guest_id | uuid | FK guests, nullable (exactly one of user_id/guest_id) |
| rsvp | enum | `invited`, `in`, `maybe`, `out` |
| invited_via | enum | `link` (Stage A); `push`, `host_added` (Stage B) |
| rsvp_at | timestamptz | |
| removed_at | timestamptz | nullable |

**plan_updates** — `id`, `plan_id`, `participant_id`, `body` (≤ 280 chars)

**moments**

| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| plan_id | uuid | FK plans |
| participant_id | uuid | FK plan_participants |
| media_type | enum | `photo`, `clip` |
| storage_key | text | |
| taken_at | timestamptz | from EXIF when available, else upload time |
| removed_at | timestamptz | nullable |

**episodes**

| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| plan_id | uuid | FK plans, unique |
| format | enum | `card`, `reel` |
| template | text | |
| music_track | text | nullable |
| status | enum | `pending`, `rendering`, `ready`, `failed` |
| video_key | text | nullable (card-only episodes) |
| card_key | text | |
| highlights | jsonb | stats and computed moments (§3.5) |
| public_share_slug | text | nullable, created on explicit public share |

**episode_exclusions** — `episode_id`, `moment_id`, `requested_by` (FK plan_participants)

**free_signals** — Stage A "I'm free" test

| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| user_id | uuid | FK users |
| intent | text | nullable |
| expires_at | timestamptz | 04:00 next day |
| cleared_at | timestamptz | nullable |

**reports** — `id`, `reporter_user_id` / `reporter_guest_id`, `target_type`, `target_id`, `reason`, `status`

**analytics_events** — append-only, kept in our own database for the data room

| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| name | text | see §7 |
| user_id | uuid | nullable |
| guest_id | uuid | nullable |
| properties | jsonb | |
| occurred_at | timestamptz | |

### Stage B additions

- **circles** — `id`, `name`, `emoji`, `created_by`, `invite_code`
- **circle_members** — `circle_id`, `user_id`, `role` (`owner`/`member`), `muted`
- **statuses** — replaces `free_signals`: `user_id`, `state`, `window_start`, `window_end`, `intents[]`, `note`, `visible_circle_ids[]`, `expires_at`, `cleared_at`
- **blocks** — `blocker_user_id`, `blocked_user_id`
- **push_tokens** — `user_id`, `platform`, `token`
- **contact_hashes** — `user_id`, `hash` (for matching only)
- **plan_participants.invited_via** gains `push`, `host_added`; **plans** gains `circle_id`

---

## 7. Tracked events

### Stage A

| Event | Key properties | Answers |
|---|---|---|
| `host_signup_started` / `host_signup_completed` | entry (direct, plan_page, episode_page, public_episode) | where new hosts come from |
| `plan_created` | source, activity, is_first_plan, hosted_before_as_guest | repeat hosting, guest → host |
| `plan_link_shared` | channel (whatsapp, imessage, copy) | how plans spread |
| `plan_link_opened` | is_known_guest, referrer, in_app_browser | invite funnel, browser issues |
| `rsvp_submitted` | rsvp, is_guest | link → RSVP conversion |
| `guest_rejoined_by_name` | — | cookie loss rate |
| `plan_ended` | activity, participants in, guests in, photo count | group size, photos per activity |
| `moment_uploaded` | is_guest, upload_ms, failed | content per plan, upload reliability |
| `episode_ready` | format, template, photos used, render_ms | episode coverage |
| `episode_viewed` | is_participant, viewer_type | reach |
| `episode_track_changed` / `photo_excluded` | — | engagement with episode |
| `episode_shared` | destination (stories, tiktok, whatsapp, download, public_link) | external sharing |
| `public_episode_opened` | referrer | discovery from exports |
| `start_own_plan_tapped` | surface (episode, post_plan, public_episode) | guest → host funnel |
| `guest_claimed` | days since first guest RSVP | guest → user conversion |
| `free_signal_set` / `free_signal_cleared` | intent | does anyone share availability |
| `free_page_viewed` | free people visible | Stage B demand |

### Stage B adds

`circle_created`, `circle_joined`, `status_set`, `status_cleared`, `now_viewed`, `overlap_card_shown`, `overlap_card_tapped`, `push_opened`, `app_installed` (with attribution to plan link / episode).

---

## 8. Technical notes

### Stage A

- **Web app:** mobile-first; server-rendered pages for plan and episode links so previews work in WhatsApp/iMessage (Open Graph image generated per plan and per episode).
- **Backend:** Postgres, phone sign-in (SMS for sign-in codes only), object storage for photos, simple realtime or polling for RSVPs on the plan page.
- **Episode rendering:** background job with fixed templates (e.g. ffmpeg); target < 2 min from trigger to `ready`.
- **Jobs:** plan state transitions, episode triggers, free-signal expiry, deletion purge.
- **Browser risks to test early:** photo upload from WhatsApp/Instagram in-app browsers, cookie persistence, sharing a video file via the native share sheet on iOS and Android.

### Stage B

- iOS + Android app on the same backend; push notifications; realtime for Now and plan pages; overlap detection job (every ~10 min per campus).

---

## 9. Success criteria

### Stage A (4 weeks, 100–500 people, one campus)

| Question | Signal |
|---|---|
| Do hosts come back? | ≥ 30% of hosts create a second plan within 14 days, unprompted |
| **Does it spread?** | **≥ 10% of guests host their own plan within 21 days** |
| Does the link work? | ≥ 40% of people who open a plan link RSVP |
| Is it a group thing? | ≥ 50% of plans end with 3+ people "in" |
| Do plans produce content? | ≥ 50% of plans get ≥ 3 photos — reported **per activity type** |
| **Are episodes worth posting?** | **≥ 25% of episodes shared externally at least once** |
| Do exports bring people? | Any new hosts whose first touch was a public episode link (report the count) |
| Will people share availability? | % of hosts who set "I'm free" at least twice; % of free signals that lead to a plan (informational) |

**How to read the results**

- **Plans repeat and episodes get shared:** build Stage B.
- **Plans repeat, episodes rarely shared:** the utility works but the growth engine doesn't; fix episodes before Stage B, or accept slower growth.
- **Episodes shared mostly from nights out, small plans rarely get photos:** the product is really "episodes for nights out" — reposition before building the Now screen.
- **Nobody uses "I'm free":** redesign Stage B around plans, not statuses.
- **Plans don't repeat:** stop and rethink before building anything else.

### Stage B (after launch in the app)

| Signal | Target |
|---|---|
| Circles creating a plan in weeks 3–4 unprompted | ≥ 30% |
| D7 retention | ≥ 30% |
| Installs attributed to plan links or episodes | majority of installs |

---

## 10. Decisions

| Question | Decision |
|---|---|
| MVP structure | Two stages: web-only plan → photos → episode first; native app with Now/statuses only if Stage A passes |
| Plan chat | Short plan updates only |
| Overlap matching (Stage B) | Overlapping time + shared intent tag; time alone when nobody set tags |
| Plan length | Default by activity type, host can change; photo window 12 h after end |
| Circle invites (Stage B) | Any member can invite; revisit if abused |
| Episode music | Small built-in royalty-free library |
| Guest messaging | No SMS or WhatsApp to guests |
| Small plans | 1–5 photos get a card episode instead of a reel |
| Name | "Upfor" is an internal placeholder only — already used by competing apps (concept doc §9) |
