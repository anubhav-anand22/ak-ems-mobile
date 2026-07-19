const fs = require("fs");
const path = require("path");
const readline = require("readline");

// File paths
const PACKAGE_JSON_PATH = path.join(__dirname, "../package.json");
const APP_JSON_PATH = path.join(__dirname, "../app.json");

// Helper to prompt user in terminal
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function askQuestion(query) {
  return new Promise((resolve) => rl.question(query, resolve));
}

// SemVer logic parsing
function bumpVersion(currentVersion, type) {
  let [major, minor, patch] = currentVersion.split(".").map(Number);

  switch (type.toLowerCase()) {
    case "major":
      major += 1;
      minor = 0;
      patch = 0;
      break;
    case "minor":
      minor += 1;
      patch = 0;
      break;
    case "patch":
      patch += 1;
      break;
    default:
      throw new Error("Invalid version type selected.");
  }

  return `${major}.${minor}.${patch}`;
}

async function main() {
  try {
    // 1. Check if files exist
    if (!fs.existsSync(PACKAGE_JSON_PATH) || !fs.existsSync(APP_JSON_PATH)) {
      console.error(
        "❌ Error: Could not find package.json or app.json in the project root.",
      );
      rl.close();
      return;
    }

    // 2. Read current files
    const packageData = JSON.parse(fs.readFileSync(PACKAGE_JSON_PATH, "utf8"));
    const appData = JSON.parse(fs.readFileSync(APP_JSON_PATH, "utf8"));

    const currentVersion = packageData.version || "1.0.0";
    console.log(`\n📦 Current Version: ${currentVersion}`);

    // 3. Ask user for release type
    const answer = await askQuestion(
      "Select version bump type: \n0)patch \n1)minor \n2)major\n>>> ",
    );
    const choice = answer.trim().toLowerCase();

    if (!["0", "1", "2"].includes(choice)) {
      console.log(
        `❌ Aborted: You must type 0 for "patch", 1 for "minor", or 2 for "major". You selected ${choice}`,
      );
      rl.close();
      return;
    }

    const versionTypes = ["patch", "minor", "major"];

    // 4. Calculate new version string
    const newVersion = bumpVersion(currentVersion, versionTypes[choice]);
    console.log(`🚀 Bumping version to: ${newVersion}...`);

    // 5. Update package.json
    packageData.version = newVersion;
    fs.writeFileSync(
      PACKAGE_JSON_PATH,
      JSON.stringify(packageData, null, 2) + "\n",
    );

    // 6. Update app.json (handling the nested expo block structure safely)
    if (appData.expo) {
      appData.expo.version = newVersion;

      // Optional Android Optimization:
      // Automatically increments versionCode dynamically if it's set as an integer.
      if (
        appData.expo.android &&
        typeof appData.expo.android.versionCode === "number"
      ) {
        appData.expo.android.versionCode += 1;
        console.log(
          `🤖 Android versionCode bumped to: ${appData.expo.android.versionCode}`,
        );
      }
    } else {
      appData.version = newVersion;
    }
    fs.writeFileSync(APP_JSON_PATH, JSON.stringify(appData, null, 2) + "\n");

    console.log("✅ Successfully updated package.json and app.json!");
  } catch (error) {
    console.error("❌ An error occurred:", error.message);
  } finally {
    rl.close();
  }
}

// Run the script
main();
