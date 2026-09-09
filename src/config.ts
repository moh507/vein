// This folder contains options for both the bridge and networking adapter.
// Environment files and .env files are available here. Set the value of any config option to process.env.<ENV name>

import { Config } from "./launcher_types.js";
import { iconData } from "./icon.js";

export const config: Config = {
  adapter: {
    name: "Aternos-proxy",
    bindHost: "0.0.0.0",
    bindPort: Number.parseInt(process.env.PORT ?? "8080", 10),
    maxConcurrentClients: 20,
    // Set this to false if you are unable to install sharp due to either the use of a platform
    // that does not support native modules or if you are unable to install the required dependencies.
    // This will cause the proxy to use jimp instead of sharp, which may degrade performance.
    useNatives: true,
    skinServer: {
      skinUrlWhitelist: undefined,
      cache: {
        useCache: true,
        folderName: "skinCache",
        skinCacheLifetime: 60 * 60 * 1000,
        skinCachePruneInterval: 10 * 60 * 1000,
      },
    },
    // Keep the WebSocket endpoint visible while the Aternos backend is asleep.
    motd: {
      l1: "§acome join our §olittle §4§nsecret§4 §a§lROOM",
      l2: "§kG§r §lJENNYS MOD§r §kl",
      // Embedded 64x64 PNG. No external URL or extra runtime download is required.
      iconURL: iconData,
    },
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
      host: process.env.ATERNOS_HOST ?? "windowsTw.aternos.me",
      port: Number.parseInt(process.env.ATERNOS_FALLBACK_PORT ?? "49864", 10),
    },
    tls: undefined,
  },
};
