import { WebSocket, WebSocketServer } from "ws";
import { Config } from "../launcher_types.js";
import { Logger } from "../logger.js";
import Packet, { loadPackets } from "./Packet.js";
import * as http from "http";
import * as https from "https";
import { readFile } from "fs/promises";
import { Duplex } from "stream";
import { parseDomain, ParseResultType } from "parse-domain";
import { Util } from "./Util.js";
import CSLoginPacket from "./packets/CSLoginPacket.js";
import SCIdentifyPacket from "./packets/SCIdentifyPacket.js";
import { Motd } from "./Motd.js";
import { Player } from "./Player.js";
import { Enums } from "./Enums.js";
import { NETWORK_VERSION, PROXY_BRANDING, PROXY_VERSION, VANILLA_PROTOCOL_VERSION } from "../meta.js";
import { CSUsernamePacket } from "./packets/CSUsernamePacket.js";
import { SCSyncUuidPacket } from "./packets/SCSyncUuidPacket.js";
import { SCReadyPacket } from "./packets/SCReadyPacket.js";
import { Chalk } from "chalk";
import EventEmitter from "events";
import { MineProtocol } from "./Protocol.js";
import { EaglerSkins } from "./skins/EaglerSkins.js";
import { CSSetSkinPacket } from "./packets/CSSetSkinPacket.js";
import { CSChannelMessagePacket } from "./packets/channel/CSChannelMessage.js";
import { Constants, UPGRADE_REQUIRED_RESPONSE } from "./Constants.js";
import { PluginManager } from "./pluginLoader/PluginManager.js";
import ProxyRatelimitManager from "./ratelimit/ProxyRatelimitManager.js";
import { SkinServer } from "./skins/SkinServer.js";
import { resolveMinecraftServer } from "./ServerResolver.js";
import { TranslationTarget, TranslationTargets } from "./TranslationTargets.js";

let instanceCount = 0;
const chalk = new Chalk({ level: 2 });
const motdMatcher = /^accept: motd/i;

export class Proxy extends EventEmitter {
  public packetRegistry: Map<
    number,
    Packet & {
      class: any;
    }
  >;
  public players = new Map<string, Player>();
  public pluginManager: PluginManager;
  public config: Config["adapter"];
  public wsServer: WebSocketServer;
  public httpServer: http.Server;
  public skinServer: SkinServer;
  public broadcastMotd?: Motd.MOTD;
  public ratelimit: ProxyRatelimitManager;
  private readonly translationTargets = new TranslationTargets();

  private _logger: Logger;
  private initalHandlerLogger: Logger;

  private loaded: boolean;

  constructor(config: Config["adapter"], pluginManager: PluginManager) {
    super();
    this._logger = new Logger(`EaglerProxy-${instanceCount}`);
    this.initalHandlerLogger = new Logger(`EaglerProxy-InitialHandler`);
    // hijack the initial handler logger to append [InitialHandler] to the beginning
    (this.initalHandlerLogger as any)._info = this.initalHandlerLogger.info;
    this.initalHandlerLogger.info = (msg: string) => {
      (this.initalHandlerLogger as any)._info(`${chalk.blue("[InitialHandler]")} ${msg}`);
    };
    (this.initalHandlerLogger as any)._warn = this.initalHandlerLogger.warn;
    this.initalHandlerLogger.warn = (msg: string) => {
      (this.initalHandlerLogger as any)._warn(`${chalk.blue("[InitialHandler]")} ${msg}`);
    };
    (this.initalHandlerLogger as any)._error = this.initalHandlerLogger.error;
    this.initalHandlerLogger.error = (msg: string) => {
      (this.initalHandlerLogger as any)._error(`${chalk.blue("[InitialHandler]")} ${msg}`);
    };
    (this.initalHandlerLogger as any)._fatal = this.initalHandlerLogger.fatal;
    this.initalHandlerLogger.fatal = (msg: string) => {
      (this.initalHandlerLogger as any)._fatal(`${chalk.blue("[InitialHandler]")} ${msg}`);
    };
    (this.initalHandlerLogger as any)._debug = this.initalHandlerLogger.debug;
    this.initalHandlerLogger.debug = (msg: string) => {
      (this.initalHandlerLogger as any)._debug(`${chalk.blue("[InitialHandler]")} ${msg}`);
    };
    this.config = config;
    this.pluginManager = pluginManager;
    instanceCount++;

    process.on("uncaughtException", (err) => {
      this._logger.warn(`An uncaught exception was caught! Error: ${err.stack}`);
    });

    process.on("unhandledRejection", (err) => {
      this._logger.warn(`An unhandled rejection was caught! Rejection: ${(err as Error).stack || err}`);
    });
  }

