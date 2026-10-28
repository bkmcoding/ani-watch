import { describe, expect, it } from 'vitest';
import { isAllowedStreamHost } from '../../src/lib/streamUrls';
import { isAllowedPosterHost } from '../../src/lib/posterUrls';

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

    it('permits legitimate external streaming CDNs', () => {
      expect(isAllowedStreamHost('megaplay.buzz')).toBe(true);
      expect(isAllowedStreamHost('cdn.megaplay.buzz')).toBe(true);
      expect(isAllowedStreamHost('zokoanime.video')).toBe(true);
      expect(isAllowedStreamHost('streaming.zokoanime.video')).toBe(true);
      expect(isAllowedStreamHost('cdn.broforgotsave.online')).toBe(true);
      expect(isAllowedStreamHost('video-cdn.bunnycdn.ru')).toBe(true);
    });
  });

  describe('isAllowedPosterHost', () => {
    it('allows legitimate poster CDNs and subdomains', () => {
      expect(isAllowedPosterHost('anipixcdn.co')).toBe(true);
      expect(isAllowedPosterHost('img.anipixcdn.co')).toBe(true);
      expect(isAllowedPosterHost('cdn1.anipixcdn.co')).toBe(true);
      expect(isAllowedPosterHost('wsrv.nl')).toBe(true);
      expect(isAllowedPosterHost('images.wsrv.nl')).toBe(true);
      expect(isAllowedPosterHost('weserv.nl')).toBe(true);
      expect(isAllowedPosterHost('hianime.lu')).toBe(true);
    });

    it('rejects substring domain spoofing attacks', () => {
      expect(isAllowedPosterHost('attacker-anipixcdn.co')).toBe(false);
      expect(isAllowedPosterHost('anipix.attacker.com')).toBe(false);
      expect(isAllowedPosterHost('noitatnemucod.fake.com')).toBe(false);
      expect(isAllowedPosterHost('evil-wsrv.nl.attacker.com')).toBe(false);
      expect(isAllowedPosterHost('127.0.0.1')).toBe(false);
      expect(isAllowedPosterHost('localhost')).toBe(false);
    });
  });
});
