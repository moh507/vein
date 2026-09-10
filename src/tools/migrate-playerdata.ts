import fs from "fs/promises";
import path from "path";
import { Util } from "../proxy/Util.js";

function argument(name: string) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

const world = argument("--world");
const oldName = argument("--old-name");
const newName = argument("--new-name");

if (!world || !oldName || !newName) {
  console.error("Usage: node build/tools/migrate-playerdata.js --world <world> --old-name <oldEaglerName> --new-name <registeredName>");
  process.exit(1);
}

const playerdata = path.join(path.resolve(world), "playerdata");
const oldUuid = Util.generateUUIDFromPlayer(oldName);
const newUuid = Util.generateUUIDFromPlayer(newName);
const source = path.join(playerdata, `${oldUuid}.dat`);
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
await fs.copyFile(source, destination);
console.log(`Migrated ${oldName} (${oldUuid}) to ${newName} (${newUuid}).`);
console.log("This preserves the complete player NBT, including inventory, position, XP, and ender chest.");