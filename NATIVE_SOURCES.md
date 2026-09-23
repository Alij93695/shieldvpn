# Source for the bundled native libraries

ShieldVPN ships prebuilt native libraries inside the npm package
`@aliakhgar1/react-native-openvpn@1.0.0`
(`android/src/main/libs/<abi>/*.so`). That package contains **no source** for
them. Because they are GPLv2 (OpenVPN 2, ics-openvpn, LZO) and MPL-2.0
(OpenVPN 3 Core), their complete corresponding source must be available to
everyone who receives the app, alongside ShieldVPN's own source.

## Provenance

`libopenvpn.so` embeds the version string `git:icsopenvpn/v0.7.60-0-gc5888a12`.
That is OpenVPN 2 built from commit `c5888a12…`, which is exactly the `openvpn`
submodule pinned by **ics-openvpn v0.7.60** — so the libraries were built from
that release.

| | Repository | Commit |
| --- | --- | --- |
| ics-openvpn (tag `v0.7.60`) | https://github.com/schwabe/ics-openvpn | `4388b6cdad674b120c26f5875d98b401a3c6eb6a` |
| OpenVPN 2 | https://github.com/schwabe/openvpn | `c5888a12571b4bf3a52bd1cc135d964a4f758c9e` |
| OpenVPN 3 Core | https://github.com/schwabe/openvpn3 | `e43f5fb468633faea6d3e87cebe384118a8aa652` |
| OpenSSL | https://github.com/schwabe/platform_external_openssl | `82deb9829ded031c9bff7be3100f010a34abf03f` |
| LZ4 | https://github.com/lz4/lz4 | `5ff839680134437dbf4678f3d0c7b371d84f4964` |
| asio | https://github.com/chriskohlhoff/asio | `03ae834edbace31a96157b89bf50e5ee464e5ef9` |
| mbed TLS | https://github.com/ARMmbed/mbedtls | `b1c8e41ae3b36a9a88e0cbee10ed38a577b54726` |
| LZO | in-tree in ics-openvpn at `main/src/main/cpp/lzo` | (part of the ics-openvpn commit) |

The build scripts are part of that tree (`main/src/main/cpp/CMakeLists.txt`
and the `*.cmake` files beside it).

## Which library comes from where

| Shipped file | Built from |
| --- | --- |
| `libopenvpn.so`, `libovpnexec.so` | OpenVPN 2 (+ OpenSSL, LZO, LZ4) — GPLv2 |
| `libovpn3.so` | OpenVPN 3 Core (+ OpenSSL, LZ4, LZO, asio) — MPL-2.0 |
| `libovpnutil.so` | ics-openvpn JNI helpers — GPLv2 |
| `libosslutil.so`, `libosslspeedtest.so` | ics-openvpn helpers over OpenSSL 3.5 — GPLv2 / Apache-2.0 |

## Publishing it

Before releasing a build, archive this exact source and publish it next to
ShieldVPN's source — for example as an asset on the GitHub release for that
version:

```bash
bash scripts/package-native-sources.sh
```

That produces `native-sources/ics-openvpn-v0.7.60-with-submodules.tar.gz`
(several hundred MB; the folder is gitignored). Attach it to the release. The
written offer in `LICENSE` and in the app also covers this source, so keep the
archive for at least three years.

## Caveat

The embedded version string and the submodule commit match exactly, which is
strong evidence of provenance. It is not proof that the npm package's author
built the libraries without modification. The only way to be certain is to
rebuild them from this tree and ship your own build.
