import { execFileSync } from "node:child_process";
import {
  existsSync,
  readFileSync,
  readdirSync,
  statSync,
} from "node:fs";
import { join, relative } from "node:path";

const root = process.cwd();
const failures = [];
const warnings = [];

function repoPath(path) {
  return relative(root, path).replaceAll("\\", "/");
}

function readText(path) {
  return readFileSync(path, "utf8");
}

function readJson(path) {
  return JSON.parse(readText(path));
}

function addFailure(message) {
  failures.push(message);
}

function addWarning(message) {
  warnings.push(message);
}

function splitActionSections(toml) {
  return toml
    .split(/\n(?=\[\[actions\]\])/)
    .filter((section) => section.includes("[[actions]]"))
    .map((section) => ({
      name: section.match(/name\s*=\s*"([^"]+)"/)?.[1] ?? "<unnamed>",
      body: section,
    }));
}

function checkRootScripts() {
  const packageJson = readJson(join(root, "package.json"));
  const scripts = packageJson.scripts ?? {};

  if (!scripts["build:local"]) {
    addFailure("Root package.json is missing build:local.");
  }

  if (!scripts.typecheck?.includes("db:generate")) {
    addFailure("Root typecheck must run db:generate before Turbo typecheck.");
  }

  if (!scripts.test || scripts.test.includes("No package-level test")) {
    addFailure("Root test must run real package tests, not the old placeholder.");
  }

  if (!scripts.verify?.includes("test:turbo")) {
    addFailure("Root verify must include package tests.");
  }

  if (!scripts["verify:fast"]) {
    addFailure("Root package.json is missing verify:fast for Codex iteration.");
  }
}

function hasTestFiles(directory) {
  if (!existsSync(directory)) {
    return false;
  }

  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (
      entry.name === "node_modules" ||
      entry.name === "dist" ||
      entry.name === ".next" ||
      entry.name === ".turbo"
    ) {
      continue;
    }

    const fullPath = join(directory, entry.name);

    if (entry.isDirectory() && hasTestFiles(fullPath)) {
      return true;
    }

    if (entry.isFile() && /\.test\.[cm]?[jt]sx?$/.test(entry.name)) {
      return true;
    }
  }

  return false;
}

function checkPackageTestScripts() {
  for (const workspaceRoot of ["apps", "packages"]) {
    const workspacePath = join(root, workspaceRoot);

    if (!existsSync(workspacePath)) {
      continue;
    }

    for (const entry of readdirSync(workspacePath, { withFileTypes: true })) {
      if (!entry.isDirectory()) {
        continue;
      }

      const packagePath = join(workspacePath, entry.name);
      const packageJsonPath = join(packagePath, "package.json");

      if (!existsSync(packageJsonPath) || !hasTestFiles(packagePath)) {
        continue;
      }

      const packageJson = readJson(packageJsonPath);

      if (!packageJson.scripts?.test) {
        addFailure(
          `${repoPath(packageJsonPath)} has *.test files but no package test script.`,
        );
      }
    }
  }
}

function checkCodexActions() {
  const stalePath = String.raw`C:\Users\Linux\Documents\GitHub\DSJ\dsj2`;
  const codexFiles = [
    join(root, ".codex", "environments", "environment.toml"),
    join(root, "..", ".codex", "environments", "environment.toml"),
  ];

  for (const codexFile of codexFiles) {
    if (!existsSync(codexFile)) {
      continue;
    }

    const text = readText(codexFile);
    const fileLabel = repoPath(codexFile);

    if (text.includes(stalePath)) {
      addFailure(`${fileLabel} still points to the stale DSJ workspace path.`);
    }

    const actions = splitActionSections(text);
    const devAction = actions.find((action) => action.name === "dev");
    const verifyAction = actions.find((action) => action.name === "verify");
    const seedAction = actions.find(
      (action) => action.name === "reset-demo-seed",
    );

    if (!devAction) {
      addFailure(`${fileLabel} is missing a dev Codex action.`);
    } else if (
      devAction.body.includes("SEED_ALLOW_DESTRUCTIVE_RESET") ||
      devAction.body.includes("db:seed")
    ) {
      addFailure(`${fileLabel} dev action must not run destructive seed.`);
    }

    if (!verifyAction?.body.includes("pnpm verify")) {
      addFailure(`${fileLabel} verify action must run pnpm verify.`);
    }

    if (!seedAction?.body.includes("SEED_ALLOW_DESTRUCTIVE_RESET")) {
      addFailure(
        `${fileLabel} reset-demo-seed action must keep the destructive seed flag explicit.`,
      );
    }
  }
}

function gitLsFiles(args) {
  try {
    return execFileSync("git", ["ls-files", "-z", ...args], {
      cwd: root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    })
      .split("\0")
      .filter(Boolean);
  } catch {
    addWarning("Could not inspect tracked files with git ls-files.");
    return [];
  }
}

function checkContextDrag() {
  const trackedAgentFiles = gitLsFiles(["--", ".agents"]);
  const trackedAgentBytes = trackedAgentFiles.reduce((total, file) => {
    const fullPath = join(root, file);
    return total + (existsSync(fullPath) ? statSync(fullPath).size : 0);
  }, 0);

  if (trackedAgentFiles.length > 0) {
    addWarning(
      `.agents is tracked (${trackedAgentFiles.length} files, ${(
        trackedAgentBytes /
        1024 /
        1024
      ).toFixed(1)} MiB). Keep it out of agent context unless a task explicitly needs vendored skills.`,
    );
  }

  const largeTrackedFiles = gitLsFiles([])
    .map((file) => {
      const fullPath = join(root, file);
      return {
        file,
        size: existsSync(fullPath) ? statSync(fullPath).size : 0,
      };
    })
    .filter((entry) => entry.size >= 2 * 1024 * 1024)
    .sort((left, right) => right.size - left.size);

  for (const entry of largeTrackedFiles.slice(0, 10)) {
    addWarning(
      `Large tracked file: ${entry.file} (${(entry.size / 1024 / 1024).toFixed(
        1,
      )} MiB).`,
    );
  }
}

checkRootScripts();
checkPackageTestScripts();
checkCodexActions();
checkContextDrag();

for (const warning of warnings) {
  console.warn(`[agent-doctor] warning: ${warning}`);
}

if (failures.length > 0) {
  for (const failure of failures) {
    console.error(`[agent-doctor] failure: ${failure}`);
  }

  process.exit(1);
}

console.log("[agent-doctor] passed");
