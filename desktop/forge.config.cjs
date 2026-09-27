module.exports = {
  packagerConfig: {
    asar: true,
    appBundleId: "tech.yliu.jobsearchagent",
    executableName: "JobSearchAgent",
  },
  makers: [{ name: "@electron-forge/maker-zip", platforms: ["darwin"] }],
};
