import * as core from '@actions/core';
import { describe, expect, it, vi } from 'vitest';
import { run } from '../../src/index';

describe('subject-action e2e', () => {
  it('mock oci resolves deterministically', async () => {
    vi.spyOn(core, 'getInput').mockImplementation((name: string) => {
      const m: Record<string, string> = {
        subject: 'docker.io/library/alpine:latest',
        'subject-type': 'oci',
        mode: 'mock',
        'allow-insecure-fallback': 'false',
      };
      return m[name] ?? '';
    });
    vi.spyOn(core, 'setOutput').mockImplementation(() => {});

    await expect(run()).resolves.toBeUndefined();
  });
});
