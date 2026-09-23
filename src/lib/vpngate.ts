import axios from 'axios';
import { Buffer } from 'buffer';

/**
 * Server directory for ShieldVPN.
 *
 * PRIMARY SOURCE: the community mirror at
 * github.com/GeorgeXie2333/vpngate-list-mirror, preferred over VPNGate's own
 * API for three measured reasons:
 *
 *  1. Reachability. Several ISPs — Etisalat (UAE) among them — reset TLS to
 *     vpngate.net, so the official API is unavailable to many of the users a
 *     VPN app exists for. GitHub Raw and jsDelivr answer normally there.
 *  2. Coverage. One call to the official API returns a rotating sample of ~99
 *     servers across 7-10 countries. The mirror accumulates every rotation:
 *     ~4,950 servers across ~72 countries at the time of writing.
 *  3. Probe data. The mirror records each server's protocol and probe port,
 *     and TCP-probes it from Cloudflare Workers.
 *
 * It is also cheaper on the wire: ~1.09 MB gzipped versus ~1.3 MB for the
 * official CSV, because each OpenVPN profile is a separate ~13 KB file fetched
 * only for servers that are actually dialled.
 *
 * FALLBACK: the official CSV, used when the mirror cannot be reached.
 */

const MIRROR_HOSTS = [
  'https://raw.githubusercontent.com/GeorgeXie2333/vpngate-list-mirror/main',
  'https://cdn.jsdelivr.net/gh/GeorgeXie2333/vpngate-list-mirror@latest',
  'https://fastly.jsdelivr.net/gh/GeorgeXie2333/vpngate-list-mirror@latest',
];
const VPNGATE_CSV_URL = 'https://www.vpngate.net/api/iphone/';

const HOUR_MS = 60 * 60 * 1000;

export type Reachability = 'alive' | 'dead' | 'unknown';

export type Server = {
  host: string;
  ip: string;
  countryCode: string;
  countryName: string;
  /** Transport of the OpenVPN endpoint. Only TCP endpoints can be probed. */
  protocol: 'tcp' | 'udp';
  /** Port of the OpenVPN endpoint, used for the on-device probe. 0 = unknown. */
  port: number;
  /** The mirror's last probe verdict (made from Cloudflare, not this device). */
  mirrorStatus: 'reachable' | 'unreachable' | 'unknown';
  /** Consecutive failed mirror probes. */
  failures: number;
  /** When the mirror last saw this server in VPNGate's feed, epoch ms. 0 = unknown. */
  lastSeenAt: number;
  /** Result of this device's own probe. */
  reachability: Reachability;
  /** Time this device took to reach the server, ms. 0 = not measured. */
  deviceMs: number;
  /** Throughput in bits per second, as reported by VPNGate. */
  speed: number;
  sessions: number;
  /** Present immediately on the CSV path; fetched on demand on the pool path. */
  config: string | null;
  /** Identifies the profile file in the mirror, when config is not yet loaded. */
  configSha: string | null;
  /** 0..1 from rankServers(). Higher is better. */
  quality: number;
};

export type Country = {
  code: string;
  name: string;
  flag: string;
  serverCount: number;
  bestQuality: number;
  bestSpeedMbps: number;
};

export class DirectoryUnreachableError extends Error {
  constructor() {
    super('DIRECTORY_UNREACHABLE');
    this.name = 'DirectoryUnreachableError';
  }
}

/** Turn an ISO 3166-1 alpha-2 code into its flag emoji. */
export function flagFor(countryCode: string): string {
  const cc = countryCode?.toUpperCase();
  if (!cc || !/^[A-Z]{2}$/.test(cc)) return '🏳️';
  return String.fromCodePoint(
    ...[...cc].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65)
  );
}

export function toMbps(bitsPerSecond: number): number {
  return bitsPerSecond / 1_000_000;
}

function toInt(value: unknown): number {
  const n =
    typeof value === 'number' ? value : Number.parseInt(String(value ?? ''), 10);
  return Number.isFinite(n) ? n : 0;
}

/** Read the endpoint a profile will actually dial: its first `remote` line. */
export function parseRemote(
  config: string
): { host: string; port: number; protocol: 'tcp' | 'udp' } | null {
  const remote = config.match(
    /^\s*remote\s+(\S+)\s+(\d+)(?:\s+(tcp|udp)\S*)?/im
  );
  if (!remote) return null;
  // A proto suffix on the remote line overrides a standalone `proto` line.
  const proto =
    remote[3] ?? config.match(/^\s*proto\s+(tcp|udp)/im)?.[1] ?? 'udp';
  return {
    host: remote[1],
    port: Number.parseInt(remote[2], 10),
    protocol: proto.toLowerCase().startsWith('tcp') ? 'tcp' : 'udp',
  };
}

