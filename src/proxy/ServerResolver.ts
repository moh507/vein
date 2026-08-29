import { resolveSrv } from "node:dns/promises";

export type ResolvedServer = {
  host: string;
  port: number;
  usedSrv: boolean;
};

/** Resolve Minecraft's SRV record on every player connection. */
export async function resolveMinecraftServer(host: string, fallbackPort: number): Promise<ResolvedServer> {
  const normalizedHost = host.trim().replace(/\.$/, "");

  try {
    const records = await resolveSrv(`_minecraft._tcp.${normalizedHost}`);
    if (records.length === 0) throw new Error("SRV query returned no records");

    records.sort((a, b) => a.priority - b.priority || b.weight - a.weight);
    const selected = records[0];
    return {
      host: selected.name.replace(/\.$/, ""),
      port: selected.port,
      usedSrv: true,
    };
  } catch {
    return {
      host: normalizedHost,
      port: fallbackPort,
      usedSrv: false,
    };
  }
}
