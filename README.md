# norelock.lol

Personal site: portfolio on `/`, music player on `/music`.

SolidJS + Vite, deployed on Vercel. Two serverless functions handle downloads
and their counters; everything else is static.

---

## Running it

```bash
bun install
bun run dev          # localhost:5173
bun run build        # vite build, then slices the audio into HLS segments
bun run typecheck
```

`bun run dev` serves the site without the API — download counters stay at zero
and the download buttons link straight to the files. To exercise the functions
locally, use `vercel dev` instead.

---

## Adding music

Drop tagged mp3 files into `media/` and run:

```bash
bun run music -- --dry   # shows what it would do, changes nothing
bun run music            # reads tags, extracts covers, rewrites track data
```

The script reads ID3 tags, so the tags are the source of truth:

| Tag | Used for |
| --- | --- |
| Title | track name on the page |
| Year / Date | release year, sort order |
| Album | groups tracks and moves them into `media/<album>/` |
| Track # | order within an album |
| Genre | shown as a tag under the title |
| Cover art | extracted to `public/music/covers/` |

Leave **Album** empty for singles — filling it in creates a one-track album.
Album artwork only needs to be embedded in one track of the record; the cover
is shared across the album.

Files are named from the mp3 filename (`whisper your name.mp3` →
`whisper-your-name`), and that slug keys the artwork and the waveform data.
**Do not rename files after the first run** — the track loses its waveform and
leaves an orphaned cover behind.

`bun run music` overwrites title, year, duration, cover and album in
`src/data/tracks.ts`. It preserves `subtitle`, `tags` and `downloadable`, so
hand edits to those survive.

---

## How the audio is served

The mp3 files live in `media/`, **outside** `public/`. Vercel only publishes
`public/`, so the originals have no public URL at all. This is deliberate:
`/api/download` is the only route to a file, which is what makes the download
counter meaningful. Blocking a public path with rewrite rules would have been
weaker — there would still be a URL, just one guarded by config.

Two different things happen depending on whether you are listening or saving.

### Listening: HLS segments

`bun run build` runs `scripts/build-hls.mjs`, which slices every mp3 into
ten-second AAC segments and writes them to `dist/music/`. Playing a track pulls
a few hundred kilobytes at a time instead of the whole file, and skipping to
the end does not download the middle.

Segments are generated at build time on Vercel, not committed, and not created
on demand — ffmpeg is ~80 MB against a ~50 MB function limit, so on-the-fly
transcoding is not possible.

Three things are easy to get wrong here and are handled in the script:

- `-c:a copy` produces **one** giant segment: an mp3 stream lacks the
  timestamps the segmenter needs, so re-encoding to AAC is required.
- An mp3 with embedded artwork carries a second (video) stream. Without
  `-map 0:a:0 -vn`, ffmpeg tries to pack the image into MPEG-TS and the
  segmenting silently fails.
- fluent-ffmpeg passes the segment filename through a shell string, so a space
  in a folder name truncates the path. Output directories are slugified.

Playback uses `hls.js`, except in Safari which plays HLS natively. The library
is a separate ~185 kB (gzipped) chunk loaded only when playback starts. If a
playlist is missing or fails, the player falls back to
`/api/download?inline=1`, which streams the mp3 and does **not** touch the
counter.

### Saving: `/api/download`

Runs on the Node runtime — it reads files from disk, which the edge runtime
cannot do. The request carries only a track id; the file path comes from the
generated track list on the server, so a caller cannot point the endpoint at
another file or inflate the count for a track that does not exist.

`vercel.json` declares `includeFiles: "media/**"` — nothing imports the mp3
files, so Vercel would not otherwise ship them with the function.

---

## Download counts and personal data

The counter records **how many times a track was downloaded**, nothing else.
No analytics, no cookies, no third-party scripts.

### What is stored

Two tables in Postgres (Neon):

```
downloads      track_id, count, updated_at
download_hits  track_id, ip_hash, last_seen
```

`downloads` is a plain tally. `download_hits` exists only so the same person
does not add ten to the count by clicking ten times.

### What is done with the IP address

**The IP address is never written down.** It is used in memory to compute a
digest, and that digest is what the row contains.

The digest is `SHA-256(secret_salt : current_date : ip)`:

- **The salt is a server-side secret** (`IP_HASH_SALT`). Without it, hashing
  all four billion IPv4 addresses and matching the results is a few hours of
  work, and the digest would be reversible — which would make it personal data
  rather than a pseudonym. `hashIp()` refuses to run if the salt is unset,
  rather than silently producing a weak digest.
- **The date is mixed in**, so the digest for the same visitor changes every
  day. Yesterday's rows cannot be correlated with today's, so the table cannot
  be used to follow anyone over time even by whoever holds the salt.
- Rows older than two days are deleted on the next write. They can never match
  again anyway, so nothing is kept beyond the window it is needed for.

The practical effect: the database can answer *"has this visitor already
downloaded this track in the last hour?"* and nothing else. It cannot answer
*"what did this IP download last week?"*, or *"which tracks did one person
take?"*, because after a day there is no shared key left.

Under GDPR this is pseudonymised data with a short retention window and a
narrow purpose (preventing double-counting). Salt rotation is the kill switch:
changing `IP_HASH_SALT` makes every existing digest permanently unmatchable.

### What is not stored

No raw addresses, no user agents, no referrers, no geolocation, no session or
device identifiers, no per-download timestamps beyond `last_seen` on the
deduplication row.

### Screening

Before counting, a request is checked for signs of automation (bot user agents,
missing user agent, cross-site fetches, proxy chains) and the IP is checked
against a VPN/proxy lookup. This decides **only whether the hit counts** — the
file is always served either way. The lookup receives the address but the
result is not stored; only the eventual digest is.

---

## Environment variables

| Variable | Required | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | for counters | Neon Postgres connection string |
| `IP_HASH_SALT` | for counters | secret salt for the digest; without it nothing is counted |

Both are set in the Vercel dashboard. Neither is needed to build or run the
site — without them downloads work normally and counts stay at zero.

Rotating `IP_HASH_SALT` invalidates every stored digest, which is the intended
way to clear the deduplication history.

---

## Debugging the counter

`/api/download?id=<track>&debug=1` reports why a hit would or would not be
counted — whether the track was found, whether the database is reachable, and
which check rejected the request. It is disabled in production
(`VERCEL_ENV === 'production'`) because it exposes part of the visitor address
and the state of the database.

When a count silently fails to happen, check the screening path before
suspecting the database: `/api/stats` returning `status: "ok"` with empty
tables means the write never ran, not that the query failed.

---

## Layout

```
api/            serverless functions (download, stats)
  _lib/         database helpers, request screening
media/          source mp3 files — not published, not served directly
public/         static assets; music/covers/ lives here
scripts/        sync-music.mjs (ID3 → track data), build-hls.mjs (segments)
src/
  components/   sections, music player, visuals
  data/         generated track data and waveform peaks
  lib/          player state, HLS attachment, download client
```
