import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { dirname, extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.PORT || 8000);
const types = { ".html": "text/html", ".css": "text/css", ".js": "text/javascript", ".ico": "image/x-icon", ".png": "image/png", ".webm": "video/webm" };

createServer(async (request, response) => {
  const path = decodeURIComponent(new URL(request.url, "http://localhost").pathname);
  const file = resolve(join(root, path === "/" ? "index.html" : path.slice(1)));
  if (file !== root && !file.startsWith(root + "\\") && !file.startsWith(root + "/")) {
    response.writeHead(403).end("Forbidden");
    return;
  }
  try {
    const content = await readFile(file);
    response.writeHead(200, { "Content-Type": `${types[extname(file)] || "application/octet-stream"}${extname(file) === ".webm" ? "" : "; charset=utf-8"}`, "Cache-Control": "no-store" });
    response.end(content);
  } catch {
    response.writeHead(404).end("Not Found");
  }
}).listen(port, "127.0.0.1", () => console.log(`折页迷途：http://127.0.0.1:${port}/`));
