# Cosmoscope — Production Deployment Strategy

## 1. Shape of the workload
Phase 1 is a **static-first Next.js app**: the only route prerenders to static HTML,
and all heavy assets (textures ~13 MB, catalogs ~390 KB) are immutable files. That
means: ship everything through a CDN, no servers in the hot path.

## 2. Reference topology

```
users ── CDN edge (Vercel/CloudFront/Cloudflare)
            ├── HTML/JS/CSS  (Next.js build output)
            ├── /textures/*  immutable, cache-control: max-age=31536000, immutable
            ├── /data/*      versioned filenames (stars.v41.json) → immutable
            └── (Phase 2) /api/* → serverless/Node API → Postgres (managed),
                                    /ws/* → WebSocket runtime, object storage for media
```

### Phase 1 (now): any static/Next host
- `npm run build` → deploy to Vercel (zero config) or any Node/static host.
- Headers: `Cross-Origin-Opener-Policy`/`COEP` not required (no SharedArrayBuffer yet);
  add CSP: `default-src 'self'; img-src 'self' data: blob:` (textures are same-origin).
- Brotli precompression for `stars.json` (364 KB → ~90 KB).

### Phase 2: API + realtime
- API: containerized Node (Fastify) or serverless functions; stateless; JWT auth.
- Postgres: managed (RDS/Neon/Supabase) + nightly `events_cache` worker (cron).
- WebSockets: Durable Objects / Fly.io / a small Node pool — session state is tiny
  and loss-tolerant, so no sticky-session complexity beyond room affinity.
- Object storage + CDN for catalog tiles and mission media.

## 3. CI/CD
1. PR: `next build` (type-check) + `node scripts/verify.mjs` against a preview build
   in headless Chrome — fails on any console/page error (the harness already exists).
2. Visual smoke: the four screenshot scenes (surface day, info panel, space, Saturn)
   uploaded as PR artifacts for human eyeballing; later: pixel-diff gating.
3. Merge → preview deploy → promote to production (atomic, instant rollback by
   re-pointing to the previous immutable build).
4. Data pipeline (`scripts/build-data.mjs`) runs only when catalog sources change;
   outputs are committed/versioned so builds are reproducible offline.

## 4. Performance & resilience
- Code-split: the three.js engine chunk loads after first paint (UI shell is
  interactive immediately; loading overlay covers catalog fetch).
- Preload `stars.json` + first textures with `<link rel=preload>` (M1 task).
- Texture LODs: serve 1k variants to devices reporting `deviceMemory <= 4`.
- Error tracking (Sentry) with WebGL-context-loss breadcrumbs; context-loss handler
  rebuilds the renderer (roadmap M1).
- Analytics: privacy-light counters (views, fly-tos, event jumps) — no PII.

## 5. Cost profile
Phase 1: CDN egress only (assets ≈13 MB first visit, ~0 after caching).
Phase 2 adds: one small Postgres, serverless API (search is the only warm path),
WS runtime sized by concurrent sessions (each session ≈ 10 msg/s × ~300 B).

## 6. Licensing obligations (must ship with the product)
- Planet textures: Solar System Scope — **CC BY 4.0** → visible attribution in README
  and in-app Help/About.
- HYG star database — **CC BY-SA 4.0** → attribution; derived `stars.json` keeps the
  same license.
- Constellation data (d3-celestial) — **BSD-3** → retain notice.
- astronomy-engine (MIT), three.js (MIT), Next.js (MIT).
