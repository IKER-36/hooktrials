# VPS bootstrap

This guide prepares a clean Ubuntu 24.04 LTS VPS for HookTrials. Keep an existing SSH session open
while changing firewall or SSH settings.

## 1. Provision the server

Create the CubePath Micro VPS with Ubuntu 24.04 LTS, a public IPv4 address and SSH-key
authentication. In the CubePath firewall, temporarily restrict SSH to the operator IP.

## 2. Point DNS

Create three A records pointing to the VPS:

```text
app.example.com
api.example.com
hooks.example.com
```

Use a short TTL while commissioning. Disable any HTTP proxy at the DNS provider until Caddy obtains
the initial certificates and direct access works.

## 3. Create the deployment account

```bash
ssh root@SERVER_IP
adduser hooktrials
usermod -aG sudo hooktrials
install -d -m 700 -o hooktrials -g hooktrials /home/hooktrials/.ssh
```

Copy the operator public key to /home/hooktrials/.ssh/authorized_keys, then apply:

```bash
chown hooktrials:hooktrials /home/hooktrials/.ssh/authorized_keys
chmod 600 /home/hooktrials/.ssh/authorized_keys
```

Verify access from a second terminal before changing SSH policy:

```bash
ssh hooktrials@SERVER_IP
```

After verification, disable password authentication and direct root login in an SSH configuration
drop-in. Run sshd -t before reloading SSH.

## 4. Update and configure the host firewall

```bash
sudo apt update
sudo apt full-upgrade -y
sudo apt install -y ca-certificates curl git ufw unattended-upgrades
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw allow 443/udp
sudo ufw enable
sudo ufw status verbose
```

Only Caddy publishes host ports in the supplied Compose configuration. Never publish PostgreSQL or
Redis ports.

## 5. Install Docker from its official repository

```bash
sudo apt remove -y docker.io docker-compose docker-compose-v2 podman-docker containerd runc || true
sudo install -m 0755 -d /etc/apt/keyrings
sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
sudo chmod a+r /etc/apt/keyrings/docker.asc
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
sudo systemctl enable --now docker
sudo usermod -aG docker hooktrials
```

Log out and back in, then verify:

```bash
docker version
docker compose version
docker run --rm hello-world
```

The Docker group grants root-equivalent control. Do not add unrelated users.

## 6. Clone the repository

```bash
sudo install -d -m 0755 -o hooktrials -g hooktrials /opt/hooktrials
sudo -u hooktrials git clone REPOSITORY_URL /opt/hooktrials
cd /opt/hooktrials
```

## 7. Create the server-only runtime environment

Persistent variables live outside the repository:

```bash
sudo install -d -m 0700 /etc/hooktrials
sudo install -m 0600 /dev/null /etc/hooktrials/runtime.env
sudoedit /etc/hooktrials/runtime.env
```

Define every required variable from configuration.md. Generate independent URL-safe secrets with:

```bash
openssl rand -hex 32
```

Use a different value for PostgreSQL, Redis, sessions and payload encryption. Never paste real
values into issues, chat, screenshots, Git history or command arguments.

## 8. Validate and start manually

```bash
sudo -i
set -a
. /etc/hooktrials/runtime.env
set +a
cd /opt/hooktrials
docker compose config --quiet
docker compose build
docker compose up -d
docker compose ps
exit
```

## 9. Add systemd supervision

Create /etc/systemd/system/hooktrials.service:

```ini
[Unit]
Description=HookTrials Docker Compose stack
Requires=docker.service
After=docker.service network-online.target
Wants=network-online.target

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=/opt/hooktrials
EnvironmentFile=/etc/hooktrials/runtime.env
ExecStart=/usr/bin/docker compose up -d
ExecReload=/usr/bin/docker compose up -d --build
ExecStop=/usr/bin/docker compose down
TimeoutStartSec=0

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now hooktrials
sudo systemctl status hooktrials
```

Systemd reads the protected environment and passes it to Compose. It never enters the Git working
tree.

## 10. Verify the deployment

```bash
curl --fail "https://api.example.com/healthz"
curl --fail "https://hooks.example.com/healthz"
curl --head "https://app.example.com"
docker compose ps
docker compose logs --tail=100 caddy api ingestor worker
```

Also test registration, endpoint creation and a webhook from outside the VPS.

## 11. Complete before public traffic

- Configure encrypted PostgreSQL backups outside the VPS.
- Test a full restore.
- Enable CubePath backups if available.
- Configure disk, memory and health alerts.
- Enable GitHub private vulnerability reporting.
- Keep the dashboard source-code offer visible as required by AGPL-3.0.
- Verify repository and documentation links before each release.
- Publish the privacy and retention policy.