  public async init() {
    this._logger.info(`Starting ${PROXY_BRANDING} v${PROXY_VERSION}...`);
    global.PROXY = this;
    if (this.loaded) throw new Error("Can't initiate if proxy instance is already initialized or is being initialized!");
    this.loaded = true;
    this.packetRegistry = await loadPackets();
    this.skinServer = new SkinServer(
      this,
      this.config.useNatives,
      this.config.skinServer.cache.skinCachePruneInterval,
      this.config.skinServer.cache.skinCacheLifetime,
      this.config.skinServer.cache.folderName,
      this.config.skinServer.cache.useCache,
      this.config.skinServer.skinUrlWhitelist
    );
    global.PACKET_REGISTRY = this.packetRegistry;
    if (this.config.motd == "FORWARD") {
      this._pollServer(this.config.server.host, this.config.server.port);
    } else {
      const broadcastMOTD = await Motd.MOTD.generateMOTDFromConfig(this.config, this.config.useNatives);
      (broadcastMOTD as any)._static = true;
      this.broadcastMotd = broadcastMOTD;
      // playercount will be dynamically updated
    }
    if (this.config.tls && this.config.tls.enabled) {
      this.httpServer = https
        .createServer(
          {
            key: await readFile(this.config.tls.key),
            cert: await readFile(this.config.tls.cert),
          },
          (req, res) => this._handleNonWSRequest(req, res, this.config)
        )
        .listen(this.config.bindPort || 8080, this.config.bindHost || "127.0.0.1");
      this.wsServer = new WebSocketServer({
        noServer: true,
      });
    } else {
      this.httpServer = http.createServer((req, res) => this._handleNonWSRequest(req, res, this.config)).listen(this.config.bindPort || 8080, this.config.bindHost || "127.0.0.1");
      this.wsServer = new WebSocketServer({
        noServer: true,
      });
    }
    this.wsServer.on("error", (err) => {
      this._logger.warn(`WebSocket server threw an error: ${err.stack}`);
    });
    this.httpServer.on("upgrade", async (r, s, h) => {
      try {
        await this._handleWSConnectionReq(r, s, h);
      } catch (err) {
        this._logger.error(`Error was caught whilst trying to handle WebSocket upgrade! Error: ${err.stack ?? err}`);
      }
    });
    await new Promise((res, rej) => {
      this.httpServer.once("listening", res);
      this.httpServer.once("error", (err) => {
        this._logger.error(`Error was caught whilst trying to bind HTTP server! Error: ${err.stack ?? err}`);
        rej(err);
      });
    });
    this.httpServer.on("error", (err) => {
      this._logger.warn(`HTTP server threw an error: ${err.stack}`);
    });
    process.on("beforeExit", () => {
      this._logger.info("Cleaning up before exiting...");
      this.players.forEach((plr) => plr.disconnect(Enums.ChatColor.YELLOW + "Proxy is shutting down."));
    });
    this.ratelimit = new ProxyRatelimitManager(this.config.ratelimits);
    this.pluginManager.emit("proxyFinishLoading", this, this.pluginManager);
    this._logger.info(`Started WebSocket server and binded to ${this.config.bindHost} on port ${this.config.bindPort}.`);
  }

