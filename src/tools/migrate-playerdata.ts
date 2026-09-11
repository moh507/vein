import fs from "fs/promises";
import path from "path";
import zlib from "zlib";
import nbt from "prismarine-nbt";
import { Util } from "../proxy/Util.js";

function argument(name: string) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

const world = argument("--world");
const oldName = argument("--old-name");
const newName = argument("--new-name");
const eaglerWorld = process.argv.includes("--eagler-world");

if (!world || !oldName || !newName) {
  console.error("Usage: node build/tools/migrate-playerdata.js --world <world> --old-name <oldName> --new-name <registeredName> [--eagler-world]");
  process.exit(1);
}

const worldPath = path.resolve(world);
const playerdata = path.join(worldPath, "playerdata");
const oldUuid = Util.generateUUIDFromPlayer(oldName);
const newUuid = Util.generateUUIDFromPlayer(newName);
const source = eaglerWorld ? path.join(worldPath, "player", `${oldName.toLowerCase()}.dat`) : path.join(playerdata, `${oldUuid}.dat`);
const destination = path.join(playerdata, `${newUuid}.dat`);

try {
  await fs.access(source);
} catch {
  console.error(`Old player data was not found: ${source}`);
  console.error("This means the old world export did not include that player's server-side data.");
  process.exit(2);
}

await fs.mkdir(playerdata, { recursive: true });
try {
  await fs.access(destination);
  await fs.copyFile(destination, `${destination}.backup-${Date.now()}`);
} catch {
  // No current destination file needs a backup.
}
if (eaglerWorld) {
  const parsed = await nbt.parse(await fs.readFile(source));
  const root = parsed.parsed as any;
  const tags = root.value as Record<string, any>;
  const uuidBytes = Buffer.from(Util.uuidStringToBuffer(newUuid));
  let most = uuidBytes.readBigInt64BE(0);
  let least = uuidBytes.readBigInt64BE(8);
  tags.UUIDMost = { type: "long", value: most };
  tags.UUIDLeast = { type: "long", value: least };
  const encoded = nbt.writeUncompressed(root);
  await fs.writeFile(destination, zlib.gzipSync(encoded));
} else {
  await fs.copyFile(source, destination);
}
console.log(`Migrated ${oldName} (${oldUuid}) to ${newName} (${newUuid}).`);
console.log("This preserves the complete player NBT, including inventory, position, XP, and ender chest.");