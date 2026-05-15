import { createHash } from 'crypto';
import * as cp from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as core from '@actions/core';
import { fail, getOptionalInput, getRequiredInput } from './lib/action-core';
import { getBooleanInput } from './lib/inputs';
import { setOutputs } from './lib/outputs';
import { appendJobSummary } from './lib/summary';
import { ConfigurationError } from './lib/errors';
import { parseEnum } from './lib/validation';

const SHA256_IN_REF = /@sha256:([a-f0-9]{64})/i;

function sha256File(filePath: string): string {
  const buf = fs.readFileSync(filePath);
  return createHash('sha256').update(buf).digest('hex');
}

async function execFileStdout(cmd: string, args: readonly string[]): Promise<string> {
  return await new Promise((resolve, reject) => {
    cp.execFile(cmd, [...args], { maxBuffer: 10 * 1024 * 1024 }, (err, stdout) => {
      if (err) return reject(err);
      resolve(String(stdout ?? ''));
    });
  });
}

async function tryCraneDigest(ref: string): Promise<string | undefined> {
  try {
    const out = (await execFileStdout('crane', ['digest', ref])).trim();
    const m = out.match(SHA256_IN_REF) ?? out.match(/sha256:([a-f0-9]{64})/i);
    return m ? m[1]!.toLowerCase() : undefined;
  } catch {
    return undefined;
  }
}

async function trySkopeoDigest(ref: string): Promise<string | undefined> {
  try {
    const out = (await execFileStdout('skopeo', ['inspect', '--format', '{{.Digest}}', `docker://${ref}`])).trim();
    const m = out.match(/sha256:([a-f0-9]{64})/i);
    return m ? m[1]!.toLowerCase() : undefined;
  } catch {
    return undefined;
  }
}

export async function run(): Promise<void> {
  const subject = getRequiredInput('subject');
  const subjectType = parseEnum('subject-type', getRequiredInput('subject-type'), ['oci', 'file', 'npm', 'binary'] as const);
  const mode = parseEnum('mode', getOptionalInput('mode') || 'production', ['production', 'mock'] as const);
  const allowInsecureFallback = getBooleanInput('allow-insecure-fallback', false);

  if (mode === 'mock') {
    core.info('MOCK MODE ENABLED');
  }

  let digestHex = '';
  let nameOut = subject;
  let uriOut = subject;

  if (subjectType === 'oci') {
    const embedded = subject.match(SHA256_IN_REF);
    if (embedded) {
      digestHex = embedded[1]!.toLowerCase();
    } else {
      digestHex = (await tryCraneDigest(subject)) ?? (await trySkopeoDigest(subject)) ?? '';

      if (!digestHex) {
        if (mode === 'mock') {
          core.warning('MOCK MODE: could not resolve registry digest; using deterministic synthetic digest for tests.');
          digestHex = createHash('sha256').update(`mock-oci:${subject}`, 'utf8').digest('hex');
        } else if (allowInsecureFallback) {
          throw new ConfigurationError(
            'allow-insecure-fallback=true does not permit fake digests in production. Pin @sha256:… or install crane/skopeo.',
          );
        } else {
          throw new ConfigurationError(
            'Could not resolve OCI digest (fail-closed). Pin @sha256:… or install crane/skopeo, or use mode=mock for tests.',
          );
        }
      }
    }
  } else {
    const abs = path.resolve(subject);
    if (!fs.existsSync(abs) || !fs.statSync(abs).isFile()) {
      throw new ConfigurationError(`Subject path not found or not a file: ${abs}`);
    }
    digestHex = sha256File(abs).toLowerCase();
    nameOut = path.basename(abs);
    uriOut = `file://${abs.replace(/\\/g, '/')}`;
  }

  if (!digestHex || digestHex.length !== 64) {
    throw new ConfigurationError('Invalid digest resolution');
  }

  if (mode === 'production' && subjectType === 'oci') {
    const mockDigest = createHash('sha256').update(`mock-oci:${subject}`, 'utf8').digest('hex');
    if (digestHex === mockDigest) {
      throw new ConfigurationError('Refusing mock-derived digest in production mode');
    }
  }

  setOutputs({
    'subject-name': nameOut,
    'subject-digest': `sha256:${digestHex}`,
    'subject-uri': uriOut,
    'subject-type': subjectType,
  });

  await appendJobSummary(`## BridgedAI subject\n\n- **digest**: \`sha256:${digestHex}\`\n- **type**: \`${subjectType}\`\n`);
}

if (process.env.VITEST !== 'true') {
  void run().catch((e) => {
    fail(e instanceof Error ? e : new Error(String(e)));
  });
}
