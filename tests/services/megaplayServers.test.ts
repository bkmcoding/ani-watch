import { describe, expect, it } from 'vitest';
import { pickServer, ThemeServer } from '../../src/services/megaplay';

describe('MegaPlay Server Resolution & HD-1/HD-2 Decoupling', () => {
  const standardServers: ThemeServer[] = [
    {
      type: 'sub',
      serverName: 'HD-1',
      serverId: 1,
      embedUrl: 'https://megacloud.blog/embed-2/e-1?k=1',
    },
    {
      type: 'sub',
      serverName: 'HD-2',
      serverId: 2,
      embedUrl: 'https://rapid-cloud.co/embed-2/e-1?k=1',
    },
    {
      type: 'dub',
      serverName: 'HD-1',
      serverId: 3,
      embedUrl: 'https://megacloud.blog/embed-2/e-1?k=1',
    },
    {
      type: 'dub',
      serverName: 'HD-2',
      serverId: 4,
      embedUrl: 'https://rapid-cloud.co/embed-2/e-1?k=1',
    },
  ];

  it('strictly decouples HD-1 and HD-2 when both servers are present', () => {
    const pickedHd1 = pickServer(standardServers, 'hd-1', 'sub');
    const pickedHd2 = pickServer(standardServers, 'hd-2', 'sub');

    expect(pickedHd1).not.toBeNull();
    expect(pickedHd1?.serverName).toBe('HD-1');
    expect(pickedHd1?.serverId).toBe(1);

    expect(pickedHd2).not.toBeNull();
    expect(pickedHd2?.serverName).toBe('HD-2');
    expect(pickedHd2?.serverId).toBe(2);
  });

  it('handles casing and space/hyphen formatting variations for HD-1 and HD-2', () => {
    const hd1Variations = ['hd-1', 'HD-1', 'hd 1', 'HD 1', 'hd1', 'HD1'];
    for (const v of hd1Variations) {
      const res = pickServer(standardServers, v, 'sub');
      expect(res?.serverName, `Failed for HD-1 variant "${v}"`).toBe('HD-1');
      expect(res?.serverId).toBe(1);
    }

    const hd2Variations = ['hd-2', 'HD-2', 'hd 2', 'HD 2', 'hd2', 'HD2'];
    for (const v of hd2Variations) {
      const res = pickServer(standardServers, v, 'sub');
      expect(res?.serverName, `Failed for HD-2 variant "${v}"`).toBe('HD-2');
      expect(res?.serverId).toBe(2);
    }
  });

  it('resolves HD-1 and HD-2 by provider aliases (MegaCloud/VidStreaming vs RapidCloud/VidCloud)', () => {
    const namedServers: ThemeServer[] = [
      {
        type: 'sub',
        serverName: 'MegaCloud',
        serverId: 10,
        embedUrl: 'https://megacloud.blog/embed-2/e-1',
      },
      {
        type: 'sub',
        serverName: 'RapidCloud',
        serverId: 20,
        embedUrl: 'https://rapid-cloud.co/embed-2/e-1',
      },
    ];

    expect(pickServer(namedServers, 'hd-1', 'sub')?.serverId).toBe(10);
    expect(pickServer(namedServers, 'hd-2', 'sub')?.serverId).toBe(20);
    expect(pickServer(namedServers, 'megacloud', 'sub')?.serverId).toBe(10);
    expect(pickServer(namedServers, 'rapidcloud', 'sub')?.serverId).toBe(20);
    expect(pickServer(namedServers, 'vidstreaming', 'sub')?.serverId).toBe(10);
    expect(pickServer(namedServers, 'vidcloud', 'sub')?.serverId).toBe(20);
  });

  it('resolves servers by embed URL when serverName is generic', () => {
    const genericServers: ThemeServer[] = [
      {
        type: 'sub',
        serverName: 'Server 1',
        serverId: 101,
        embedUrl: 'https://megacloud.blog/embed-2/e-1',
      },
      {
        type: 'sub',
        serverName: 'Server 2',
        serverId: 102,
        embedUrl: 'https://rapid-cloud.co/embed-2/e-1',
      },
    ];

    expect(pickServer(genericServers, 'hd-1', 'sub')?.serverId).toBe(101);
    expect(pickServer(genericServers, 'hd-2', 'sub')?.serverId).toBe(102);
  });

  it('falls back to HD-1 when a non-existent server is requested', () => {
    const res = pickServer(standardServers, 'non-existent-server', 'sub');
    expect(res).not.toBeNull();
    expect(res?.serverName).toBe('HD-1');
    expect(res?.serverId).toBe(1);
  });

  it('falls back gracefully to any available server when requested server is missing', () => {
    const onlyHd1: ThemeServer[] = [
      {
        type: 'sub',
        serverName: 'HD-1',
        serverId: 1,
        embedUrl: 'https://megacloud.blog/embed-2/e-1',
      },
    ];
    // Requesting HD-2 when only HD-1 exists
    const fallbackToHd1 = pickServer(onlyHd1, 'hd-2', 'sub');
    expect(fallbackToHd1?.serverName).toBe('HD-1');

    const onlyHd2: ThemeServer[] = [
      {
        type: 'sub',
        serverName: 'HD-2',
        serverId: 2,
        embedUrl: 'https://rapid-cloud.co/embed-2/e-1',
      },
    ];
    // Requesting HD-1 when only HD-2 exists
    const fallbackToHd2 = pickServer(onlyHd2, 'hd-1', 'sub');
    expect(fallbackToHd2?.serverName).toBe('HD-2');
  });

  it('respects category filtering between sub and dub', () => {
    const subHd1 = pickServer(standardServers, 'hd-1', 'sub');
    const dubHd1 = pickServer(standardServers, 'hd-1', 'dub');

    expect(subHd1?.type).toBe('sub');
    expect(subHd1?.serverId).toBe(1);

    expect(dubHd1?.type).toBe('dub');
    expect(dubHd1?.serverId).toBe(3);

    const missingCategory = pickServer(standardServers, 'hd-1', 'raw');
    expect(missingCategory).toBeNull();
  });
});
