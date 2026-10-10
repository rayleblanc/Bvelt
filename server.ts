import { spawn } from "node:child_process";

// If started directly via `node server.ts` without tsx module loader,
// spawn a child process with `--import tsx` to enable seamless TypeScript module resolution.
const hasTsx = process.execArgv.some((arg) => arg.includes("tsx"));

if (!hasTsx) {
  const child = spawn(process.execPath, ["--import", "tsx", ...process.argv.slice(1)], {
    stdio: "inherit",
    env: process.env,
  });

  process.on("SIGTERM", () => child.kill("SIGTERM"));
  process.on("SIGINT", () => child.kill("SIGINT"));

  child.on("exit", (code, signal) => {
    if (signal) {
      process.kill(process.pid, signal);
    } else {
      process.exit(code ?? 0);
    }
  });
} else {
  // Execute the full Express application with Vite / API handlers
  await import("./server-app.ts");
}
