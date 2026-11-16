# decode-uri-component CommonJS backport

`decode-uri-component@0.2.2.patch` backports the linear decoder from upstream
[`0.5.1`](https://github.com/SamVerschueren/decode-uri-component/tree/v0.5.1).
It retains strict mode, callable `module.exports`, and the legacy `+` → space
preprocessing. Everything else in `index.js` matches the published 0.5.1 source.
The upstream MIT notice is in `decode-uri-component-LICENSE`; the installed
package's own license is unchanged.

```text
Expo demo / Expo quickstart
           ↓
query-string 7.1.3 (CommonJS)
           ↓
decode-uri-component 0.2.2 + pnpm patch
           ↓
0.5.1 linear decoder, CommonJS export, legacy plus handling
```

A direct override to 0.5.1 is incompatible: the CommonJS caller receives an ESM
namespace instead of a callable decoder. The patch avoids a navigation upgrade
and introduces no runtime dependency.

## Reproduce

From `npm-packages/`, use the pinned pnpm 11.15.1 and Node 24:

```sh
pnpm --version
pnpm install --lockfile-only --frozen-lockfile --ignore-scripts
uv run patches/verify-decoder-lock.py a861c7e
pnpm --filter react-native-demo --filter quickstart-expo install --frozen-lockfile --ignore-scripts
node --test --test-concurrency=1 patches/decode-uri-component.test.cjs
node patches/metro-decoder-smoke.cjs
```

The lock verifier checks every declared workspace directory and importer against
the unpatched base. It removes only the native patch annotation before comparing
the complete lock. Supply the corresponding unpatched base after rebasing. Run
the Metro command in the host's test slot where required.

Verified on 12 November 2026, from base `a861c7e`:

- All 151 importers exist, match the workspace declaration and retain their
  original dependency resolutions. No unrelated lock changes remain.
- pnpm 11.15.1 generated the patch hash and references. Its initial regeneration
  also refreshed an unrelated `latest` tag and deprecation metadata; those
  refreshes were removed. A full frozen-lock check then passed without changing
  the file. Both Expo importers were installed with the final frozen lock.
- Patch SHA-256:
  `f11ed09410308d105098976c653d433291e2a9fa690b9de57fe646ed234d9d0e`.
- Five tests cover the installed CommonJS caller, plus handling, Unicode,
  malformed bytes, repeated query keys, both importer chains, the installed
  navigation helpers and the advisory's 224,003-byte input.
- 100 malformed-input combinations match upstream 0.5.1 after plus
  preprocessing. 13 differ from legacy 0.2.2, for example `%FE%FF%41`: `��%41` →
  `��A`. These are intentional upstream semantics, requiring review before
  merge.
- The installed query-string parsed advisory-shaped inputs of 7,003 / 28,003 /
  112,003 / 224,003 bytes in approximately 5 / 10 / 38 / 62 ms. These
  measurements are evidence from this host, not a service latency guarantee.
- The focused iOS Metro bundle executes query-string and navigation decoding. It
  uses Expo's built-in preset with Babel config lookup disabled: the demo's
  existing config refers to an undeclared `babel-preset-expo`. This does not
  prove a full app export, Hermes execution, device navigation, deployment or
  usage.

## Scanner and release boundary

Version metadata remains **0.2.2**. An OSV version query on 12 November still
reports `GHSA-qr28-fpjm-wq7f` and `GHSA-vcc3-ghjq-m6fr`. The patch contains the
upstream fixes; a version-only scan cannot establish that it was applied.
Neither advisory is dismissed or suppressed by this PR.

Independent review and explicit acceptance of the remaining version finding are
still required before merge. Any acceptance must be limited to this exact patch
digest, lock and validated dependency paths; it must not cover unpatched 0.2.2
installations. Production reachability, deployed SHA and mobile usage are
unproven. This change does not update the live backend binary or data.

Sources:
[quadratic replacement advisory](https://github.com/advisories/GHSA-qr28-fpjm-wq7f),
[earlier decoder advisory](https://github.com/advisories/GHSA-vcc3-ghjq-m6fr),
[pnpm native patch documentation](https://pnpm.io/cli/patch).
