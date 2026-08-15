const fs = require("node:fs");
const path = require("node:path");
const { execSync } = require("node:child_process");
const readline = require("readline/promises");

const pkgPath = path.join(__dirname, "..", "package.json");
const { version } = require(pkgPath);

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

const main = async () => {
  try {
    const buildType = process.argv
      .find((arg) => arg.startsWith("--build-type="))
      ?.split("=")
      .at(1);
    if (!buildType || !["dev", "prod"].includes(buildType)) {
      console.error("❌ No build type specified.");
      return;
    }
    const isProd = buildType === "prod";

    const { default: clipboard } = await import("clipboardy");
    const currentDirFiles = fs.readdirSync(path.join(__dirname, ".."));
    const buildFiles = currentDirFiles.filter(
      (file) => file.endsWith(".apk") && file.startsWith("build-"),
    );
    console.log(buildFiles);
    if (buildFiles.length === 0) {
      console.error("❌ No build files found (build-*.apk).");
      return;
    }
    const buildFilesData = buildFiles.map((file) => ({
      data: fs.lstatSync(path.join(__dirname, "..", file)),
      name: file,
    }));

    let latestBuild = buildFilesData.reduce((latest, current) =>
      current.data.mtime > latest.data.mtime ? current : latest,
    );

    const newFileName = `build-${version}-${isProd ? "prod" : "dev"}-${Math.random().toString().replace(".", "")}.apk`;

    const deleteOld = await rl.question(
      "Do you want to delete old build files? (y/N) ",
    );
    if (deleteOld.trim().toLowerCase() === "y") {
      const filesToDelete = buildFiles.filter(
        (file) => file !== latestBuild.name,
      );
      for (const fileName of filesToDelete) {
        console.log(`Removing ${fileName}...`);
        fs.unlinkSync(path.join(__dirname, "..", fileName));
      }
      console.log("Old build files removed! ✅");
    } else {
      if (buildFiles.includes(newFileName)) {
        fs.unlinkSync(path.join(__dirname, "..", newFileName));
        console.log(`Removed old ${newFileName}! ✅`);
      }
    }

    let latestBuildPath = path.join(__dirname, "..", latestBuild.name);
    const latestBuildNewPath = path.join(__dirname, "..", newFileName);
    await fs.promises.rename(latestBuildPath, latestBuildNewPath);
    const latestBuildOldName = latestBuild.name;
    latestBuild = {
      name: newFileName,
      data: fs.lstatSync(latestBuildNewPath),
      oldName: latestBuildOldName,
    };
    latestBuildPath = latestBuildNewPath;
    console.log(`latestBuildPath: ${latestBuildPath}`);

    const appInstallWaydroid = await rl.question(
      "Do you want to install the app in waydroid? (y/N) ",
    );
    if (appInstallWaydroid.trim().toLowerCase() === "y") {
      try {
        console.log("Installing...⏳");
        execSync(`waydroid app install "${latestBuildPath}"`, {
          stdio: "inherit",
        });
        console.log("Installed! ✅");
      } catch (error) {
        console.error("Failed to install app in waydroid:", error);
      }
    }

    const appInstallAdb = await rl.question(
      "Do you want to install the app via ADB? (y/N) ",
    );
    if (appInstallAdb.trim().toLowerCase() === "y") {
      try {
        console.log("Installing...⏳");
        execSync(`adb install "${latestBuildPath}"`, {
          stdio: "inherit",
        });
        console.log("Installed! ✅");
      } catch (error) {
        console.error("Failed to install app via ADB:", error);
      }
    }

    const updateType = await rl.question(
      "Enter update type: 0 (Over the air) or 1 (physical download): ",
    );
    const data = {
      version,
      updateType: updateType === "0" ? "over_the_air" : "physical_download",
    };
    const dataStr = JSON.stringify(data);
    const base64Data = Buffer.from(dataStr).toString("base64");
    await clipboard.write(base64Data);
    console.log("");
    console.log(base64Data);
    console.log("");
    console.log("Finished");
  } catch (error) {
    console.error(error);
  } finally {
    rl.close();
  }
};

main();
