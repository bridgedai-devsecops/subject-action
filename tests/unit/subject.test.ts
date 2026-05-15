import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { describe, expect, it, vi } from 'vitest';
import * as core from '@actions/core';
import { run } from '../../src/index';

describe('subject-action', () => {
  it('resolves file digest', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bdai-sub-'));
    const f = path.join(dir, 'bin.dat');
    fs.writeFileSync(f, 'hello');

    vi.spyOn(core, 'getInput').mockImplementation((name: string) => {
      const m: Record<string, string> = {
        subject: f,
        'subject-type': 'file',
        mode: 'production',
        'allow-insecure-fallback': 'false',
      };
      return m[name] ?? '';
    });
    vi.spyOn(core, 'setOutput').mockImplementation(() => {});

    await run();
    expect(core.setOutput).toHaveBeenCalled();
  });

  it('parses oci embedded digest', async () => {
    vi.spyOn(core, 'getInput').mockImplementation((name: string) => {
      const m: Record<string, string> = {
        subject: 'docker.io/library/alpine@sha256:' + 'a'.repeat(64),
        'subject-type': 'oci',
        mode: 'production',
        'allow-insecure-fallback': 'false',
      };
      return m[name] ?? '';
    });
    vi.spyOn(core, 'setOutput').mockImplementation(() => {});
    await run();
    const calls = (core.setOutput as unknown as { mock: { calls: unknown[][] } }).mock.calls as [string, string][];
    const digest = calls.find((c) => c[0] === 'subject-digest')?.[1] ?? '';
    expect(digest).toContain('sha256:');
  });
});
