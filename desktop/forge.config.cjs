module.exports = {
  packagerConfig: {
    asar: true,
    appBundleId: "tech.yliu.jobsearchagent",
    executableName: "JobSearchAgent",
    icon: "./assets/job-search-agent.icns",
  },
  makers: [
    { name: "@electron-forge/maker-zip", platforms: ["darwin"] },
    { name: "@electron-forge/maker-dmg", platforms: ["darwin"], config: { title: "Job Search Agent", format: "UDZO" } },
  ],
};
