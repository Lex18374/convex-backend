const assert = require("node:assert/strict");
const fs = require("node:fs");
const { createRequire } = require("node:module");
const os = require("node:os");
const path = require("node:path");
const vm = require("node:vm");

const project = path.resolve(__dirname, "../private-demos/quickstarts/expo");
const demoRequire = createRequire(path.join(project, "package.json"));
const expoRequire = createRequire(demoRequire.resolve("expo/package.json"));
const routerRequire = createRequire(
  demoRequire.resolve("expo-router/package.json"),
);
const metro = expoRequire("@expo/metro/metro");
const { getDefaultConfig } = demoRequire("expo/metro-config");

async function main() {
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), "decoder-metro-"));
  try {
    const config = getDefaultConfig(project);
    config.maxWorkers = 1;
    // Focus on the dependency chain, using Expo's built-in Babel preset.
    // The demo's own babel.config.js names an undeclared babel-preset-expo.
    config.transformer.enableBabelRCLookup = false;
    config.watchFolders.push(scratch);
    config.cacheStores = [];
    const router = path.dirname(
      demoRequire.resolve("expo-router/package.json"),
    );
    const entry = path.join(scratch, "entry.js");
    fs.writeFileSync(
      entry,
      [
        `const query = require(${JSON.stringify(routerRequire.resolve("query-string"))});`,
        `const { getStateFromPath } = require(${JSON.stringify(path.join(router, "build/react-navigation/core/getStateFromPath.js"))});`,
        "globalThis.decoderSmoke = { query, getStateFromPath };",
      ].join("\n"),
    );
    const bundle = await metro.runBuild(config, {
      entry,
      out: path.join(scratch, "bundle.js"),
      platform: "ios",
      dev: false,
      minify: false,
    });
    assert.ok(bundle.code.includes("function utf8SequenceLength"));
    assert.ok(!bundle.code.includes("function decodeComponents"));
    const context = vm.createContext({});
    vm.runInContext(bundle.code, context);
    const result = context.decoderSmoke.query.parse("name=Lex+Z&bad=%FE%FF%41");
    assert.equal(result.name, "Lex Z");
    assert.equal(result.bad, "��A");
    const state = context.decoderSmoke.getStateFromPath(
      "chat/42?bad=%FE%FF%41",
      {
        screens: { Chat: "chat/:id" },
      },
    );
    assert.equal(state.routes[0].params.bad, "��A");
    console.log(
      JSON.stringify({
        platform: "ios",
        bytes: bundle.code.length,
        patchedDecoder: true,
        query: true,
        navigation: true,
      }),
    );
  } finally {
    fs.rmSync(scratch, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
