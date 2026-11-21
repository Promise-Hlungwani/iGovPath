import { spawn, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const serviceDirectory = path.resolve(scriptDirectory, "..", "services", "ai");
const isWindows = process.platform === "win32";
const virtualenvPython = path.join(
  serviceDirectory,
  ".venv",
  isWindows ? "Scripts" : "bin",
  isWindows ? "python.exe" : "python",
);

function runSetupCommand(command, args) {
  const result = spawnSync(command, args, {
    cwd: serviceDirectory,
    stdio: "inherit",
  });

  if (result.error) {
    console.error(`Could not run ${command}: ${result.error.message}`);
    process.exit(1);
  }

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function findPython() {
  const candidates = isWindows
    ? [
        ["py", ["-3.12"]],
        ["python", []],
        ["python3", []],
      ]
    : [
        ["python3.12", []],
        ["python3", []],
        ["python", []],
      ];

  for (const [command, args] of candidates) {
    const result = spawnSync(command, [...args, "--version"], {
      cwd: serviceDirectory,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });

    if (result.status === 0) {
      return { command, args };
    }
  }

  console.error("Python was not found. Install Python 3.12, then run pnpm ai:setup.");
  process.exit(1);
}

function setup() {
  if (!existsSync(virtualenvPython)) {
    const python = findPython();
    console.log("Creating the AI service virtual environment...");
    runSetupCommand(python.command, [...python.args, "-m", "venv", ".venv"]);
  }

  console.log("Installing AI service dependencies...");
  runSetupCommand(virtualenvPython, [
    "-m",
    "pip",
    "install",
    "-q",
    "-r",
    "requirements.txt",
  ]);
}

function runModule(moduleName, args) {
  if (!moduleName) {
    console.error("Specify a Python module to run.");
    process.exit(1);
  }

  if (!existsSync(virtualenvPython)) {
    console.error("Python virtual environment not found. Run pnpm ai:setup first.");
    process.exit(1);
  }

  const child = spawn(virtualenvPython, ["-m", moduleName, ...args], {
    cwd: serviceDirectory,
    stdio: "inherit",
  });

  child.on("error", (error) => {
    console.error(`Could not start Python module ${moduleName}: ${error.message}`);
    process.exitCode = 1;
  });

  child.on("exit", (code) => {
    process.exitCode = code ?? 1;
  });

  for (const signal of ["SIGINT", "SIGTERM"]) {
    process.on(signal, () => child.kill(signal));
  }
}

const [action, ...args] = process.argv.slice(2);

if (action === "setup") {
  setup();
} else if (action === "run") {
  const [moduleName, ...moduleArgs] = args;
  runModule(moduleName, moduleArgs);
} else {
  console.error("Usage: python-ai.mjs <setup | run <module> [args...]>");
  process.exit(1);
}
