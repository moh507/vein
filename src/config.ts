// Configuration for the Aternos -> Eaglercraft WebSocket proxy.
// Environment variables can override the Aternos destination.

import { Config } from "./launcher_types.js";

export const config: Config = {
  adapter: {
    name: "Aternos-proxy",
    bindHost: "0.0.0.0",
    bindPort: Number.parseInt(process.env.PORT ?? "8080", 10),
    maxConcurrentClients: 20,
    // Use the pure-JS image path on Render to avoid native PNG decoding issues.
    useNatives: false,
    skinServer: {
      skinUrlWhitelist: undefined,
      cache: {
        useCache: true,
        folderName: "skinCache",
        skinCacheLifetime: 60 * 60 * 1000,
        skinCachePruneInterval: 10 * 60 * 1000,
      },
    },
    motd: "FORWARD",
    ratelimits: {
      lockout: 10,
      limits: {
        http: 100,
        ws: 100,
        motd: 100,
        skins: 1000,
        skinsIp: 10000,
        connect: 100,
      },
    },
    origins: {
      allowOfflineDownloads: true,
      originWhitelist: null,
      originBlacklist: null,
    },
    server: {
      host: "windowsTw.aternos.me",
      port: 49864,
    },
    accounts: {
      folder: process.env.ACCOUNT_DATA_DIR ?? "data/accounts",
      exportFile: process.env.ACCOUNT_EXPORT_FILE ?? "data/players.txt",
      preserveLegacyPlayerData: process.env.PRESERVE_LEGACY_PLAYERDATA !== "false",
    },
    adminStatusToken: process.env.ADMIN_STATUS_TOKEN,
    tls: undefined,
  },
};
