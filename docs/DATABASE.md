# Cosmoscope — Database Design

The simulator itself needs **no database**: ephemerides are computed client-side and
catalogs ship as static JSON. A database enters in Phase 2 for user features and
content management. Recommended: **PostgreSQL** (relational core) + object storage
for tiles/textures. All times stored as `timestamptz` (UTC); celestial coordinates in
J2000.

## 1. Entity overview

```
users ─┬─< bookmarks >─── objects(view)        content_objects ──< content_revisions
       ├─< observations                        lessons ──< lesson_steps
       ├─< session_members >── sessions        quizzes ──< quiz_questions
       └─< user_settings                       events_cache
```

## 2. Schema

### users
| column | type | notes |
|---|---|---|
| id | uuid PK | |
| email | citext unique | |
| display_name | text | |
| locale | text | BCP-47, default 'en' |
| knowledge_level | enum('beginner','intermediate','advanced') | drives info-panel depth |
| created_at | timestamptz | |

### user_settings
One row per user: JSONB mirror of the client `Settings` object (constellation lines,
labels, FOV, theme, last observer `{body_id, lat, lon}`, time rate). JSONB keeps it
forward-compatible with new toggles.

### bookmarks
| column | type | notes |
|---|---|---|
| id | uuid PK | |
| user_id | uuid FK→users | |
| kind | enum('body','star','dso','view') | 'view' = full camera/observer/time snapshot |
| object_ref | text | e.g. `body:mars`, `star:HIP24436`, `dso:M31` |
| snapshot | jsonb | `{mode, observer, followBodyId, simTimeMs, fovDeg, yaw, pitch}` |
| label | text | user-given name |
| created_at | timestamptz | |

The `snapshot` is exactly the serialized `AppState` subset — a bookmark is a
deep link (also encodable in the URL for sharing without an account).

### observations  (observation planning / log)
| column | type |
|---|---|
| id, user_id | uuid |
| target_ref | text |
| planned_at | timestamptz |
| site | jsonb `{lat, lon, elevation, name}` |
| equipment | jsonb `{aperture_mm, focal_mm, eyepiece_mm}` |
| notes | text, status enum('planned','observed','missed') |

### sessions / session_members  (collaborative observation)
| sessions | |
|---|---|
| id uuid PK, host_id FK→users | |
| state | jsonb — authoritative shared `{simTimeMs, timeRate, observer, followBodyId}` |
| invite_code | text unique |
| created_at / ended_at | timestamptz |

`session_members(session_id, user_id, role enum('host','copilot','viewer'), joined_at)`.
Live sync rides WebSockets (see API.md); the row stores the recovery state.

### content_objects  (CMS for the encyclopedia)
| column | type | notes |
|---|---|---|
| id | text PK | `body:europa`, `dso:M42`, `star:sirius` |
| kind | enum('star','planet','dwarf','moon','asteroid','comet','dso','exoplanet') |
| names | jsonb | localized names `{en: "...", id: "...", ...}` |
| physical | jsonb | mass_kg, radius_km, gravity, day_hours, temp, … |
| orbital | jsonb | a_au, e, i_deg, period_days, parent |
| facts | jsonb | description/discovery/missions/funFacts per locale & per knowledge level |
| media | jsonb | texture refs, diagrams, mission imagery (object-store keys) |
| updated_at | timestamptz |

`content_revisions(id, object_id, editor_id, diff jsonb, created_at)` gives editorial
history. The static `lib/bodies.ts` of Phase 1 is exactly the seed export of this table.

### lessons / quizzes  (education)
- `lessons(id, slug, locale, level, title, summary)`
- `lesson_steps(lesson_id, ord, body_md, snapshot jsonb)` — each step is text + a
  camera/time snapshot the app flies to ("guided tour" = lesson with autoplay).
- `quizzes(id, lesson_id)`, `quiz_questions(quiz_id, ord, prompt, choices jsonb,
  answer_idx, explanation)`
- `user_progress(user_id, lesson_id, step_ord, quiz_score, completed_at)`

### events_cache
Precomputed astronomical events so the events list is queryable/searchable server-side
(and indexable for SEO pages like `/events/2027-total-solar-eclipse`):
`events_cache(id, kind, peak_at timestamptz, visibility jsonb, payload jsonb)`,
refreshed by a scheduled job running the same astronomy-engine searches in Node.

## 3. Large catalogs (stars to mag 12+, NGC/IC, minor planets)
Do **not** put per-star rows in Postgres for rendering — serve binary, spatially
indexed static tiles instead:
- HEALPix- or cone-tiled star chunks (`/catalogs/stars/{level}/{pix}.bin`,
  Float32 packed), fetched progressively as the user zooms — same pattern as ESA Sky.
- Postgres keeps only the *searchable index*: `catalog_index(ref, names tsvector,
  ra, dec, mag)` with a GIN index for autocomplete and a q3c/pgsphere index for
  cone queries.

## 4. Indexing summary
- `bookmarks(user_id, created_at desc)`
- `catalog_index using gin(names)`; `q3c_ang2ipix(ra,dec)` for spatial search
- `events_cache(peak_at)`, `content_objects(kind)`
- `sessions(invite_code)` unique
