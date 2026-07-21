# VPS bootstrap

This guide prepares a clean Ubuntu 24.04 LTS server for the public self-hosted distribution. Keep an
existing SSH session open while changing firewall or SSH settings.

## 1. Provision and secure the server

Recommended baseline: 2 CPU, 4 GB RAM and 20 GB free disk. Use SSH-key authentication, create a
non-root operator and verify a second session before disabling password/root login.

```bash
sudo apt update
sudo apt full-upgrade -y
sudo apt install -y ca-certificates curl git openssl ufw unattended-upgrades
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw allow 443/udp
sudo ufw enable
```

Only the HookTrials gateway should publish HTTP/HTTPS. Never expose PostgreSQL or Redis.

## 2. Install Docker

Install Docker Engine and the Compose v2 plugin from Docker's official Ubuntu repository, then
verify:

```bash
docker version
docker compose version
docker run --rm hello-world
```

Membership in the Docker group is root-equivalent. Grant it only to the deployment operator.

## 3. Create one public hostname

Self-hosted HookTrials uses a single origin for dashboard, API and ingestion paths. Create one `A`
record such as `trials.example.com` pointing to the VPS. Add `AAAA` only when IPv6 is correctly
routed. Keep any CDN proxy disabled until Caddy obtains the first certificate.

Required public paths:

```text
/            dashboard
/api/*       authenticated API and event stream
/i/*         public webhook ingestion
```

## 4. Install HookTrials

```bash
sudo install -d -m 0755 -o "$USER" -g "$USER" /opt/hooktrials
git clone https://github.com/IKER-36/hooktrials.git /opt/hooktrials
cd /opt/hooktrials
git checkout v0.11.0
./hooktrials doctor
./hooktrials configure domain trials.example.com operator@example.com
./hooktrials up
./hooktrials doctor --external
```

The helper generates `.hooktrials/runtime.env` once with mode `0600`, builds the application, runs
migrations and starts Caddy with automatic HTTPS. Preserve this file: it contains the encryption key
required to read retained payloads.

The current release includes the worker egress topology required by Monitoring, Protect and outgoing
alerts.

## 5. Verify outside the VPS

```bash
curl --fail https://trials.example.com/api/healthz
curl --head https://trials.example.com/
./hooktrials status
```

From a browser, create the first owner account, run a template Trial and confirm an external webhook
can reach `/i/*`. Then test Monitoring and Protect from the Product workspace.

If Cloudflare proxies the hostname, enable it after origin validation and use `Full (strict)` TLS;
never use `Flexible`.

## 6. Operations

```bash
./hooktrials logs
./hooktrials backup
./hooktrials update
./hooktrials doctor --external
```

Copy the compressed database backup and `.hooktrials/runtime.env` to an encrypted off-host location.
Test restoration after schema changes. `./hooktrials reset --yes` permanently deletes all data and
generated secrets.

## Launch checklist

- SSH key access and firewall verified.
- One HTTPS origin passes `doctor --external`.
- PostgreSQL/Redis have no published ports.
- First-user registration closes after the owner account is created.
- Backup and restore procedure tested.
- Disk, memory and health alerts configured.
- Synthetic payloads used for demonstrations.
- Source-code offer remains visible as required by AGPL-3.0-only.
