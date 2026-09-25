import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { rendercvBin, RENDERCV_VERSION } from "../lib/integrations/rendercv";

const pin = fs.readFileSync(path.join(process.cwd(), "rendercv-requirements.txt"), "utf8").trim();
if (pin !== `rendercv[full]==${RENDERCV_VERSION}`) throw new Error(`RenderCV pin mismatch: ${pin}`);
const bin = rendercvBin();
if (!fs.existsSync(bin)) throw new Error(`RenderCV executable missing: ${bin}`);
const result = spawnSync(bin, ["--version"], { encoding: "utf8", timeout: 10_000 });
if (result.error || result.status !== 0 || result.stdout.trim() !== `RenderCV v${RENDERCV_VERSION}`) throw new Error(`RenderCV version mismatch: ${(result.stdout || result.stderr || result.error || "no response").toString().trim()}`);
console.log(`RenderCV v${RENDERCV_VERSION}: OK (${bin})`);
