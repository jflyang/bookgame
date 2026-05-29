/**
 * Build script for the desktop app.
 * Run from the project root: node apps/desktop/scripts/build.cjs
 *
 * Steps:
 * 1. Build shared package
 * 2. Build API (backend)
 * 3. Build Web (frontend)
 * 4. Build Electron main/preload
 * 5. Package with electron-builder
 */

const { execSync } = require("child_process");
const path = require("path");

const ROOT = path.resolve(__dirname, "../../..");
const run = (cmd, cwd = ROOT) => {
  console.log(`\n> ${cmd}`);
  execSync(cmd, { cwd, stdio: "inherit" });
};

console.log("=== Building Interactive Story Game Desktop ===\n");

// Step 1: Build shared
console.log("📦 Step 1: Building shared package...");
run("npm run build -w @story-game/shared");

// Step 2: Build API
console.log("📦 Step 2: Building API...");
run("npm run build -w @story-game/api");

// Step 3: Build Web
console.log("📦 Step 3: Building Web frontend...");
run("npm run build -w @story-game/web");

// Step 4: Build Electron
console.log("📦 Step 4: Building Electron main process...");
run("npm run build", path.join(ROOT, "apps/desktop"));

// Step 5: Package
console.log("📦 Step 5: Packaging with electron-builder...");
run("npm run package", path.join(ROOT, "apps/desktop"));

console.log("\n✅ Done! Check apps/desktop/release/ for the installer.");
