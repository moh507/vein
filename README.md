# Lulzdreamland Eaglercraft Proxy

A fixed-destination EaglercraftX 1.8 WebSocket proxy for:

```text
Lulzdreamland.aternos.me:56181
```

It resolves the server's Minecraft SRV record every time a player connects, so
there is no in-game `/join` command and no need to update a changing Aternos
backend address. The public endpoint cannot be used to reach arbitrary servers.

This project is based on the MIT-licensed
[WorldEditAxe/eaglerproxy](https://github.com/WorldEditAxe/eaglerproxy).

## Before deploying

On Aternos:

1. Enable **Cracked** mode.
2. Install **ViaVersion**, **ViaBackwards**, and **ViaRewind** on the Paper
   server. All three are required to bridge an Eaglercraft 1.8 client to a
   modern Paper server.
3. Restart the Aternos server after changing plugins.

## Deploy on Render

1. Put this project in a GitHub repository.
2. In Render, choose **New > Blueprint** and select the repository.
3. Apply the `render.yaml` blueprint.
4. Wait for the deployment to finish.

Render will provide an address similar to:

```text
https://lulzdreamland-eagler-proxy.onrender.com
```

Use the WebSocket version in Eaglercraft:

```text
wss://lulzdreamland-eagler-proxy.onrender.com/
```

On Render's free plan, the service sleeps after 15 minutes without inbound
traffic. To wake it, open its `https://` address, wait until it responds, and
then connect through Eaglercraft. Aternos must also be running.

## Environment variables

| Variable | Default | Purpose |
| --- | --- | --- |
| `ATERNOS_HOST` | `Lulzdreamland.aternos.me` | Stable Aternos hostname |
| `ATERNOS_FALLBACK_PORT` | `56181` | Used only if no SRV record is available |
| `PORT` | `8080` | Automatically provided by Render |

## Local test

```bash
npm ci
npm run build
npm start
```

Open `http://localhost:8080/health`. It should return a small JSON status.

## Security

This build removes the general-purpose EagProxyAAS `/join` plugin. Every player
is forwarded only to the configured Aternos hostname. Do not add Microsoft
authentication tokens or passwords to this project.
