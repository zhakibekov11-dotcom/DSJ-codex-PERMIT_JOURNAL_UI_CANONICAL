import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";

function findWorkspaceRoot(startDirectory: string) {
  let currentDirectory = resolve(startDirectory);

  while (true) {
    if (existsSync(resolve(currentDirectory, "pnpm-workspace.yaml"))) {
      return currentDirectory;
    }

    const parentDirectory = dirname(currentDirectory);
    if (parentDirectory === currentDirectory) {
      return null;
    }

    currentDirectory = parentDirectory;
  }
}

export function getWorkspaceRoot(startDirectory: string) {
  return (
    findWorkspaceRoot(startDirectory) ??
    findWorkspaceRoot(process.cwd()) ??
    process.cwd()
  );
}

export function resolveWorkspacePath(
  startDirectory: string,
  relativePath: string,
) {
  return resolve(getWorkspaceRoot(startDirectory), relativePath);
}
