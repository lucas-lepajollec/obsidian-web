<div align="center">
  <img src="./public/shardnote-mark.svg" alt="ShardNote logo" width="72" height="72" />
  <h1>ShardNote</h1>
  <p><strong>A private, self-hosted Markdown workspace for the web.</strong></p>
  <p><code>Next.js 16</code> · <code>Docker</code> · <code>Markdown</code> · <code>Self-hosted</code></p>
</div>

ShardNote lets you browse, search, edit, and explore a folder of Markdown notes from a responsive browser interface. It works with ordinary `.md` files and common wiki links, so your content remains portable and under your control.

ShardNote is an independent project and is not affiliated with or endorsed by Obsidian.

## Highlights

- Responsive file explorer, tabs, reading mode, and CodeMirror editor
- Wiki-link graph, backlinks, tags, full-text search, and bookmarks
- Password-protected private sessions using an HttpOnly cookie
- Automatic saves with conflict detection and atomic file replacement
- Automatic pre-save backups and recoverable trash
- No external fonts, analytics, remote images, or cloud account
- Production Docker image running as an unprivileged user

## Requirements

- Node.js 22 or Docker with Compose
- A folder containing Markdown notes
- A password of at least 12 characters
- A random session secret of at least 32 characters

## Local development

```powershell
npm install
Copy-Item .env.example .env.local
npm run dev
```

Open `http://127.0.0.1:2499`. Replace both placeholder credentials in `.env.local` before signing in.

Local development binds only to the current machine. To test from another device on a trusted network:

```powershell
npm run dev:lan
```

The command binds ShardNote to `0.0.0.0`, authorizes only the detected local development origins, and prints every available network URL. Open the Wi-Fi URL from the phone while both devices are on the same network.

Generate a session secret with:

```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## Docker Compose

Create a `.env` file next to `docker-compose.yml`:

```env
SHARDNOTE_VAULT_PATH=C:/Users/you/Documents/MyVault
SHARDNOTE_PASSWORD=replace-with-a-long-unique-password
SHARDNOTE_SESSION_SECRET=replace-with-at-least-32-random-characters
SHARDNOTE_PUBLIC_READ=false
SHARDNOTE_SECURE_COOKIES=false
```

Then start ShardNote:

```powershell
docker compose up -d --build
```

Open `http://127.0.0.1:2506`. When ShardNote is served through HTTPS, set `SHARDNOTE_SECURE_COOKIES=true`.

The container runs as UID/GID `1001`. Ensure that this user can write to the mounted vault when required by your NAS or Linux host.

## Configuration

| Variable | Required | Default | Purpose |
| --- | --- | --- | --- |
| `NOTES_PATH` | No | `./vault` | Markdown vault path |
| `SHARDNOTE_PASSWORD` | Yes | — | Password of at least 12 characters used only by the login endpoint |
| `SHARDNOTE_SESSION_SECRET` | Yes | — | Signs 12-hour session cookies |
| `SHARDNOTE_PUBLIC_READ` | No | `false` | Allows anonymous reading while keeping writes private |
| `SHARDNOTE_SECURE_COOKIES` | No | `true` in production | Restricts the session cookie to HTTPS |
| `SHARDNOTE_AUTH_DISABLED` | Development only | `false` | Disables authentication; rejected in production |

ShardNote refuses access when the required authentication variables are missing or too weak.

## Data safety

- Existing notes are copied to `.shardnote/backups/<note>/` before replacement.
- Deleted files and folders are moved to `.shardnote/trash/` instead of being erased.
- A save is rejected with HTTP `409` when the note changed on disk after it was opened.
- Symbolic links and paths outside the configured vault are rejected.
- Files larger than 5 MB and vaults larger than 5,000 notes are rejected by default.

The `.shardnote` directory lives inside the configured vault and should be included in your regular backups. ShardNote improves recovery but is not a replacement for versioned backups.

## Security model

Private reading is the default. Authentication uses a signed, HttpOnly, SameSite session cookie; passwords are not stored in browser storage or sent with individual vault operations. State-changing requests require a same-origin marker and pass origin checks. Login attempts are rate-limited per client address.

For remote access, place ShardNote behind an HTTPS reverse proxy or a trusted private network such as Tailscale. Do not expose a direct HTTP instance to the public internet.

Remote images embedded in notes are intentionally blocked to prevent browsers from leaking visitor metadata. Raw HTML in Markdown is not executed.

## Validation

```powershell
npm run check
docker compose config
```

`npm run check` runs ESLint, TypeScript, unit tests, and the production build.

## License

MIT. See [LICENSE](LICENSE).
