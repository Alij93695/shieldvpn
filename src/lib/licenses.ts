/**
 * Attribution shown in the app's Licences screen.
 *
 * The GPL requires that recipients be told the work is GPL-licensed, that they
 * are offered the source, and that copyright notices are preserved. A text file
 * in the repository does not reach someone who installed from Play, so the same
 * information ships in the app and is reachable during normal use.
 *
 * Keep in sync with THIRD_PARTY_LICENSES.md and LICENSE.
 */

/** Public location of ShieldVPN's own source, as required by the GPL. */
export const SOURCE_URL = 'https://github.com/alij93695/shieldvpn';

/** Where the GPL section 3(b) written offer can be taken up. */
export const SOURCE_REQUEST_EMAIL = 'alij93695@gmail.com';

export const APP_LICENSE = {
  title: 'ShieldVPN',
  body:
    'Copyright © 2026 Ali Jafar\n\n' +
    'ShieldVPN is free software, licensed under the GNU General Public License ' +
    'version 2, with an additional permission to link against OpenSSL.\n\n' +
    'It is distributed in the hope that it will be useful, but WITHOUT ANY ' +
    'WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS ' +
    'FOR A PARTICULAR PURPOSE.\n\n' +
    'The complete corresponding source code — for this app and for its bundled ' +
    'native libraries (ics-openvpn v0.7.60 with OpenVPN 2, OpenVPN 3 Core, ' +
    'OpenSSL, LZO and LZ4) — is available at:\n' +
    SOURCE_URL +
    '\n\nWritten offer: for at least three years from the date you received this ' +
    'app, any third party may obtain a complete machine-readable copy of the ' +
    'corresponding source code, for no more than the cost of physically ' +
    'performing the distribution, by emailing ' +
    SOURCE_REQUEST_EMAIL +
    '.',
};

export type LicenseEntry = {
  name: string;
  copyright: string;
  license: string;
  note?: string;
  url: string;
};

export const THIRD_PARTY_LICENSES: LicenseEntry[] = [
  {
    name: 'ics-openvpn',
    copyright: '© 2012–2023 Arne Schwabe; portions © 2016 CommonsWare, LLC',
    license: 'GNU GPL v2, with additional terms permitting OpenSSL linking',
    note: 'Provides the VPN tunnel. ShieldVPN is GPL-licensed because it includes this code.',
    url: 'https://github.com/schwabe/ics-openvpn',
  },
  {
    name: 'OpenVPN 2',
    copyright: '© 2002–2024 OpenVPN Inc.',
    license: 'GNU GPL v2',
    note: 'Shipped as libopenvpn.so, libovpnexec.so and libovpnutil.so. "OpenVPN" is a registered trademark of OpenVPN Inc.; ShieldVPN is not affiliated with or endorsed by them.',
    url: 'https://github.com/OpenVPN/openvpn',
  },
  {
    name: 'OpenVPN 3 Core',
    copyright: '© 2012– OpenVPN Inc.',
    license: 'Mozilla Public License 2.0 (dual-licensed MPL-2.0 or AGPL-3.0; distributed here under MPL-2.0)',
    note: 'Shipped as libovpn3.so.',
    url: 'https://github.com/OpenVPN/openvpn3',
  },
  {
    name: 'OpenSSL 3.5',
    copyright: '© The OpenSSL Project Authors',
    license: 'Apache License 2.0',
    note: 'Shipped as libosslutil.so and compiled into the OpenVPN libraries.',
    url: 'https://www.openssl.org/',
  },
  {
    name: 'LZ4',
    copyright: 'Copyright (c) 2011-2020, Yann Collet. All rights reserved.',
    license: 'BSD 2-Clause License',
    note: 'Compiled into the OpenVPN libraries. Its full licence and notice are reproduced below.',
    url: 'https://github.com/lz4/lz4',
  },
  {
    name: 'LZO',
    copyright: '© Markus F.X.J. Oberhumer',
    license: 'GNU GPL v2',
    note: 'Compiled into the OpenVPN libraries.',
    url: 'https://www.oberhumer.com/opensource/lzo/',
  },
  {
    name: 'React Native',
    copyright: '© Meta Platforms, Inc. and affiliates',
    license: 'MIT License',
    url: 'https://github.com/facebook/react-native',
  },
  {
    name: 'Expo',
    copyright: '© 650 Industries, Inc.',
    license: 'MIT License',
    url: 'https://github.com/expo/expo',
  },
  {
    name: 'VPN Gate directory data',
    copyright: '© VPN Gate Academic Experiment Project, University of Tsukuba',
    license: 'Server listings, retrieved via a community mirror (mirror tooling: MIT)',
    note: 'ShieldVPN is not affiliated with, endorsed by, or operated by the VPN Gate project.',
    url: 'https://www.vpngate.net/',
  },
];
