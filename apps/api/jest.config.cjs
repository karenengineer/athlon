module.exports = {
  moduleFileExtensions: ["js", "json", "ts"],
  rootDir: ".",
  testRegex: ".*\\.spec\\.ts$",
  setupFiles: ["<rootDir>/test/setup-env.ts"],
  transform: { "^.+\\.(t|j)s$": ["ts-jest", { tsconfig: "tsconfig.json" }] },
  collectCoverageFrom: ["src/**/*.(t|j)s"],
  coverageDirectory: "../../coverage/api",
  testEnvironment: "node",
};
