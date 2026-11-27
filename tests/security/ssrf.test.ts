import { describe, expect, it } from 'vitest';
import { isAllowedCdnHost, isAllowedStreamHost } from '../../src/lib/mediaProxyCore';

describe('SSRF Protection & Host Validation', () => {
  describe('isAllowedStreamHost', () => {
    it('blocks IPv4 loopback addresses', () => {
      expect(isAllowedStreamHost('127.0.0.1')).toBe(false);
      expect(isAllowedStreamHost('127.0.0.2')).toBe(false);
      expect(isAllowedStreamHost('127.255.255.255')).toBe(false);
    });

    it('blocks RFC 1918 private IPv4 networks', () => {
      expect(isAllowedStreamHost('10.0.0.1')).toBe(false);
      expect(isAllowedStreamHost('10.255.255.255')).toBe(false);
      expect(isAllowedStreamHost('172.16.0.1')).toBe(false);
      expect(isAllowedStreamHost('172.20.10.5')).toBe(false);
      expect(isAllowedStreamHost('172.31.255.255')).toBe(false);
      expect(isAllowedStreamHost('192.168.0.1')).toBe(false);
      expect(isAllowedStreamHost('192.168.1.100')).toBe(false);
    });

    it('blocks link-local and cloud metadata endpoints', () => {
      expect(isAllowedStreamHost('169.254.169.254')).toBe(false);
      expect(isAllowedStreamHost('169.254.170.2')).toBe(false);
      expect(isAllowedStreamHost('100.100.100.200')).toBe(false);
      expect(isAllowedStreamHost('metadata.google.internal')).toBe(false);
      expect(isAllowedStreamHost('instance-data')).toBe(false);
    });

    it('blocks carrier-grade NAT (100.64.0.0/10)', () => {
      expect(isAllowedStreamHost('100.64.0.1')).toBe(false);
      expect(isAllowedStreamHost('100.127.255.255')).toBe(false);
    });

    it('blocks integer, hex, and octal IP obfuscations', () => {
      expect(isAllowedStreamHost('2130706433')).toBe(false);
      expect(isAllowedStreamHost('0x7f000001')).toBe(false);
      expect(isAllowedStreamHost('0177.0.0.1')).toBe(false);
      expect(isAllowedStreamHost('0177.0000.0000.0001')).toBe(false);
    });

    it('blocks single-label internal hostnames', () => {
      expect(isAllowedStreamHost('localhost')).toBe(false);
      expect(isAllowedStreamHost('redis')).toBe(false);
      expect(isAllowedStreamHost('database')).toBe(false);
      expect(isAllowedStreamHost('internal-service')).toBe(false);
    });

    it('blocks internal TLDs and known DNS-rebinding services', () => {
      expect(isAllowedStreamHost('app.local')).toBe(false);
      expect(isAllowedStreamHost('backend.internal')).toBe(false);
      expect(isAllowedStreamHost('hidden.onion')).toBe(false);
      expect(isAllowedStreamHost('127.0.0.1.nip.io')).toBe(false);
      expect(isAllowedStreamHost('spoof.sslip.io')).toBe(false);
      expect(isAllowedStreamHost('app.localtest.me')).toBe(false);
    });

    it('blocks IPv6 loopback, unspecified, and private ranges', () => {
      expect(isAllowedStreamHost('::1')).toBe(false);
      expect(isAllowedStreamHost('[::1]')).toBe(false);
      expect(isAllowedStreamHost('::')).toBe(false);
      expect(isAllowedStreamHost('[fe80::1]')).toBe(false);
      expect(isAllowedStreamHost('[fc00::1]')).toBe(false);
      expect(isAllowedStreamHost('::ffff:127.0.0.1')).toBe(false);
      expect(isAllowedStreamHost('[::ffff:127.0.0.1]')).toBe(false);
      expect(isAllowedStreamHost('::ffff:169.254.169.254')).toBe(false);
      expect(isAllowedStreamHost('::ffff:10.0.0.1')).toBe(false);
    });

    it('blocks IPv4-mapped IPv6 hosts written as hex hextets', () => {
      // new URL() normalises these: ::ffff:127.0.0.1 becomes ::ffff:7f00:1
      expect(isAllowedStreamHost('::ffff:7f00:1')).toBe(false);
      expect(isAllowedStreamHost('[::ffff:7f00:1]')).toBe(false);
      expect(isAllowedStreamHost('[::ffff:a9fe:a9fe]')).toBe(false);
      expect(isAllowedStreamHost('::ffff:a9fe:a9fe')).toBe(false);
      expect(isAllowedStreamHost('[::ffff:c0a8:101]')).toBe(false); // 192.168.1.1
      expect(isAllowedStreamHost('[::ffff:a00:1]')).toBe(false); // 10.0.0.1
      expect(isAllowedStreamHost('[::ffff:6440:1]')).toBe(false); // 100.64.0.1 CGNAT
      expect(isAllowedStreamHost('0:0:0:0:0:ffff:169.254.169.254')).toBe(false);
    });

    it('blocks IPv4-compatible, NAT64 and 6to4 tunnelled private addresses', () => {
      expect(isAllowedStreamHost('[::7f00:1]')).toBe(false); // ::127.0.0.1
      expect(isAllowedStreamHost('[64:ff9b::a9fe:a9fe]')).toBe(false); // NAT64 → 169.254.169.254
      expect(isAllowedStreamHost('[2002:a9fe:a9fe::1]')).toBe(false); // 6to4 → 169.254.169.254
    });

    it('rejects malformed IPv6 literals instead of allowing them', () => {
      expect(isAllowedStreamHost('::1:2:3:4:5:6:7:8')).toBe(false);
      expect(isAllowedStreamHost('1:2:3:4:5:6:7:8:9')).toBe(false);
      expect(isAllowedStreamHost('::ffff:999.0.0.1')).toBe(false);
    });

    it('still permits public IPv4-mapped IPv6 hosts', () => {
      expect(isAllowedStreamHost('::ffff:8.8.8.8')).toBe(true);
      expect(isAllowedStreamHost('[::ffff:808:808]')).toBe(true);
    });

    it('permits legitimate external streaming CDNs', () => {
      expect(isAllowedStreamHost('megaplay.buzz')).toBe(true);
      expect(isAllowedStreamHost('cdn.megaplay.buzz')).toBe(true);
      expect(isAllowedStreamHost('zokoanime.video')).toBe(true);
      expect(isAllowedStreamHost('streaming.zokoanime.video')).toBe(true);
      expect(isAllowedStreamHost('cdn.broforgotsave.online')).toBe(true);
      expect(isAllowedStreamHost('video-cdn.bunnycdn.ru')).toBe(true);
    });
  });

  describe('isAllowedCdnHost', () => {
    it('allows legitimate poster CDNs and subdomains', () => {
      expect(isAllowedCdnHost('anipixcdn.co')).toBe(true);
      expect(isAllowedCdnHost('img.anipixcdn.co')).toBe(true);
      expect(isAllowedCdnHost('cdn1.anipixcdn.co')).toBe(true);
      expect(isAllowedCdnHost('wsrv.nl')).toBe(true);
      expect(isAllowedCdnHost('images.wsrv.nl')).toBe(true);
      expect(isAllowedCdnHost('weserv.nl')).toBe(true);
      expect(isAllowedCdnHost('hianime.lu')).toBe(true);
    });

    it('rejects substring domain spoofing attacks', () => {
      expect(isAllowedCdnHost('attacker-anipixcdn.co')).toBe(false);
      expect(isAllowedCdnHost('anipix.attacker.com')).toBe(false);
      expect(isAllowedCdnHost('noitatnemucod.fake.com')).toBe(false);
      expect(isAllowedCdnHost('evil-wsrv.nl.attacker.com')).toBe(false);
      expect(isAllowedCdnHost('127.0.0.1')).toBe(false);
      expect(isAllowedCdnHost('localhost')).toBe(false);
    });
  });
});
