const fs = require("node:fs");
const path = require("node:path");
const { execSync } = require("node:child_process");

const currentDirFiles = fs.readdirSync(path.join(__dirname, ".."));
const buildFiles = currentDirFiles.filter(
  (file) => file.endsWith(".apk") && file.startsWith("build-"),
);
console.log(buildFiles);
const buildFilesData = buildFiles.map((file) => ({
  data: fs.lstatSync(path.join(__dirname, "..", file)),
  name: file,
}));
const latestBuild = buildFilesData.reduce((latest, current) =>
  current.data.mtime > latest.data.mtime ? current : latest,
);
const latestBuildPath = path.join(__dirname, "..", latestBuild.name);
console.log(`latestBuildPath: ${latestBuildPath}`);
console.log("Installing...⏳");
execSync(`waydroid app install "${latestBuildPath}"`, { stdio: "inherit" });
console.log("Installed! ✅");

for (const fileName of buildFiles) {
  if (fileName !== latestBuild.name) {
    console.log(`Removing ${fileName}...`);
    fs.unlinkSync(path.join(__dirname, "..", fileName));
  }
}
console.log("Finished");
