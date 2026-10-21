import fs from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

export default function localeWriterPlugin() {
  return {
    name: "vite-plugin-locale-writer",
    configureServer(server) {
      server.middlewares.use("/__save-locale", (req, res) => {
        if (req.method !== "POST") {
          res.statusCode = 405;
          res.end("Method not allowed");
          return;
        }

        let body = "";
        req.on("data", (chunk) => (body += chunk));
        req.on("end", () => {
          try {
            const { updates } = JSON.parse(body);

            for (const { locale, key, value } of updates) {
              const filePath = resolve(
                __dirname,
                `../src/locales/${locale}.json`,
              );

              if (!fs.existsSync(filePath)) continue;

              const data = JSON.parse(fs.readFileSync(filePath, "utf-8"));

              // Set nested value
              const keys = key.split(".");
              let current = data;
              for (let i = 0; i < keys.length - 1; i++) {
                if (
                  !current[keys[i]] ||
                  typeof current[keys[i]] !== "object"
                ) {
                  current[keys[i]] = {};
                }
                current = current[keys[i]];
              }
              current[keys[keys.length - 1]] = value;

              fs.writeFileSync(
                filePath,
                JSON.stringify(data, null, 2) + "\n",
              );
            }

            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ ok: true }));
          } catch (e) {
            res.statusCode = 500;
            res.end(JSON.stringify({ error: e.message }));
          }
        });
      });
    },
  };
}
