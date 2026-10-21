import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import tailwindcss from "@tailwindcss/vite";
import AutoImport from "unplugin-auto-import/vite";
import Components from "unplugin-vue-components/vite";
import { HeadlessUiResolver } from "unplugin-vue-components/resolvers";
import { unheadVueComposablesImports } from "@unhead/vue";
import { resolve } from "path";
import { readFileSync } from "fs";
import localeWriterPlugin from "./vite-plugins/locale-writer.js";
import tailwindColorsPlugin from "./vite-plugins/tailwind-colors.js";

function SidechartsResolver() {
  function extractDefaultExports(filePath) {
    try {
      const content = readFileSync(filePath, "utf-8");
      const names = new Set();
      for (const [, name] of content.matchAll(/export \{ default as (\w+) \}/g)) {
        names.add(name);
      }
      return names;
    } catch {
      return new Set();
    }
  }

  const vueDir = resolve(import.meta.dirname, "src/components/sidecharts/vue");
  const indexPath = resolve(vueDir, "index.js");
  const names = extractDefaultExports(indexPath);

  try {
    const indexContent = readFileSync(indexPath, "utf-8");
    for (const [, subPath] of indexContent.matchAll(/export \* from "(.+)"/g)) {
      for (const name of extractDefaultExports(resolve(vueDir, subPath))) {
        names.add(name);
      }
    }
  } catch {}

  return (name) => {
    if (names.has(name)) return { name, from: "sidecharts/vue" };
  };
}

export default defineConfig(({ command }) => ({
  // The production bundle is served by Symfony from public/app, so assets must
  // resolve under /app/. In dev Vite serves from the root.
  base: command === "build" ? "/app/" : "/",

  build: {
    // Outside the Vite root, so emptyOutDir has to be explicit.
    outDir: "../backend/public/app",
    emptyOutDir: true,
  },

  plugins: [
    tailwindColorsPlugin(),
    tailwindcss(),
    vue(),
    localeWriterPlugin(),
    Components({ resolvers: [HeadlessUiResolver(), SidechartsResolver()] }),
    AutoImport({
      imports: ["vue", unheadVueComposablesImports],
    }),
  ],

  resolve: {
    alias: {
      "@": resolve(import.meta.dirname, "src"),
    },
  },
  server: {
    open: true,
  },
  // remove this for normal file hashing:
  // build: {
  //   rolldownOptions: {
  //     output: {
  //       entryFileNames: `assets/[name].js`,
  //       chunkFileNames: `assets/[name].js`,
  //       assetFileNames: `assets/[name].[ext]`,
  //     },
  //   },
  // },
}));
