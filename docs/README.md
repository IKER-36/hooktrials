# HookTrials documentation

## Product guides

- [Getting started](getting-started.md)
- [Trial mode](trial-mode.md)
- [Observe mode](observe-mode.md)
- [Protect mode](protect-mode.md)
- [Monitoring APIs and HTTP integrations](monitoring.md)
- [Reliability Replay](reliability-replay.md)
- [Production readiness](production-readiness.md)
- [Public status pages](public-status-pages.md)
- [Contracts and signatures](contracts-and-signatures.md)
- [Incidents, alerts and evidence](incidents-alerts-evidence.md)

This directory contains documentation intended to be published with the source code.

| Document                                        | Purpose                                       |
| ----------------------------------------------- | --------------------------------------------- |
| [Architecture](architecture.md)                 | Services, data flow and trust boundaries      |
| [Configuration](configuration.md)               | Runtime variable names and secret injection   |
| [Development](development.md)                   | Local workspace workflow                      |
| [Product design system](design-system.md)       | Visual language, tokens and UI conventions    |
| [External access](external-access.md)           | Public domains, HTTPS and tunnel options      |
| [Guided demo](guided-demo.md)                   | Templates and complete retry demonstration    |
| [Full Demo Lab](demo-lab.md)                    | Complete product control-loop demonstration   |
| [CLI and CI](cli-and-ci.md)                     | Terminal and GitHub Action reliability gates  |
| [Competition demo](competition-demo.md)         | Reproducible three-minute judging script      |
| [Scenario Studio](scenario-studio.md)           | Custom response-sequence authoring            |
| [Deployment](deployment.md)                     | Production deployment with Docker Compose     |
| [VPS bootstrap](vps-bootstrap.md)               | Prepare a clean Ubuntu server                 |
| [Security](security.md)                         | Threat model and security controls            |
| [Self-hosting](self-hosting.md)                 | Operator-oriented installation guide          |
| [Release status](release-status.md)             | Current version, validation and known issues  |
| [Reliability Replay](reliability-replay.md)     | Causal diagnosis, impact and operator runbook |
| [Production readiness](production-readiness.md) | Explainable route controls and next actions   |
| [Public status pages](public-status-pages.md)   | Revocable monitor health sharing              |

Private notes, credentials, provider identifiers and internal planning never belong here. Local
internal context lives under the ignored .pdocs directory.
