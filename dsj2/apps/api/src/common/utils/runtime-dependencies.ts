import { InternalServerErrorException } from "@nestjs/common";
import { spawn } from "node:child_process";
import { access } from "node:fs/promises";

export async function assertReadablePath(
  path: string,
  errorMessage: string,
) {
  try {
    await access(path);
  } catch {
    throw new InternalServerErrorException(errorMessage);
  }
}

export async function assertPython3Available(errorMessage: string) {
  await assertCommandSucceeds("python3", ["--version"], errorMessage);
}

export async function assertPythonModuleAvailable(
  moduleName: string,
  errorMessage: string,
) {
  await assertCommandSucceeds("python3", ["-c", `import ${moduleName}`], errorMessage);
}

async function assertCommandSucceeds(
  command: string,
  args: string[],
  errorMessage: string,
) {
  try {
    await new Promise<void>((resolve, reject) => {
      const processHandle = spawn(command, args, {
        stdio: "ignore",
      });

      processHandle.on("error", reject);
      processHandle.on("close", (code) => {
        if (code === 0) {
          resolve();
          return;
        }

        reject(new Error(`${command} exited with code ${code}.`));
      });
    });
  } catch {
    throw new InternalServerErrorException(errorMessage);
  }
}

export function toRuntimeDependencyError(
  error: unknown,
  fallbackMessage: string,
) {
  if (error instanceof InternalServerErrorException) {
    return error;
  }

  if (error instanceof Error) {
    return new InternalServerErrorException(error.message || fallbackMessage);
  }

  return new InternalServerErrorException(fallbackMessage);
}
