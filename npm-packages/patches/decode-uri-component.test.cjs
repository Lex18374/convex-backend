const assert = require("node:assert/strict");
const { createRequire } = require("node:module");
const path = require("node:path");
const { test } = require("node:test");

// Exercise pnpm's installed dependency graph, including the CommonJS caller.
const workspace = path.resolve(__dirname, "..");
const demoRequire = createRequire(
  path.join(workspace, "private-demos/quickstarts/expo/package.json"),
);
const routerRequire = createRequire(
  demoRequire.resolve("expo-router/package.json"),
);
const queryRequire = createRequire(routerRequire.resolve("query-string"));
const decode = queryRequire("decode-uri-component");
const queryString = routerRequire("query-string");

test("the installed decoder remains callable CommonJS and preserves plus handling", () => {
  assert.equal(typeof decode, "function");
  for (const [input, expected] of [
    ["", ""],
    ["hello+world", "hello world"],
    ["%2B+%20", "+  "],
    ["%C3%A5", "å"],
    ["%F0%9F%98%80", "😀"],
    ["%2525", "%25"],
    ["%", "%"],
    ["%zz", "%zz"],
    ["%C2", "�"],
    ["%FE%FF%41", "��A"],
    ["%41%FF%FE", "A��"],
    ["%C0%AF", "%C0%AF"],
    ["%ED%A0%80", "%ED%A0%80"],
    ["%F4%90%80%80", "%F4%90%80%80"],
  ]) {
    assert.equal(decode(input), expected, input);
  }
  for (const input of [null, undefined, 42, {}, []]) {
    assert.throws(() => decode(input), TypeError);
  }
});

test("query-string parses deep-link values, repeated keys and malformed bytes", () => {
  assert.deepEqual(
    {
      ...queryString.parse(
        "name=Lex+Z&plus=%2B&tag=a&tag=b&empty=&flag&bad=%FE%FF%41",
      ),
    },
    {
      name: "Lex Z",
      plus: "+",
      tag: ["a", "b"],
      empty: "",
      flag: null,
      bad: "��A",
    },
  );
  const params = { name: "Lex Z", unicode: "å😀", plus: "+", path: "a/b" };
  assert.deepEqual(
    { ...queryString.parse(queryString.stringify(params)) },
    params,
  );
});

test("both Expo importers resolve query-string to the same patched decoder", () => {
  const nativeRequire = createRequire(
    path.join(workspace, "demos/react-native/package.json"),
  );
  const expoRequire = createRequire(nativeRequire.resolve("expo/package.json"));
  const cliRequire = createRequire(
    expoRequire.resolve("@expo/cli/package.json"),
  );
  const nativeQueryRequire = createRequire(cliRequire.resolve("query-string"));
  assert.equal(
    nativeQueryRequire.resolve("decode-uri-component"),
    queryRequire.resolve("decode-uri-component"),
  );
  assert.match(queryRequire.resolve("decode-uri-component"), /patch_hash=/);
});

test("Expo's installed navigation helpers parse and serialize a deep link", () => {
  const routerRoot = path.dirname(
    demoRequire.resolve("expo-router/package.json"),
  );
  const { getStateFromPath } = require(
    path.join(routerRoot, "build/react-navigation/core/getStateFromPath.js"),
  );
  const { getPathFromState } = require(
    path.join(routerRoot, "build/react-navigation/core/getPathFromState.js"),
  );
  const options = { screens: { Chat: "chat/:id" } };
  const state = getStateFromPath(
    "chat/42?name=Lex+Z&symbol=%2B&bad=%FE%FF%41",
    options,
  );
  assert.deepEqual(state.routes[0].params, {
    id: "42",
    name: "Lex Z",
    symbol: "+",
    bad: "��A",
  });
  const roundTrip = getStateFromPath(getPathFromState(state, options), options);
  assert.deepEqual(roundTrip.routes[0].params, state.routes[0].params);
});

test(
  "the advisory's large malformed input completes within a bounded deadline",
  { timeout: 5000 },
  () => {
    let input = "";
    for (let i = 0; i < 32000; i++) {
      input += `%${Math.floor(i / 256)
        .toString(16)
        .padStart(2, "0")}%${(i % 256).toString(16).padStart(2, "0")}x`;
    }
    input += "%zz";
    const started = performance.now();
    const result = decode(input);
    assert.ok(performance.now() - started < 5000);
    assert.ok(result.endsWith("%zz"));
    assert.equal(typeof queryString.parse(`value=${input}`).value, "string");
  },
);
