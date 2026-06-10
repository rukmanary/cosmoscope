# Cosmoscope — API Architecture

## 0. Principles
- The simulator must stay fully functional **offline/anonymous**: ephemerides and the
  base catalogs never require the API. The API adds persistence, content, search at
  scale, and collaboration.
- All endpoints are JSON over HTTPS, versioned under `/api/v1`. Auth via short-lived
  JWT access token + httpOnly refresh cookie. Anonymous reads are allowed everywhere
  except user data.
- Deep links are first-class: every view state serializes to a URL
  (`/view?b=mars&lat=18.4&lon=77.5&t=2030-11-02T04:00Z&fov=45`), so shared links work
  with zero API calls.

## 1. REST endpoints

### Auth & profile
```
POST /api/v1/auth/register | login | refresh | logout
GET  /api/v1/me                      → profile + settings
PATCH /api/v1/me/settings            → partial Settings JSON
```

### Content (encyclopedia)
```
GET /api/v1/objects/{id}             → content_objects row, ?locale=&level=
GET /api/v1/objects?kind=moon&parent=jupiter
GET /api/v1/search?q=eur             → ranked: bodies, stars, DSOs, lessons
                                       (tsvector + trigram; <50 ms budget)
```
Responses are immutable-cacheable (`ETag` = revision id) and served through the CDN.

### Catalog tiles (static, CDN)
```
GET /catalogs/stars/{level}/{healpix}.bin     (Float32: ra,dec,mag,bv ×N)
GET /catalogs/dso/{level}/{healpix}.json
```
No app server involved; the client streams tiles as FOV/zoom demands.

### Events
```
GET /api/v1/events?from=2026-06-10&days=365&kinds=eclipse,opposition
GET /api/v1/events/{id}              → payload incl. visibility map + view snapshot
```

### Bookmarks & observations
```
GET/POST   /api/v1/bookmarks         POST body = {kind, object_ref, snapshot, label}
DELETE     /api/v1/bookmarks/{id}
GET/POST/PATCH /api/v1/observations
```

### Education
```
GET /api/v1/lessons?level=beginner&locale=id
GET /api/v1/lessons/{slug}           → steps with view snapshots
POST /api/v1/lessons/{slug}/progress
POST /api/v1/quizzes/{id}/attempts   → {answers:[…]} → score + explanations
```

## 2. Realtime (collaborative sessions)

WebSocket `wss://…/ws/sessions/{id}` — the host's client is the time authority.

```
client→server  join {token|invite_code}
host→server    state {simTimeMs, timeRate, paused, observer, followBodyId, camera}
server→all     state …            (rebroadcast, ≤10 Hz, delta-compressed)
client→server  pointer {ra, dec}  (laser-pointer for tours)
server→all     chat {…}, member {join|leave}
```

Late joiners receive the last `state` snapshot from the session row. Conflict rule:
only `host`/`copilot` roles may emit `state`. Transport: any WS-capable runtime
(Node + uWebSockets / Cloudflare Durable Objects); state is tiny and loss-tolerant
(idempotent snapshots, not deltas of position).

## 3. Server-computed events job
A nightly worker (same astronomy-engine library, Node) extends `events_cache` two
years ahead and renders static SEO pages per event. Identical math client/server —
no model drift.

## 4. Rate limits & caching
- Anonymous: 60 req/min; authenticated: 240 req/min (search is the hot path).
- `objects/*`, `events*`, catalog tiles: CDN-cached, stale-while-revalidate.
- User endpoints: no-store.

## 5. Error contract
`{ "error": { "code": "string", "message": "human readable", "details": {} } }`
with conventional HTTP status codes; validation errors enumerate field paths.