const IPV4 = /^\d{1,3}(\.\d{1,3}){3}$/;

/**
 * Check that a downloaded profile dials the endpoint this device measured.
 *
 * The directory and the profiles come from a third-party mirror. Binding the
 * profile to the probed IP and port means an entry cannot send the tunnel to a
 * different host than the one that was just tested, whether through a mistake
 * upstream or a tampered file. Hostname remotes are allowed through, since
 * they cannot be compared without a DNS lookup.
 */
export function profileMatchesServer(config: string, server: Server): boolean {
  const remote = parseRemote(config);
  if (!remote) return false;
  if (server.port > 0 && remote.port !== server.port) return false;
  if (server.ip && IPV4.test(remote.host) && remote.host !== server.ip) {
    return false;
  }
  return true;
}

/* ------------------------------------------------------------------ mirror */

type PoolEntry = {
  hostname?: string;
  ip?: string;
  country_code?: string;
  country_name?: string;
  speed_bps?: number;
  num_vpn_sessions?: number;
  last_seen_at?: string;
  openvpn_config_sha256?: string;
  probe_reason?: string;
  probe_targets?: { ip?: string; port?: number }[];
  tcp_probe?: { status?: string; consecutive_failures?: number };
};

export function mapPoolEntry(entry: PoolEntry): Server | null {
  const countryCode = (entry.country_code ?? '').toUpperCase();
  if (!/^[A-Z]{2}$/.test(countryCode)) return null;
  if (!entry.openvpn_config_sha256) return null;

  const probe = entry.tcp_probe ?? {};
  const mirrorStatus =
    probe.status === 'reachable' || probe.status === 'unreachable'
      ? probe.status
      : 'unknown';
  const target = entry.probe_targets?.[0];
  const lastSeen = entry.last_seen_at ? Date.parse(entry.last_seen_at) : NaN;

  return {
    host: entry.hostname || entry.ip || 'unknown',
    ip: target?.ip || entry.ip || '',
    countryCode,
    countryName: entry.country_name || countryCode,
    protocol: entry.probe_reason === 'tcp' ? 'tcp' : 'udp',
    port: toInt(target?.port),
    mirrorStatus,
    failures: toInt(probe.consecutive_failures),
    lastSeenAt: Number.isFinite(lastSeen) ? lastSeen : 0,
    reachability: 'unknown',
    deviceMs: 0,
    speed: toInt(entry.speed_bps),
    sessions: toInt(entry.num_vpn_sessions),
    config: null,
    configSha: entry.openvpn_config_sha256,
    quality: 0,
  };
}

