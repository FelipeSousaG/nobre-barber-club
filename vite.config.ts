import vinext from "vinext";
import { defineConfig, loadEnv } from "vite";
import hostingConfig from "./.openai/hosting.json";
import { sites } from "./build/sites-vite-plugin";

const PLACEHOLDER_DATABASE_ID = "00000000-0000-4000-8000-000000000000";
const { d1, r2 } = hostingConfig;
const isCodexSeatbeltSandbox = process.env.CODEX_SANDBOX === "seatbelt";

export default defineConfig(async ({ mode }) => {
  process.env.WRANGLER_WRITE_LOGS ??= "false";
  process.env.WRANGLER_LOG_PATH ??= ".wrangler/logs";
  process.env.MINIFLARE_REGISTRY_PATH ??= ".wrangler/registry";
  const { cloudflare } = await import("@cloudflare/vite-plugin");
  const localEnv = loadEnv(mode, process.cwd(), "");
  const vars = Object.fromEntries(
    ["CSRF_SECRET", "ADMIN_SETUP_SECRET", "APP_ORIGIN", "RESEND_API_KEY", "MAIL_FROM"]
      .filter((name) => Boolean(localEnv[name]))
      .map((name) => [name, localEnv[name]]),
  );
  const localBindingConfig = {
    d1_databases: d1
      ? [{ binding: d1, database_name: "nobre-barber-local", database_id: PLACEHOLDER_DATABASE_ID }]
      : [],
    r2_buckets: r2 ? [{ binding: r2, bucket_name: "nobre-barber-local" }] : [],
    vars,
  };

  return {
    server: {
      host: "0.0.0.0",
      allowedHosts: ["terminal.local"],
      ...(isCodexSeatbeltSandbox ? { watch: { useFsEvents: false, usePolling: true } } : {}),
    },
    plugins: [
      vinext(),
      sites(),
      cloudflare({
        viteEnvironment: { name: "rsc", childEnvironments: ["ssr"] },
        inspectorPort: false,
        config: localBindingConfig,
      }),
    ],
  };
});