  private async _handleNonWSRequest(req: http.IncomingMessage, res: http.ServerResponse, config: Config["adapter"]) {
    const inc = this.ratelimit.http.consume(req.socket.remoteAddress);
    if (inc.success) {
      if (req.method === "GET" && (req.url === "/" || req.url === "/index.html")) {
        res.setHeader("Content-Type", "text/html; charset=utf-8").writeHead(200).end(this._translationPage());
        return;
      }
      if (req.method === "POST" && req.url === "/api/translate") {
        try {
          const body = JSON.parse(await this._readRequestBody(req));
          const created = this.translationTargets.create(String(body.address ?? ""), config.server.port);
          const protocol = req.headers["x-forwarded-proto"] === "https" || (req.socket as any).encrypted ? "wss" : "ws";
          const host = req.headers.host ?? "localhost";
          res.setHeader("Content-Type", "application/json").writeHead(200).end(JSON.stringify({
            websocketUrl: `${protocol}://${host}/connect/${created.token}`,
            host: created.target.host,
            port: created.target.port,
          }));
        } catch (err) {
          res.setHeader("Content-Type", "application/json").writeHead(400).end(JSON.stringify({ error: err.message ?? "Invalid request" }));
        }
        return;
      }
      const ctx: Util.Handlable = { handled: false };
      this.emit("httpConnection", req, res, ctx);
      if (!ctx.handled && req.url === "/health") {
        res.setHeader("Content-Type", "application/json").writeHead(200).end(JSON.stringify({ status: "ok", server: config.server.host }));
        return;
      }
      if (!ctx.handled) res.setHeader("Content-Type", "text/html").writeHead(426).end(UPGRADE_REQUIRED_RESPONSE);
    }
  }

  readonly LOGIN_TIMEOUT = 30000;

