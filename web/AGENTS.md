<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Cursor Cloud specific instructions

This environment runs a **fully local stack** — no cloud Supabase project or secrets are
needed. All `npm` commands run from `web/` (the `package.json` lives there, not the repo root).

### Services

| Service | Where | Start command | Notes |
|---------|-------|---------------|-------|
| Next.js dev app | `web/`, port 3000 | `npm run dev` | Serves UI + `/api/*`. Standard scripts in `web/package.json`. |
| Local Supabase (Docker) | `web/`, ports 54321/54322 | `supabase start` | Postgres (54322) + PostgREST/Kong REST API (54321). Auth/Studio/Storage/Realtime/edge/analytics are disabled in `supabase/config.toml`; the app uses custom PIN auth (`app_users` + `jose` JWT), not Supabase Auth. |

The update script only refreshes npm deps. **Docker and Supabase are NOT auto-started** — bring
them up manually each session before `npm run dev`:

1. Docker daemon has no systemd here. If `docker info` fails, start it: `sudo dockerd &` then
   `sudo chmod 666 /var/run/docker.sock`. (Installed with `fuse-overlayfs` storage driver +
   `containerd-snapshotter=false` in `/etc/docker/daemon.json` for Docker 29 in this VM.)
2. `cd web && supabase start` (first run pulls images; later runs are fast and reuse the Docker
   volume, so DB data persists across `supabase start`/`stop` — it is wiped only by
   `supabase stop --no-backup`).

### Database schema + seed (only on a fresh/empty DB)

Auto-migrations are disabled in `supabase/config.toml` on purpose: this repo has two `002_*`
migration files (a duplicate version the CLI's tracker rejects) and files `014`–`017` are not
listed in the `db:migrate` script. Apply every SQL file in numeric order (skipping the seed
file), from `web/`:

```bash
for f in $(ls -1 supabase/migrations/*.sql | grep -v '002_seed_pins' | sort); do
  docker exec -i supabase_db_web psql -U postgres -d postgres -v ON_ERROR_STOP=1 -q < "$f"
done
npm run seed:pins    # operator 1111 / admin 2222 / manager 3333
npm run import:csv   # 16 sample suppliers + 178 items
```

`008_fix_gramma_unit.sql` intentionally errors on an empty DB (a historical **data** fix that
needs imported data; it has no schema/DDL, so it is safe to skip).

### `web/.env.local` (gitignored — recreate with these stable local values)

```
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=<local demo anon key>
SUPABASE_SERVICE_ROLE_KEY=<local demo service_role key>
SESSION_SECRET=<any 32+ char string>
DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres
TZ=Asia/Bangkok
```

The anon/service_role keys are the well-known Supabase **local demo** keys (constant across
restarts). Run `supabase status` (from `web/`) to print the current values.

### Lint / build caveats

- `npm run lint` runs but currently reports pre-existing errors/warnings unrelated to setup.
- `next build` (production) fails on those same pre-existing lint/type errors; use `npm run dev`
  for development.
