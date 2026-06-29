import path from "node:path";
import Fastify from "fastify";
import cors from "@fastify/cors";
import multipart from "@fastify/multipart";
import fastifyStatic from "@fastify/static";
import { registerRoutes } from "./routes/index.js";

const PORT = Number(process.env.PORT ?? 3001);
const HOST = process.env.HOST ?? "0.0.0.0";
const STATIC_DIR = process.env.STATIC_DIR?.trim();

function resolveCorsOrigin(): boolean | string[] {
  const raw = process.env.CORS_ORIGINS?.trim();
  if (raw) {
    return raw.split(",").map((o) => o.trim()).filter(Boolean);
  }
  if (STATIC_DIR) {
    return true;
  }
  return ["http://localhost:5173", "http://127.0.0.1:5173"];
}

async function main() {
  const app = Fastify({ logger: true });

  await app.register(cors, {
    origin: resolveCorsOrigin(),
  });

  await app.register(multipart);

  await registerRoutes(app);

  app.get("/api/health", async () => ({ status: "ok" }));

  if (STATIC_DIR) {
    const root = path.resolve(STATIC_DIR);
    await app.register(fastifyStatic, {
      root,
      prefix: "/",
      decorateReply: false,
    });
    app.setNotFoundHandler((request, reply) => {
      if (request.url.startsWith("/api/")) {
        return reply.status(404).send({ error: "Not found" });
      }
      return reply.sendFile("index.html", root);
    });
  }

  await app.listen({ port: PORT, host: HOST });
  console.log(`SubTranslate AI listening on http://${HOST}:${PORT}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
