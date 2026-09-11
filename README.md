# Aternos → Eaglercraft WebSocket Proxy

A fixed EaglercraftX 1.8 WebSocket translator for the WindowsTw Aternos server.

The proxy resolves the configured server's Minecraft SRV record when a player connects, so changing the Aternos backend port does not require changing the public WebSocket endpoint when the hostname remains the same.

This project is based on the MIT-licensed [WorldEditAxe/eaglerproxy](https://github.com/WorldEditAxe/eaglerproxy).

## How it works

```text
Eaglercraft client
       │
       │ WSS
       ▼
  This proxy
       │
       │ Minecraft TCP
       ▼
Configured Aternos server
```

Use the public WebSocket address directly in Eaglercraft:

```text
wss://THEGOONS.onrender.com/
```

Every player connects through the same public endpoint and gets an independent Minecraft connection to `windowsTw.aternos.me:49864`.

The translator forwards the server's player list, MOTD text and icon, online/max player counts, version response, player UUID/session data, skins, chat, and gameplay packets. The Aternos server still needs to be reachable and configured for cracked/offline connections.

## Before deploying

On Aternos:

1. Enable **Cracked** mode.
2. Install **ViaVersion**, **ViaBackwards**, and **ViaRewind** on the Paper server. These are required to bridge an Eaglercraft 1.8 client to a modern Paper server.
3. Restart the Aternos server after changing plugins.

## Deploy on Render

1. Put this project in a GitHub repository.
2. In Render, choose **New > Blueprint** and select the repository.
3. Apply the `render.yaml` blueprint.
4. Wait for the deployment to finish.

Render will provide an HTTPS/WSS address for the proxy. Use its WebSocket form in Eaglercraft:

```text
wss://YOUR-SERVICE.onrender.com/
```

On Render's free plan, the service can sleep after inactivity. Open its HTTPS address to wake it before connecting through Eaglercraft. The Aternos server must also be running.

## Accounts and old player data

Friends can use the simple joining guide in [JOINING.md](JOINING.md).

Players authenticate through the proxy before connecting to Aternos:

```text
/register RegisteredName a-password-at-least-8-chars
/login RegisteredName a-password-at-least-8-chars
```

By default, an account keeps the original Eagler name as its backend Minecraft identity. For example, `shafi_the_bomber` can register as `shafi`; `/login shafi ...` authenticates the account, while Aternos still uses `shafi_the_bomber` and loads that old UUID's inventory. This is the automatic no-loss mode, so nobody has to register as `win` or any other temporary migration name. Account records are stored in `data/accounts/accounts.json`; `data/players.txt` is an administrator recovery export containing salted hashes, never plaintext passwords. Reset a forgotten password from the proxy host with:

```bash
npm run reset-account -- RegisteredName new-password-at-least-8-chars
```

If an old world export contains `world/playerdata/<old-offline-UUID>.dat`, migrate it before the player joins for the first time:

```bash
npm run migrate-playerdata -- --world /path/to/world --old-name OldEaglerName --new-name RegisteredName
```

The command copies the complete player NBT to the registered offline UUID and backs up an existing destination file. This preserves inventory, position, XP, and ender chest. The checked-in `son` folder has no `playerdata` directory, so it cannot currently be migrated; the old host browser's Eagler world export is required.

For an Eagler EPK extraction, where player files are stored as `world/player/<lowercase-name>.dat`, add `--eagler-world`:

```bash
npm run migrate-playerdata -- --world /path/to/eagler-world --old-name son_im_very_sad --new-name RegisteredName --eagler-world
```

This converts the Eagler player file to gzipped vanilla NBT, rewrites `UUIDMost` and `UUIDLeast`, and writes `world/playerdata/<registered-offline-UUID>.dat`.

`PRESERVE_LEGACY_PLAYERDATA` defaults to `true`. Keep it enabled when the world contains the original Eagler playerdata UUIDs. Set it to `false` only after deliberately converting every player file to registered-name UUIDs.

## Configuration

| Variable | Default | Purpose |
| --- | --- | --- |
| `ATERNOS_HOST` | `windowsTw.aternos.me` | Aternos hostname to forward to |
| `ATERNOS_FALLBACK_PORT` | `49864` | Port used if no SRV record is available |
| `PORT` | `8080` | HTTP/WebSocket listening port provided by the host |

The backend is intentionally fixed to `windowsTw.aternos.me:49864`.

## Local test

```bash
npm ci
npm run build
npm start
```

Then open `http://localhost:8080/health`. It should return a small JSON status.

## Security

This build is a fixed-destination proxy. It does not expose the general-purpose EagProxyAAS `/join` functionality, so clients cannot use the public endpoint to connect to arbitrary servers.

Do not add authentication tokens, passwords, or other secrets to the repository.
