# Third-party licences

The exact source of every bundled native library, and how to publish it, is in
`NATIVE_SOURCES.md`.

ShieldVPN is built on open-source software. The components below are the ones
whose licences place obligations on this app's distribution.

---

## ics-openvpn

Copyright © 2012–2023 Arne Schwabe
Portions copyright © 2016 CommonsWare, LLC

Licensed under the **GNU General Public License version 2, with additional
terms** permitting linking against OpenSSL.

ShieldVPN bundles 49 source files from this project under the `de.blinkt.openvpn`
package, together with its prebuilt native libraries, by way of the npm package
`@aliakhgar1/react-native-openvpn`. This is the reason ShieldVPN itself is
distributed under the GPL version 2 — see `LICENSE`.

- Upstream: https://github.com/schwabe/ics-openvpn

> Note: the npm package `@aliakhgar1/react-native-openvpn` declares an MIT
> licence, but the ics-openvpn code and OpenVPN binaries it redistributes are
> GPLv2. The stricter licence governs the combined work.

## OpenVPN 2

Copyright © 2002–2024 OpenVPN Inc.

Licensed under the **GNU General Public License version 2**. Shipped as
`libopenvpn.so`, `libovpnexec.so` and `libovpnutil.so`.

- Upstream: https://github.com/OpenVPN/openvpn

"OpenVPN" is a registered trademark of OpenVPN Inc. ShieldVPN is not affiliated
with, endorsed by, or sponsored by OpenVPN Inc. The name is used only to
describe the protocol the app speaks.

## OpenVPN 3 Core

Copyright © 2012– OpenVPN Inc.

Dual-licensed under the **GNU AGPL version 3** or the **Mozilla Public License
2.0**. ShieldVPN distributes it under **MPL-2.0**, which is compatible with the
GPL version 2 that governs the rest of the app. Shipped as `libovpn3.so`.

- Upstream: https://github.com/OpenVPN/openvpn3

## OpenSSL 3.5

Copyright © The OpenSSL Project Authors. Licensed under the **Apache License
2.0**. Shipped as `libosslutil.so` and compiled into the OpenVPN libraries.

- Upstream: https://www.openssl.org/

## LZ4

Licensed under the **BSD 2-Clause License**. Compiled into the OpenVPN
libraries. Its licence, reproduced verbatim as its terms require:

```
LZ4 Library
Copyright (c) 2011-2020, Yann Collet
All rights reserved.

Redistribution and use in source and binary forms, with or without modification,
are permitted provided that the following conditions are met:

* Redistributions of source code must retain the above copyright notice, this
  list of conditions and the following disclaimer.

* Redistributions in binary form must reproduce the above copyright notice, this
  list of conditions and the following disclaimer in the documentation and/or
  other materials provided with the distribution.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND
ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR
ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
(INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES;
LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON
ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
(INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS
SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
```

- Upstream: https://github.com/lz4/lz4

## LZO

Copyright © Markus F.X.J. Oberhumer. Licensed under the **GNU General Public
License version 2**. Compiled into the OpenVPN libraries.

- Upstream: https://www.oberhumer.com/opensource/lzo/

## React Native

Copyright © Meta Platforms, Inc. and affiliates — **MIT License**
https://github.com/facebook/react-native

## Expo

Copyright © 650 Industries, Inc. — **MIT License**
https://github.com/expo/expo

---

## Server directory data

Server listings are retrieved from the **VPN Gate Academic Experiment Project**
at the Graduate School of University of Tsukuba, Japan, by way of the community
mirror `GeorgeXie2333/vpngate-list-mirror` (mirror tooling: MIT; the directory
data is VPN Gate's).

ShieldVPN is not affiliated with, endorsed by, or operated by the VPN Gate
project or the University of Tsukuba.

- https://www.vpngate.net/
- https://github.com/GeorgeXie2333/vpngate-list-mirror
