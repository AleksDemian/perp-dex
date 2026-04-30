import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { config as loadEnv } from "dotenv";

const candidates = [
  resolve(__dirname, "../../.env"),
  resolve(__dirname, "../.env"),
];

for (const path of candidates) {
  if (existsSync(path)) {
    loadEnv({ path, override: false });
  }
}

const required = ["PERP_ADDRESS", "RPC_URL", "CONTRACT_DEPLOY_BLOCK"];

for (const key of required) {
  if (!process.env[key]) {
    throw new Error(`[indexer] Missing required env var: ${key}`);
  }
}
