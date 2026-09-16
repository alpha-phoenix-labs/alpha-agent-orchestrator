# Phase 3 Render Credential / Proxy Gate

Status: **OPEN — RUNTIME EXECUTION BLOCKED**

This document records the technical gate that must be satisfied before the Phase 3 Render real-read smoke may run. It does not modify the FROZEN integrated roadmap and does not authorize any credential, infrastructure, secret, or production change.

## Frozen-roadmap requirement

Phase 3.4 requires one real Render read through repository `RenderReadTransport` or an explicitly approved technically equivalent constrained GET-only proxy. The approved runtime surface must have backend-only credential handling, use an allowlisted non-secret endpoint, capture provenance and freshness, expose no credential output, and expose no reachable write capability.

A privileged raw Render API key is not provider-side read-only merely because repository code uses HTTP GET.

## Confirmed repository state

- `RenderReadTransport` is fixed to HTTP `GET` and accepts no caller-defined method or headers.
- Render URL policy uses a positive allowlist for non-secret metadata paths.
- credentialed redirects are denied fail-closed before a follow-up request is dispatched.
- `scripts/phase3_render_real_read.py` still expects a backend Render API credential and performs a real services-list request.
- no real repository `RenderReadTransport` request has yet been executed with an approved safe Render identity/proxy boundary.

## Provider credential finding

Current Render documentation describes account API keys as secret credentials that provide API access to all workspaces the account belongs to. The public Render API also supports resource-management operations, including service and datastore management and deploy operations.

Therefore a normal account API key owned by an Admin or Developer identity must be treated as a privileged credential. It is not sufficient evidence for the Phase 3 non-mutating identity requirement.

Official references reviewed on 2026-09-16:

- https://api-docs.render.com/reference/authentication
- https://render.com/docs/api
- https://render.com/docs/team-members
- https://render.com/docs/mcp-server

## Connected Render tool finding

The currently connected Render development tool is useful for provider-side read evidence, but it is not the repository runtime read identity and is not a constrained read-only proxy. Its available tool surface includes mutation operations such as creating resources, updating service environment variables and triggering deploys.

It therefore cannot be used as Phase 3.4 proof of a non-mutating repository runtime surface.

## Provider-side read-only identity candidate

Render documents a `Viewer` workspace role with read-only access to most workspace resources and without permissions to create services, modify service configuration, trigger deploys/rollbacks, delete services, view sensitive datastore credentials, or manage inbound IP rules.

Important constraints:

- `Viewer` is documented as available only on Scale or Enterprise plans.
- the current workspace plan is **UNKNOWN** from the available connected Render read tools.
- a dedicated Viewer identity/API key has not been created or tested.
- no new member, role, API key or secret may be created as part of this gate without explicit Human Gate approval.

A dedicated Viewer identity is therefore a possible provider-side least-privilege route, but it is **NOT YET VERIFIED** for this project.

## Constrained proxy candidate

If a provider-side technically read-only identity is unavailable or would require an unwanted plan change, the FROZEN roadmap permits an explicitly approved constrained backend reader/proxy.

Minimum proxy properties would be:

- privileged Render credential exists only inside the isolated proxy boundary;
- orchestrator never receives the Render credential;
- caller cannot provide an arbitrary upstream URL, HTTP method or authorization header;
- only explicit semantic read operations are exposed;
- upstream Render paths remain positively allowlisted;
- sensitive GET descendants remain unreachable;
- redirects remain fail-closed;
- proxy authentication does not grant any Render write capability;
- response and error paths do not expose credentials;
- deployment and secret provisioning require the Human Gate before any live use.

No proxy service has been created or deployed by this change.

## Current decision

**FAIL CLOSED.**

Do not run `scripts/phase3_render_real_read.py` with the current broad Render account credential merely to obtain a green runtime result.

The next runtime action is blocked until one of these boundaries is explicitly accepted and technically established:

1. a verified provider-side read-only Render identity; or
2. an explicitly approved constrained GET-only proxy/isolation boundary.

## Acceptance for clearing this gate

The credential/proxy gate is cleared only when all of the following are true:

- chosen boundary type is explicitly recorded;
- credential ownership is backend-only;
- approved read surface has no reachable provider mutation capability;
- no credential is committed or pasted into chat;
- allowlisted Render target is fixed/constrained;
- a real read can be executed without secret output;
- provenance and freshness can be captured;
- no provider mutation occurs during validation.
