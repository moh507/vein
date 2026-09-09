import { randomBytes } from "crypto";
import { isIP } from "net";

export type TranslationTarget = {
  host: string;
  port: number;
};

type StoredTarget = TranslationTarget & {
  expiresAt: number;
};

const TARGET_TTL = 60 * 60 * 1000;
const MAX_TARGETS = 5000;
const ATERNOS_SUFFIXES = [".aternos.me", ".aternos.host", ".aternos.org"];

export class TranslationTargets {
  private readonly targets = new Map<string, StoredTarget>();

  public create(address: string, fallbackPort: number): { token: string; target: TranslationTarget } {
    const target = this.parse(address, fallbackPort);
    this.prune();
    if (this.targets.size >= MAX_TARGETS) throw new Error("Too many active translations. Try again later.");

    const token = randomBytes(18).toString("base64url");
    this.targets.set(token, { ...target, expiresAt: Date.now() + TARGET_TTL });
    return { token, target };
  }

  public get(token: string): TranslationTarget | undefined {
    const stored = this.targets.get(token);
    if (!stored || stored.expiresAt <= Date.now()) {
      if (stored) this.targets.delete(token);
      return undefined;
    }
    stored.expiresAt = Date.now() + TARGET_TTL;
    return { host: stored.host, port: stored.port };
  }

  private parse(address: string, fallbackPort: number): TranslationTarget {
    const value = address.trim();
    if (!value || value.length > 253 || /[/?#@]/.test(value)) throw new Error("Enter an Aternos server address, for example play.example.aternos.me:25565.");

    const parsed = value.match(/^([^:]+)(?::(\d{1,5}))?$/);
    if (!parsed) throw new Error("Enter a valid Aternos hostname and optional port.");
    const host = parsed[1].toLowerCase().replace(/\.$/, "");
    const port = parsed[2] == null ? fallbackPort : Number(parsed[2]);
    const allowedDomain = ATERNOS_SUFFIXES.some((suffix) => host.endsWith(suffix) && host.length > suffix.length);
    if (!allowedDomain || isIP(host) !== 0) throw new Error("Only Aternos hostnames are supported.");
    if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("The port must be between 1 and 65535.");
    return { host, port };
  }

  private prune() {
    const now = Date.now();
    for (const [token, target] of this.targets) {
      if (target.expiresAt <= now) this.targets.delete(token);
    }
  }
}