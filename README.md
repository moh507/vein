# Aternos → Eaglercraft WebSocket Proxy

A web-based EaglercraftX 1.8 WebSocket translator for Aternos Minecraft servers.

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

Open the public HTTPS address in a browser, enter an Aternos address, and press **Translate**. The page returns a unique WebSocket address for that server. Each generated route forwards the Minecraft handshake and server packets independently, so multiple people can use different Aternos servers at the same time. Routes expire after one hour without use.

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

The built-in defaults are still available for direct WebSocket clients using `/`, but browser users should use the translation page and the generated `/connect/...` address. Only Aternos hostnames (`*.aternos.me`, `*.aternos.host`, and `*.aternos.org`) are accepted.

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
