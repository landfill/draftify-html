import manifest from "../../../packages/extension/manifest.json";

/** `manifest.json.version` is the single source for the user-visible extension release. */
export const EXTENSION_RELEASE = {
  filename: "mockspec-extension.zip",
  href: "/download/mockspec-extension.zip",
  version: manifest.version,
} as const;
