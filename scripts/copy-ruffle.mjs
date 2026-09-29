import { cp, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
await mkdir(`${root}/public/ruffle`, { recursive: true });
await cp(`${root}/node_modules/@ruffle-rs/ruffle`, `${root}/public/ruffle`, {
  recursive: true,
  filter: (source) => !source.endsWith("package.json"),
});
console.log("Local Flash player copied to public/ruffle.");