async function getJson<T>(
  path: string,
  timeoutMs: number,
  options: { revalidate?: boolean } = {}
): Promise<T> {
  let lastError: unknown = null;
  for (const host of MIRROR_HOSTS) {
    try {
      const response = await axios.get<T>(`${host}/${path}`, {
        timeout: timeoutMs,
        headers: {
          'Accept-Encoding': 'gzip, deflate',
          // jsDelivr serves @latest from a cache that can lag GitHub by days.
          // max-age=0 forces a revalidation (a cheap 304 when unchanged).
          ...(options.revalidate ? { 'Cache-Control': 'max-age=0' } : {}),
        },
      });
      if (response.data && typeof response.data === 'object') {
        return response.data;
      }
      lastError = new Error('NOT_JSON');
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError ?? new DirectoryUnreachableError();
}

async function fetchFromMirror(): Promise<Server[]> {
  const pool = await getJson<{ servers?: PoolEntry[] }>(
    'pool/servers.json',
    40_000,
    // Profiles are content-addressed and immutable; only the index goes stale.
    { revalidate: true }
  );
  const servers: Server[] = [];
  for (const entry of pool?.servers ?? []) {
    const mapped = mapPoolEntry(entry);
    // Endpoints the mirror has confirmed dead are dropped outright rather than
    // ranked low: every one of them would be a wasted dial.
    if (mapped && mapped.mirrorStatus !== 'unreachable') servers.push(mapped);
  }
  return servers;
}

/**
 * Load a server's OpenVPN profile.
 *
 * Profiles are ~13 KB each and live in their own files, so only servers that
 * are actually dialled are downloaded. Mutates and returns the server.
 */
export async function ensureConfig(server: Server): Promise<Server> {
  if (server.config || !server.configSha) return server;
  const file = await getJson<{ openvpn_config_base64?: string }>(
    `pool/configs/${server.configSha}.json`,
    25_000
  );
  const base64 = file?.openvpn_config_base64;
  if (!base64) throw new Error('CONFIG_UNAVAILABLE');
  const config = Buffer.from(base64, 'base64').toString('utf-8');
  if (!/^\s*remote\s+\S+/m.test(config) || !config.includes('BEGIN CERTIFICATE')) {
    throw new Error('CONFIG_INVALID');
  }
  if (!profileMatchesServer(config, server)) {
    throw new Error('CONFIG_MISMATCH');
  }
  server.config = config;
  return server;
}

/* -------------------------------------------------------- official CSV path */

/**
 * Parse VPNGate's CSV. Row 0 is a banner, row 1 the header, and the file ends
 * with a lone '*'. Only columns 0-7 and the LAST column are read positionally.
 */
export function parseVpnGateCsv(csv: string): Server[] {
  const servers: Server[] = [];

  for (const rawLine of csv.split('\n').slice(2)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('*') || line.startsWith('#')) continue;

    const columns = line.split(',');
    if (columns.length < 15) continue;

    const countryCode = (columns[6] ?? '').trim().toUpperCase();
    if (!/^[A-Z]{2}$/.test(countryCode)) continue;

    const base64 = columns[columns.length - 1]?.trim();
    if (!base64 || base64.length < 100) continue;

    let config: string;
    try {
      config = Buffer.from(base64, 'base64').toString('utf-8');
    } catch {
      continue;
    }
    if (!config.includes('BEGIN CERTIFICATE')) continue;
    const remote = parseRemote(config);
    if (!remote) continue;

    servers.push({
      host: (columns[0] ?? 'unknown').trim(),
      ip: (columns[1] ?? '').trim(),
      countryCode,
      countryName: (columns[5] ?? countryCode).trim(),
      protocol: remote.protocol,
      port: remote.port,
      mirrorStatus: 'unknown',
      failures: 0,
      // Present in the live feed right now.
      lastSeenAt: Date.now(),
      reachability: 'unknown',
      deviceMs: 0,
      speed: toInt(columns[4]),
      sessions: toInt(columns[7]),
      config,
      configSha: null,
      quality: 0,
    });
  }

  return servers;
}

async function fetchFromOfficialCsv(): Promise<Server[]> {
  const response = await axios.get<string>(VPNGATE_CSV_URL, {
    timeout: 30_000,
    responseType: 'text',
    transformResponse: [(data) => data],
  });
  return parseVpnGateCsv(String(response.data));
}

/* ----------------------------------------------------------------- ranking */

/**
 * Pre-rank servers on throughput, load, and how recently they were seen alive.
 *
 * Latency is deliberately not part of this score: the only honest latency is
 * the one measured from the user's own device, which orderByDeviceLatency()
 * does at connect time. VPNGate's own Ping column is a globally cached constant
 * and the mirror's probes run from Cloudflare, so neither describes the user.
 *
 * Each metric is min-max normalised against the same batch, so the ranking
 * keeps working if upstream units or typical values drift.
 */
export function rankServers(servers: Server[], now = Date.now()): Server[] {
  if (servers.length === 0) return servers;

  // Throughput spans ~0..2.3 Gbit/s, so compare it on a log scale.
  const logSpeeds = servers.map((s) => Math.log10(1 + Math.max(0, s.speed)));
  let minLogSpeed = Infinity;
  let maxLogSpeed = -Infinity;
  let maxSessions = 1;
  for (let i = 0; i < servers.length; i++) {
    if (logSpeeds[i] < minLogSpeed) minLogSpeed = logSpeeds[i];
    if (logSpeeds[i] > maxLogSpeed) maxLogSpeed = logSpeeds[i];
    if (servers[i].sessions > maxSessions) maxSessions = servers[i].sessions;
  }

  for (let i = 0; i < servers.length; i++) {
    const s = servers[i];
    const speedScore =
      maxLogSpeed > minLogSpeed
        ? (logSpeeds[i] - minLogSpeed) / (maxLogSpeed - minLogSpeed)
        : 0.5;

    // Many concurrent sessions means the uplink is already being shared.
    const congestionScore = 1 - Math.min(s.sessions / maxSessions, 1);

    // Volunteer servers come and go. Full credit if seen in the last day,
    // fading to nothing after a week; unknown age sits in the middle.
    const ageHours = s.lastSeenAt > 0 ? (now - s.lastSeenAt) / HOUR_MS : NaN;
    const freshnessScore = Number.isFinite(ageHours)
      ? Math.max(0, Math.min(1, 1 - (ageHours - 24) / (7 * 24 - 24)))
      : 0.5;

    const mirrorScore =
      s.mirrorStatus === 'reachable'
        ? 1 - Math.min(s.failures / 5, 1)
        : 0.5 - Math.min(s.failures / 10, 0.5);

    s.quality =
      0.35 * speedScore +
      0.2 * congestionScore +
      0.25 * freshnessScore +
      0.2 * mirrorScore;
  }

  return servers.sort((a, b) => b.quality - a.quality);
}

export function buildCountryList(ranked: Server[]): Country[] {
  const byCode = new Map<string, Server[]>();
  for (const s of ranked) {
    const list = byCode.get(s.countryCode);
    if (list) list.push(s);
    else byCode.set(s.countryCode, [s]);
  }

  const countries: Country[] = [];
  for (const [code, list] of byCode) {
    const best = list[0]; // `ranked` is sorted, so this is the country's best.
    countries.push({
      code,
      name: best.countryName || code,
      flag: flagFor(code),
      serverCount: list.length,
      bestQuality: best.quality,
      bestSpeedMbps: toMbps(best.speed),
    });
  }

  return countries.sort((a, b) => b.bestQuality - a.bestQuality);
}

/* ------------------------------------------ on-device latency + liveness */

/**
 * Classify why an HTTPS probe to a VPN Gate port failed, from the message that
 * React Native's networking module passes up from OkHttp.
 *
 * Measured against live VPN Gate servers: their TCP ports run SoftEther, which
 * completes a full TLS handshake with a self-signed certificate (and answers
 * HTTP 403 if the certificate is ignored). Android then rejects that
 * certificate. So a certificate failure is proof the server is up and
 * answering, while a refused, reset or unreachable connection means it is not.
 *
 * Connection-level failures are checked first on purpose: a TLS handshake that
 * the network cut short ("closed by peer", "reset") must count as dead, because
 * a VPN connection would be cut in the same way.
 */
export function classifyProbeFailure(message: string): Reachability {
  const m = (message || '').toLowerCase();
  if (
    /refused|reset|closed by peer|connection closed|unreachable|failed to connect|no route|timed? ?out|timeout|canceled|cancelled|abort|eof|broken pipe|network is down/.test(
      m
    )
  ) {
    return 'dead';
  }
  if (
    /trust anchor|certpath|certificate|x509|chain validation|hostname .* not verified|not verified|peer not authenticated|self.signed/.test(
      m
    )
  ) {
    return 'alive';
  }
  return 'unknown';
}

/**
 * Probe one server from this device: how long it takes to reach it, and
 * whether it is up at all.
 *
 * Uses XMLHttpRequest rather than fetch because React Native only exposes the
 * native failure reason through XHR's responseText. Timing is done with our
 * own timer and abort(): React Native implements xhr.timeout as OkHttp's call
 * timeout, which throws a plain InterruptedIOException rather than the class it
 * flags as a timeout, so its timeout signal cannot be relied on.
 *
 * The measured time covers the TCP connect plus the TLS handshake — roughly
 * two to three network round trips — so it tracks real latency from this
 * device closely enough to order servers by it.
 */
/**
 * A set of probes that can be abandoned as a whole.
 *
 * When the user cancels while servers are being measured, the connect run
 * returns at once. Without this the abandoned probes would keep their requests
 * open — competing with the next run's probes for the HTTP client's connection
 * slots — and later overwrite that run's results on the shared Server objects.
 */
export class ProbeRound {
  cancelled = false;
  private readonly aborters = new Set<() => void>();

  /** Register an in-flight probe's abort; returns an unregister function. */
  track(abort: () => void): () => void {
    this.aborters.add(abort);
    return () => this.aborters.delete(abort);
  }

  cancel(): void {
    if (this.cancelled) return;
    this.cancelled = true;
    const aborters = [...this.aborters];
    this.aborters.clear();
    for (const abort of aborters) abort();
  }
}

export function probeServer(
  server: Server,
  timeoutMs = 2500,
  round?: ProbeRound
): Promise<{ reachability: Reachability; ms: number }> {
  return new Promise((resolve) => {
    if (
      round?.cancelled ||
      server.protocol !== 'tcp' ||
      !server.ip ||
      !server.port
    ) {
      resolve({ reachability: 'unknown', ms: 0 });
      return;
    }

    const xhr = new XMLHttpRequest();
    const started = Date.now();
    let done = false;
    let untrack: () => void = () => {};
    const finish = (reachability: Reachability) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      untrack();
      resolve({
        reachability,
        ms: reachability === 'alive' ? Math.max(1, Date.now() - started) : 0,
      });
    };

    const timer = setTimeout(() => {
      finish('dead'); // Filtered, or so slow it is useless as a VPN.
      try {
        xhr.abort();
      } catch {
        // Already finished.
      }
    }, timeoutMs);

    if (round) {
      untrack = round.track(() => {
        finish('unknown');
        try {
          xhr.abort();
        } catch {
          // Already finished.
        }
      });
    }

    // Any HTTP response at all means something answered on that port.
    xhr.onload = () => finish('alive');
    xhr.onerror = () => finish(classifyProbeFailure(String(xhr.responseText ?? '')));

    try {
      xhr.open('GET', `https://${server.ip}:${server.port}/`);
      xhr.send();
    } catch {
      finish('unknown');
    }
  });
}

