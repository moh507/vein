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
