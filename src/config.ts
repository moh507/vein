// Configuration for the Aternos -> Eaglercraft WebSocket proxy.
// Environment variables can override the Aternos destination.

import { Config } from "./launcher_types.js";

export const config: Config = {
  adapter: {
    name: "Aternos-proxy",
    bindHost: "0.0.0.0",
    bindPort: Number.parseInt(process.env.PORT ?? "8080", 10),
    maxConcurrentClients: 20,
    // Native Sharp is enabled by default. Set ATERNOS_DISABLE_NATIVE_IMAGE=true to use Jimp.
    useNatives: process.env.ATERNOS_DISABLE_NATIVE_IMAGE !== "true",
    skinServer: {
      skinUrlWhitelist: undefined,
      cache: {
        useCache: true,
        folderName: "skinCache",
        skinCacheLifetime: 60 * 60 * 1000,
        skinCachePruneInterval: 10 * 60 * 1000,
      },
    },
    motd: {
      l1: "§acome join our §olittle §4§nsecret§4 §a§lROOM",
      l2: "§kG§r §lJENNYS MOD§r §kl",
      // Disable the custom icon until the image pipeline is verified.
      iconURL: undefined,
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