const REACHABILITY_RANK: Record<Reachability, number> = {
  alive: 0,
  unknown: 1,
  dead: 2,
};

/**
 * Probe candidates concurrently. Servers this device reached are ordered by how
 * fast it reached them; servers it could not assess keep their pre-ranking; and
 * servers it proved dead go last.
 */
export async function orderByDeviceLatency(
  candidates: Server[],
  timeoutMs = 2500,
  round?: ProbeRound
): Promise<Server[]> {
  const probed = await Promise.all(
    candidates.map(async (server) => {
      const result = await probeServer(server, timeoutMs, round).catch(() => ({
        reachability: 'unknown' as Reachability,
        ms: 0,
      }));
      // An abandoned round must not overwrite what a later round measures.
      if (!round?.cancelled) {
        server.reachability = result.reachability;
        server.deviceMs = result.ms;
      }
      return server;
    })
  );

  return probed.sort((a, b) => {
    const bucket =
      REACHABILITY_RANK[a.reachability] - REACHABILITY_RANK[b.reachability];
    if (bucket !== 0) return bucket;
    if (a.reachability === 'alive') return a.deviceMs - b.deviceMs;
    return b.quality - a.quality;
  });
}

/* --------------------------------------------------------------- directory */

export type DirectorySource = 'mirror' | 'official';

