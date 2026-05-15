# BridgedAI Subject (`bridgedai-devsecops/subject-action`)

## What this action does

Resolves a canonical `sha256:` digest for supported artifact subjects.

## Quick start

```yaml
- uses: bridgedai-devsecops/subject-action@v1
  id: subj
  with:
    subject: docker.io/library/alpine@sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa
    subject-type: oci
```

## Why BridgedAI exists

Immutable artifact identity is a prerequisite for trustworthy evidence, SBOMs, and attestations.

## Inputs / outputs

See `action.yml`.

## Required permissions

Typically `contents: read` only. OCI resolution via registry APIs may require outbound network access.

## Mock mode

`mode: mock` enables deterministic synthetic digests **only when registry digest resolution is unavailable**.

## Support

Use your BridgedAI support channel.