  private async _handleWSConnection(ws: WebSocket, req: http.IncomingMessage, target?: TranslationTarget) {
    const rl = this.ratelimit.ws.consume(req.socket.remoteAddress);
    if (!rl.success) {
      return ws.close();
    }

    const ctx: Util.Handlable = { handled: false };
    await this.emit("wsConnection", ws, req, ctx);
    if (ctx.handled) return;

    const firstPacket = await Util.awaitPacket(ws);
    let player: Player, handled: boolean;
    setTimeout(() => {
      if (!handled) {
        this.initalHandlerLogger.warn(
          `Disconnecting client ${
            player ? player.username ?? `[/${(ws as any)._socket.remoteAddress}:${(ws as any)._socket.remotePort}` : `[/${(ws as any)._socket.remoteAddress}:${(ws as any)._socket.remotePort}`
          } due to connection timing out.`
        );
        if (player) player.disconnect(`${Enums.ChatColor.YELLOW} Your connection timed out whilst processing handshake, please try again.`);
        else ws.close();
      }
    }, this.LOGIN_TIMEOUT);
    try {
      if (motdMatcher.test(firstPacket.toString())) {
        if (!this.ratelimit.motd.consume(req.socket.remoteAddress).success) {
          return ws.close();
        }
        if (target) {
          const motd = await Motd.MOTD.generateMOTDFromPing(target.host, target.port, this.config.useNatives).catch((err) => {
            this._logger.warn(`Error polling ${target.host}:${target.port} for MOTD: ${err.stack ?? err}`);
          });
          if (motd) {
            const bufferized = motd.toBuffer();
            ws.send(bufferized[0]);
            if (bufferized[1] != null) ws.send(bufferized[1]);
          }
        } else if (this.broadcastMotd) {
          const eventDetail = { motd: null };
          this.emit("fetchMotd", ws, req, eventDetail);
          eventDetail.motd = await eventDetail.motd;
          if (eventDetail.motd != null) {
            const bufferized = eventDetail.motd.toBuffer();
            ws.send(bufferized[0]);
            if (bufferized[1] != null) ws.send(bufferized[1]);
          } else {
            if (this.config.motd == "REALTIME") {
              const motd = await Motd.MOTD.generateMOTDFromPing(this.config.server.host, this.config.server.port, this.config.useNatives).catch((err) => {
                this._logger.warn(`Error polling ${this.config.server.host}:${this.config.server.port} for MOTD: ${err.stack ?? err}`);
              });
              if (motd) {
                const bufferized = motd.toBuffer();
                ws.send(bufferized[0]);
                if (bufferized[1] != null) ws.send(bufferized[1]);
              }
            } else if ((this.broadcastMotd as any)._static) {
              this.broadcastMotd.jsonMotd.data.online = this.players.size;
              // sample for players
              this.broadcastMotd.jsonMotd.data.players = [];
              const playerSample = [...this.players.keys()].filter((sample) => !sample.startsWith("!phs_")).slice(0, 5);
              this.broadcastMotd.jsonMotd.data.players = playerSample;
              if (this.players.size - playerSample.length > 0) this.broadcastMotd.jsonMotd.data.players.push(`${Enums.ChatColor.GRAY}${Enums.ChatColor.ITALIC}(and ${this.players.size - playerSample.length} more)`);

              const bufferized = this.broadcastMotd.toBuffer();
              ws.send(bufferized[0]);
              if (bufferized[1] != null) ws.send(bufferized[1]);
            } else {
              const motd = this.broadcastMotd.toBuffer();
              ws.send(motd[0]);
              if (motd[1] != null) ws.send(motd[1]);
            }
          }
        }
        handled = true;
        ws.close();
      } else {
        (ws as any).httpRequest = req;
        player = new Player(ws as any);
        const rl = this.ratelimit.connect.consume(req.socket.remoteAddress);
        if (!rl.success) {
          handled = true;
          player.disconnect(`${Enums.ChatColor.RED}You have been ratelimited!\nTry again in ${Enums.ChatColor.WHITE}${rl.retryIn / 1000}${Enums.ChatColor.RED} seconds`);
          return;
        }

        const loginPacket = new CSLoginPacket().deserialize(firstPacket);
        player.state = Enums.ClientState.PRE_HANDSHAKE;
        if (loginPacket.gameVersion != VANILLA_PROTOCOL_VERSION) {
          player.disconnect(`${Enums.ChatColor.RED}Please connect to this proxy on EaglercraftX 1.8.9.`);
          return;
        } else if (loginPacket.networkVersion != NETWORK_VERSION) {
          player.disconnect(`${Enums.ChatColor.RED}Your EaglercraftX version is too ${loginPacket.networkVersion > NETWORK_VERSION ? "new" : "old"}! Please ${loginPacket.networkVersion > NETWORK_VERSION ? "downgrade" : "update"}.`);
          return;
        }
        try {
          Util.validateUsername(loginPacket.username);
        } catch (err) {
          player.disconnect(`${Enums.ChatColor.RED}${err.reason || err}`);
          return;
        }
        player.username = loginPacket.username;
        player.uuid = Util.generateUUIDFromPlayer(player.username);
        if (this.players.size >= this.config.maxConcurrentClients) {
          player.disconnect(`${Enums.ChatColor.YELLOW}Proxy is full! Please try again later.`);
          return;
        } else if (this.players.get(player.username) != null || this.players.get(`!phs.${player.uuid}`) != null) {
          player.disconnect(`${Enums.ChatColor.YELLOW}Someone under your username (${player.username}) is already connected to the proxy!`);
          return;
        }
        this.players.set(`!phs.${player.uuid}`, player);
        this._logger.info(
          `Player ${loginPacket.username} (${Util.generateUUIDFromPlayer(loginPacket.username)}) running ${loginPacket.brand}/${loginPacket.version} (net ver: ${loginPacket.networkVersion}, game ver: ${
            loginPacket.gameVersion
          }) is attempting to connect!`
        );
        player.write(new SCIdentifyPacket());
        const usernamePacket: CSUsernamePacket = (await player.read(Enums.PacketId.CSUsernamePacket)) as any;
        if (usernamePacket.username !== player.username) {
          player.disconnect(`${Enums.ChatColor.YELLOW}Failed to complete handshake. Your game version may be too old or too new.`);
          return;
        }
        const syncUuid = new SCSyncUuidPacket();
        syncUuid.username = player.username;
        syncUuid.uuid = player.uuid;
        player.write(syncUuid);

        const prom = await Promise.all([player.read(Enums.PacketId.CSReadyPacket), (await player.read(Enums.PacketId.CSSetSkinPacket)) as CSSetSkinPacket]),
          skin = prom[1],
          obj = new EaglerSkins.EaglerSkin();
        obj.owner = player;
        obj.type = skin.skinType as any;
        if (skin.skinType == Enums.SkinType.CUSTOM) obj.skin = skin.skin;
        else obj.builtInSkin = skin.skinId;
        player.skin = obj;

        player.write(new SCReadyPacket());
        this.players.delete(`!phs.${player.uuid}`);
        this.players.set(player.username, player);
        player.initListeners();
        this._bindListenersToPlayer(player);
        player.state = Enums.ClientState.POST_HANDSHAKE;
        this._logger.info(`Handshake Success! Connecting player ${player.username} to server...`);
        handled = true;

        const backend = target ?? this.config.server;
        const destination = await resolveMinecraftServer(backend.host, backend.port);
        this._logger.info(
          `Resolved backend ${backend.host} to ${destination.host}:${destination.port}${destination.usedSrv ? " using SRV" : " using fallback port"}.`
        );
        await player.connect({
          host: destination.host,
          port: destination.port,
          username: player.username,
        });
        this._logger.info(`Player ${player.username} successfully connected to server.`);
        this.emit("playerConnect", player);
      }
    } catch (err) {
      this.initalHandlerLogger.warn(`Error occurred whilst handling handshake: ${err.stack ?? err}`);
      handled = true;
      ws.close();
      if (player && player.uuid && this.players.has(`!phs.${player.uuid}`)) this.players.delete(`!phs.${player.uuid}`);
      if (player && player.uuid && this.players.has(player.username)) this.players.delete(player.username);
    }
  }

  private _bindListenersToPlayer(player: Player) {
    let sentDisconnectMsg = false;
    player.on("disconnect", () => {
      if (this.players.has(player.username)) this.players.delete(player.username);
      this.initalHandlerLogger.info(`DISCONNECT ${player.username} <=> DISCONNECTED`);
      if (!sentDisconnectMsg) this._logger.info(`Player ${player.username} (${player.uuid}) disconnected from the proxy server.`);
    });
    player.on("proxyPacket", async (packet) => {
      if (packet.packetId == Enums.PacketId.CSChannelMessagePacket) {
        try {
          const msg: CSChannelMessagePacket = packet as any;
          if (msg.channel == Constants.EAGLERCRAFT_SKIN_CHANNEL_NAME) {
            await this.skinServer.handleRequest(msg, player, this);
          }
        } catch (err) {
          this._logger.error(`Failed to process channel message packet! Error: ${err.stack || err}`);
        }
      }
    });
    player.on("switchServer", (client) => {
      this.initalHandlerLogger.info(`SWITCH_SERVER ${player.username} <=> ${client.socket.remoteAddress}:${client.socket.remotePort}`);
    });
    player.on("joinServer", (client) => {
      this.initalHandlerLogger.info(`SERVER_CONNECTED ${player.username} <=> ${client.socket.remoteAddress}:${client.socket.remotePort}`);
    });
  }

  static readonly POLL_INTERVAL: number = 10000;

  private _pollServer(host: string, port: number, interval?: number) {
    (async () => {
      while (true) {
        const motd = await Motd.MOTD.generateMOTDFromPing(host, port, this.config.useNatives).catch((err) => {
          this._logger.warn(`Error polling ${host}:${port} for MOTD: ${err.stack ?? err}`);
        });
        if (motd) this.broadcastMotd = motd;
        await new Promise((res) => setTimeout(res, interval ?? Proxy.POLL_INTERVAL));
      }
    })();
  }

  private async _handleWSConnectionReq(req: http.IncomingMessage, socket: Duplex, head: Buffer) {
    const origin = req.headers.origin == null || req.headers.origin == "null" ? null : req.headers.origin;
    if (!this.config.origins.allowOfflineDownloads && origin == null) {
      socket.destroy();
      return;
    }
    if (this.config.origins.originBlacklist != null && this.config.origins.originBlacklist.some((host) => Util.areDomainsEqual(host, origin))) {
      socket.destroy();
      return;
    }
    if (this.config.origins.originWhitelist != null && !this.config.origins.originWhitelist.some((host) => Util.areDomainsEqual(host, origin))) {
      socket.destroy();
      return;
    }
    try {
      const route = new URL(req.url ?? "/", "http://localhost").pathname.match(/^\/connect\/([A-Za-z0-9_-]+)\/?$/);
      const target = route ? this.translationTargets.get(route[1]) : undefined;
      if (route && !target) {
        socket.destroy();
        return;
      }
      await this.wsServer.handleUpgrade(req, socket, head, (ws) => this._handleWSConnection(ws, req, target));
    } catch (err) {
      this._logger.error(`Error was caught whilst trying to handle WebSocket connection request! Error: ${err.stack ?? err}`);
      socket.destroy();
    }
  }

  private _readRequestBody(req: http.IncomingMessage): Promise<string> {
    return new Promise((resolve, reject) => {
      let body = "";
      req.setEncoding("utf8");
      req.on("data", (chunk) => {
        body += chunk;
        if (body.length > 4096) reject(new Error("Request is too large."));
      });
      req.on("end", () => resolve(body));
      req.on("error", reject);
    });
  }

  private _translationPage(): string {
    return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Aternos to Eagler WSS</title><style>
      :root{color-scheme:dark;--bg:#10161d;--panel:#19232d;--line:#344554;--text:#edf4f7;--muted:#9fb1ba;--accent:#70d6b3;--danger:#ff9d8e}*{box-sizing:border-box}body{margin:0;min-height:100vh;background:radial-gradient(circle at 15% 10%,#24434a 0,#10161d 38%),var(--bg);color:var(--text);font:16px Georgia,serif;display:grid;place-items:center;padding:24px}.panel{width:min(620px,100%);background:rgba(25,35,45,.94);border:1px solid var(--line);padding:clamp(28px,6vw,58px);box-shadow:0 24px 80px #0008}h1{font-size:clamp(2rem,7vw,4.5rem);line-height:.95;margin:0 0 18px;max-width:8ch}p{color:var(--muted);line-height:1.5;margin:0 0 28px}label{display:block;font-size:.85rem;color:var(--muted);margin-bottom:8px}input,button{width:100%;border:1px solid var(--line);font:inherit;padding:14px 16px}input{background:#0e141a;color:var(--text);margin-bottom:12px}button{background:var(--accent);color:#10251f;border:0;font-weight:bold;cursor:pointer}button:disabled{opacity:.6;cursor:wait}.result{margin-top:22px;padding:16px;background:#0e141a;border-left:3px solid var(--accent);word-break:break-all}.result a{color:var(--accent)}.error{color:var(--danger);margin-top:14px;min-height:1.2em}small{color:var(--muted);display:block;margin-top:18px;line-height:1.4}</style></head><body><main class="panel"><h1>Translate your server.</h1><p>Enter the Aternos address to create a personal Eaglercraft WebSocket route. The route forwards the server handshake, player data, MOTD, skins, and version information for every connected player.</p><form id="form"><label for="address">Aternos address</label><input id="address" name="address" placeholder="your-server.aternos.me:25565" required autocomplete="off"><button id="submit" type="submit">Translate</button></form><div id="error" class="error" role="alert"></div><div id="result" class="result" hidden><strong>WebSocket address</strong><br><a id="url" href=""></a><small>Paste this WSS address into your Eaglercraft server list. It expires after one hour without use.</small></div></main><script>const form=document.querySelector('#form'),button=document.querySelector('#submit'),error=document.querySelector('#error'),result=document.querySelector('#result'),url=document.querySelector('#url');form.addEventListener('submit',async event=>{event.preventDefault();button.disabled=true;error.textContent='';result.hidden=true;try{const response=await fetch('/api/translate',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({address:document.querySelector('#address').value})});const data=await response.json();if(!response.ok)throw new Error(data.error||'Translation failed.');url.href=data.websocketUrl;url.textContent=data.websocketUrl;result.hidden=false}catch(exception){error.textContent=exception.message}finally{button.disabled=false}});</script></body></html>`;
  }

  public fetchUserByUUID(uuid: MineProtocol.UUID): Player | null {
    for (const [username, player] of this.players) {
      if (player.uuid == uuid) return player;
    }
    return null;
  }
}

interface ProxyEvents {
  playerConnect: (player: Player) => void;
  playerDisconnect: (player: Player) => void;
  fetchMotd: (ws: WebSocket, erq: http.IncomingMessage, result: { motd: Promise<Motd.MOTD> }) => void;

  httpConnection: (req: http.IncomingMessage, res: http.ServerResponse, ctx: Util.Handlable) => void;
  wsConnection: (ws: WebSocket, req: http.IncomingMessage, ctx: Util.Handlable) => void;
}

export declare interface Proxy {
  on<U extends keyof ProxyEvents>(event: U, listener: ProxyEvents[U]): this;
  emit<U extends keyof ProxyEvents>(event: U, ...args: Parameters<ProxyEvents[U]>): boolean;
}