export type Directory = {
  servers: Server[];
  countries: Country[];
  source: DirectorySource;
};

/**
 * Build the directory, preferring the mirror and falling back to the official
 * API. They fail on different networks, so both are tried before giving up.
 */
export async function fetchDirectory(): Promise<Directory> {
  let servers: Server[] = [];
  let source: DirectorySource = 'mirror';

  try {
    servers = await fetchFromMirror();
  } catch {
    servers = [];
  }

  if (servers.length === 0) {
    try {
      servers = await fetchFromOfficialCsv();
      source = 'official';
    } catch {
      servers = [];
    }
  }

  // An empty result is a failure, never a fresh-but-empty directory: caching
  // that would suppress retries for the whole TTL and report the wrong reason.
  if (servers.length === 0) throw new DirectoryUnreachableError();

  const ranked = rankServers(servers);
  return { servers: ranked, countries: buildCountryList(ranked), source };
}

/**
 * Pick the servers worth probing.
 *
 * For one country: its best few by pre-rank. For Automatic: the best couple
 * from each of many countries, because the fastest server for this user is
 * usually a nearby one, and only an on-device probe can tell which that is.
 * Only TCP servers are included where possible, since only they can be probed.
 */
/** Automatic mode probes this many countries, AUTO_PER_COUNTRY servers each. */
export const AUTO_COUNTRIES = 24;
export const AUTO_PER_COUNTRY = 2;

export function pickProbePool(
  directory: Directory,
  countryCode: string | null,
  options: { perCountry?: number; countries?: number; single?: number } = {}
): Server[] {
  const {
    perCountry = AUTO_PER_COUNTRY,
    countries = AUTO_COUNTRIES,
    single = 12,
  } = options;
  const tcpFirst = (list: Server[]) => [
    ...list.filter((s) => s.protocol === 'tcp'),
    ...list.filter((s) => s.protocol !== 'tcp'),
  ];

  if (countryCode) {
    return tcpFirst(
      directory.servers.filter((s) => s.countryCode === countryCode)
    ).slice(0, single);
  }

  const pool: Server[] = [];
  for (const country of directory.countries.slice(0, countries)) {
    const inCountry = directory.servers.filter(
      (s) => s.countryCode === country.code
    );
    pool.push(...tcpFirst(inCountry).slice(0, perCountry));
  }
  return pool;
}
