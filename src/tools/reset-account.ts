import AccountStore from "../proxy/accounts/AccountStore.js";

const username = process.argv[2];
const password = process.argv[3];
if (!username || !password) {
  console.error("Usage: node build/tools/reset-account.js <registeredUsername> <newPassword>");
  process.exit(1);
}

const store = new AccountStore(process.env.ACCOUNT_DATA_DIR ?? "data/accounts", process.env.ACCOUNT_EXPORT_FILE ?? "data/players.txt");
await store.resetPassword(username, password);
console.log(`Password reset for ${username}.`);