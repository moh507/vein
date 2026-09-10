import { randomBytes, scryptSync, timingSafeEqual } from "crypto";
import fs from "fs/promises";
import path from "path";

export type Account = {
  username: string;
  salt: string;
  passwordHash: string;
  legacyUsername?: string;
  createdAt: string;
};

export default class AccountStore {
  private readonly filePath: string;
  private readonly exportPath: string;
  private accounts = new Map<string, Account>();
  private loaded = false;

  constructor(folder: string, exportFile: string) {
    this.filePath = path.join(path.resolve(folder), "accounts.json");
    this.exportPath = path.resolve(exportFile);
  }

  public async load() {
    if (this.loaded) return;
    await fs.mkdir(path.dirname(this.filePath), { recursive: true });
    try {
      const saved = JSON.parse(await fs.readFile(this.filePath, "utf8")) as Account[];
      for (const account of saved) this.accounts.set(this.key(account.username), account);
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
    }
    this.loaded = true;
    await this.writeExport();
  }

  public async register(username: string, password: string, legacyUsername?: string): Promise<Account> {
    await this.load();
    const normalized = this.validateUsername(username);
    if (password.length < 8) throw new Error("Password must be at least 8 characters long.");
    if (this.accounts.has(this.key(normalized))) throw new Error("That registered username is already taken.");
    const salt = randomBytes(16).toString("hex");
    const account: Account = {
      username: normalized,
      salt,
      passwordHash: this.hash(password, salt),
      legacyUsername,
      createdAt: new Date().toISOString(),
    };
    this.accounts.set(this.key(normalized), account);
    await this.save();
    return account;
  }

  public async authenticate(username: string, password: string): Promise<Account | null> {
    await this.load();
    const account = this.accounts.get(this.key(username));
    if (!account) return null;
    const expected = Buffer.from(account.passwordHash, "hex");
    const actual = Buffer.from(this.hash(password, account.salt), "hex");
    return expected.length === actual.length && timingSafeEqual(expected, actual) ? account : null;
  }

  public async resetPassword(username: string, password: string) {
    await this.load();
    if (password.length < 8) throw new Error("Password must be at least 8 characters long.");
    const account = this.accounts.get(this.key(username));
    if (!account) throw new Error("Registered username was not found.");
    account.salt = randomBytes(16).toString("hex");
    account.passwordHash = this.hash(password, account.salt);
    await this.save();
  }

  private async save() {
    await fs.writeFile(this.filePath, JSON.stringify([...this.accounts.values()], null, 2) + "\n", { mode: 0o600 });
    await this.writeExport();
  }

  private async writeExport() {
    await fs.mkdir(path.dirname(this.exportPath), { recursive: true });
    const lines = [
      "Proxy account recovery export",
      "This file contains salted password hashes, not plaintext passwords.",
      "A forgotten password must be reset by an administrator; hashes cannot be reversed.",
      "",
      "username\tpasswordHash\tsalt\tlegacyEaglerUsername",
      ...[...this.accounts.values()].map((account) => `${account.username}\t${account.passwordHash}\t${account.salt}\t${account.legacyUsername ?? ""}`),
    ];
    await fs.writeFile(this.exportPath, lines.join("\n") + "\n", { mode: 0o600 });
  }

  private hash(password: string, salt: string) {
    return scryptSync(password, salt, 64).toString("hex");
  }

  private key(username: string) {
    return username.toLowerCase();
  }

  private validateUsername(username: string) {
    if (!/^[A-Za-z0-9_]{3,20}$/.test(username)) throw new Error("Username must be 3-20 letters, numbers, or underscores.");
    return username;
  }
}