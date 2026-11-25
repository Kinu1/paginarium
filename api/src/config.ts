export function configuration(env: NodeJS.ProcessEnv = process.env) {
  const projectId = env.FIREBASE_PROJECT_ID?.trim();
  if (!projectId || !env.DATABASE_URL)
    throw new Error("Configure FIREBASE_PROJECT_ID e DATABASE_URL.");
  const production = env.NODE_ENV === "production";
  const emulator = env.FIREBASE_AUTH_EMULATOR_HOST;
  const composeEmulator =
    emulator === "auth:9099" &&
    env.NODE_ENV === "development" &&
    projectId.startsWith("demo-");
  if (
    emulator &&
    (production ||
      (!composeEmulator &&
        !/^(127\.0\.0\.1|localhost|\[::1\]):\d+$/.test(emulator)))
  ) {
    throw new Error(
      "O emulador de autenticação só pode ser usado localmente, fora de produção.",
    );
  }
  const origins = (
    env.WEB_ORIGIN || (production ? "" : "http://localhost:5173")
  )
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (
    !origins.length ||
    origins.some((origin) => {
      try {
        const u = new URL(origin);
        return (
          u.origin !== origin ||
          (production
            ? u.protocol !== "https:"
            : !["http:", "https:"].includes(u.protocol))
        );
      } catch {
        return true;
      }
    })
  )
    throw new Error("Configure WEB_ORIGIN com as origens permitidas.");
  const port = Number(env.PORT || 3000);
  if (!Number.isInteger(port) || port < 1 || port > 65535)
    throw new Error("PORT inválida.");
  return { projectId, databaseUrl: env.DATABASE_URL, origins, port };
}
