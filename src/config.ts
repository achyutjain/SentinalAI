import "dotenv/config";

function optional(name: string): string | undefined {
  const v = process.env[name];
  return v && v.trim().length > 0 ? v.trim() : undefined;
}

function required(name: string): string {
  const v = optional(name);
  if (!v) {
    throw new Error(
      `Missing required environment variable: ${name}. Copy .env.example to .env and fill it in.`
    );
  }
  return v;
}

export const config = {
  llm: {
    provider: (optional("LLM_PROVIDER") ?? "groq") as "groq" | "ollama",
    groq: {
      apiKey: optional("GROQ_API_KEY"),
      reasoningModel: optional("GROQ_REASONING_MODEL") ?? "llama-3.3-70b-versatile",
      plannerModel: optional("GROQ_PLANNER_MODEL") ?? "llama-3.3-70b-versatile",
    },
    ollama: {
      baseUrl: optional("OLLAMA_BASE_URL") ?? "http://localhost:11434",
      model: optional("OLLAMA_MODEL") ?? "llama3.1:8b",
    },
  },
  github: {
    appId: optional("GITHUB_APP_ID"),
    appPrivateKeyPath: optional("GITHUB_APP_PRIVATE_KEY_PATH"),
    appInstallationId: optional("GITHUB_APP_INSTALLATION_ID"),
    token: optional("GITHUB_TOKEN"),
  },
  verify: {
    raceConcurrency: Number(optional("VERIFY_RACE_CONCURRENCY") ?? "200"),
    bootTimeoutSeconds: Number(optional("VERIFY_BOOT_TIMEOUT_SECONDS") ?? "25"),
  },
};

export function requireEnv(name: string): string {
  return required(name);
}

export function hasGitHubApp(): boolean {
  return Boolean(
    config.github.appId && config.github.appPrivateKeyPath && config.github.appInstallationId
  );
}
