<div align="center">
  <img src="public/shardnote-mark.svg" alt="ShardNote logo" width="120" height="120" />
  <h1>ShardNote</h1>
  <p><strong>A private, self-hosted Markdown workspace for the web.</strong></p>

  <p>
    <a href="https://nextjs.org/"><img src="https://img.shields.io/badge/Next.js-000000?style=for-the-badge&logo=next.js&logoColor=white" alt="Next.js" /></a>
    <a href="https://react.dev/"><img src="https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB" alt="React" /></a>
    <a href="https://www.typescriptlang.org/"><img src="https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript" /></a>
    <a href="https://www.docker.com/"><img src="https://img.shields.io/badge/Docker-2CA5E0?style=for-the-badge&logo=docker&logoColor=white" alt="Docker" /></a>
    <a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-yellow.svg?style=for-the-badge" alt="MIT license" /></a>
  </p>
</div>

ShardNote turns an ordinary folder of Markdown files into a responsive web workspace. Browse, search, edit and connect notes from a desktop or phone while keeping the original `.md` files on your own server.

ShardNote is an independent project and is not affiliated with or endorsed by Obsidian.

## Features

- Responsive file explorer, tabs, reading mode and CodeMirror editor.
- Wiki links, backlinks, tags, full-text search and bookmarks.
- Internal-link and folder-hierarchy graph views.
- Password-protected sessions using signed HttpOnly cookies.
- Automatic saves with conflict detection and atomic file replacement.
- Pre-save backups and a recoverable trash inside `.shardnote/`.
- Local attachment rendering with remote images blocked by default.
- Non-root standalone Docker image with no analytics or cloud account.

## Recommended Docker installation

### Requirements

- Docker Engine with Docker Compose v2.
- A directory containing your Markdown notes.
- Port `2506` available on the Docker host, or a different host-side port in the Compose file.
- A password of at least 12 characters and a random session secret of at least 32 characters.

### 1. Download ShardNote

```bash
git clone https://github.com/lucas-lepajollec/shardnote.git
cd shardnote
cp .env.example .env
```

On Windows PowerShell, use `Copy-Item .env.example .env` instead of `cp`.

### 2. Configure the vault and authentication

Edit `.env` and replace the placeholder credentials:

```dotenv
SHARDNOTE_VAULT_PATH=./vault
SHARDNOTE_PASSWORD=replace-with-a-long-unique-password
SHARDNOTE_SESSION_SECRET=replace-with-at-least-32-random-characters
SHARDNOTE_PUBLIC_READ=false
SHARDNOTE_SECURE_COOKIES=false
```

`SHARDNOTE_VAULT_PATH` may be an absolute host path. Generate a stable session secret with:

```bash
openssl rand -hex 32
```

PowerShell alternative:

```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 3. Start ShardNote

```bash
docker compose pull
docker compose up -d
docker compose ps
```

Open `http://SERVER_IP:2506`. The container runs as UID/GID `1001:1001`; ensure that this user can read and write the mounted vault.

### 4. Update safely

Back up the vault first, then update the published image:

```bash
docker compose pull
docker compose up -d
docker compose ps
```

Record the previous image digest before updating. If the update fails, set `SHARDNOTE_IMAGE` to the previous version or `sha-<full-commit>` tag and recreate the container without deleting the vault.

Compose publishes port `2506` on the host interfaces so ShardNote works directly on a normal self-hosted LAN. Keep authentication enabled and do not expose it directly to the public internet. Use an authenticated HTTPS reverse proxy or firewall rules for remote access. To restrict it to the Docker host, override the mapping with `127.0.0.1:2506:2506` in a local Compose override.

To build the current checkout instead of pulling GHCR, use:

```bash
docker compose -f docker-compose.yml -f docker-compose.build.yml up -d --build
```

These commands keep the configured vault. Never remove or replace the host notes directory unless you intentionally want to remove its contents.

## Local development

Use Node.js 22 LTS:

```powershell
npm ci
Copy-Item .env.example .env.local
npm run dev
```

Replace the placeholder credentials in `.env.local`, then open `http://127.0.0.1:2499`.

The development server remains local by default. To test from another device on a trusted network, run:

```powershell
npm run dev:lan
```

Open one of the LAN addresses printed by the command. Direct LAN access uses HTTP, so set `SHARDNOTE_SECURE_COOKIES=false` only for this trusted-network setup.

## Configuration

| Variable | Required | Default | Purpose |
| --- | --- | --- | --- |
| `SHARDNOTE_IMAGE` | Docker only | `ghcr.io/lucas-lepajollec/shardnote:latest` | Published image or immutable rollback tag |
| `SHARDNOTE_VAULT_PATH` | Docker only | `./vault` | Host directory mounted into the container |
| `NOTES_PATH` | No | `./vault` | Vault path used by the Node.js application |
| `SHARDNOTE_PASSWORD` | Yes | — | Password of at least 12 characters |
| `SHARDNOTE_SESSION_SECRET` | Yes | — | Stable secret used to sign 12-hour sessions |
| `SHARDNOTE_PUBLIC_READ` | No | `false` | Allows anonymous reading while keeping writes private |
| `SHARDNOTE_SECURE_COOKIES` | No | `true` in production | Restricts the session cookie to HTTPS |
| `SHARDNOTE_AUTH_DISABLED` | Development only | `false` | Disables authentication and is rejected in production |

ShardNote refuses access when the required authentication variables are missing or too weak.

## Data safety

- Existing notes are copied to `.shardnote/backups/<note>/` before replacement.
- Deleted files and folders are moved to `.shardnote/trash/` instead of being erased.
- A save returns HTTP `409` when a note changed on disk after it was opened.
- Symbolic links and paths outside the configured vault are rejected.
- Notes larger than 5 MB, attachments larger than 10 MB and vaults larger than 5,000 notes are rejected by default.

The `.shardnote` directory belongs to the vault and should be included in regular backups. ShardNote improves recoverability but does not replace snapshots or versioned backups.

## Security and remote access

- Private reading is the default; anonymous access must be enabled explicitly.
- State-changing requests require a valid session and same-origin checks.
- Raw HTML is not executed and remote images are blocked by default.
- The production container runs as an unprivileged user with Linux capabilities dropped by Compose.
- Never commit `.env`, `.env.local`, a personal vault or `.shardnote` recovery data.
- Put ShardNote behind HTTPS or a trusted private network such as Tailscale before remote exposure.

Do not expose a direct unauthenticated HTTP instance to the public internet.

## Project layout

```text
shardnote/
├── public/                  # ShardNote brand and static assets
├── scripts/                 # Local and LAN development launcher
├── src/app/                 # Next.js interface and API routes
├── src/components/          # Markdown editor and renderer
├── src/lib/                 # Authentication, API and vault safety logic
├── tests/                   # Vault lifecycle and graph tests
├── vault/                   # Fictional example vault for local evaluation
├── docker-compose.yml       # Production-style local deployment
├── docker-compose.dev.yml   # Containerized development environment
└── Dockerfile               # Non-root standalone production image
```

## Validation

```powershell
npm run check
docker compose config --quiet
```

`npm run check` runs ESLint, TypeScript, unit tests and the production build.

## Contributing

Contributions are welcome. Read [CONTRIBUTING.md](CONTRIBUTING.md) and [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md) before opening a pull request. ShardNote is distributed under the [MIT License](LICENSE).
