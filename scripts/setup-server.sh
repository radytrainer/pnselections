#!/usr/bin/env bash
# One-time preparation of a fresh AWS EC2 instance (Amazon Linux 2023 or Ubuntu 22.04/24.04):
# installs Docker Engine + the compose plugin, enables it on boot, and adds swap
# (the Next.js production build needs ~2 GB of memory).
# Usage: sudo ./scripts/setup-server.sh
set -euo pipefail

if [[ $EUID -ne 0 ]]; then
  echo "Run as root: sudo $0" >&2
  exit 1
fi

TARGET_USER="${SUDO_USER:-ec2-user}"
. /etc/os-release

echo "==> Installing Docker on ${PRETTY_NAME}"
case "$ID" in
  amzn)
    dnf install -y docker git cronie
    systemctl enable --now crond
    mkdir -p /usr/local/lib/docker/cli-plugins
    ARCH="$(uname -m)"
    curl -fsSL "https://github.com/docker/compose/releases/download/v2.39.1/docker-compose-linux-${ARCH}" \
      -o /usr/local/lib/docker/cli-plugins/docker-compose
    chmod +x /usr/local/lib/docker/cli-plugins/docker-compose
    # buildx (needed by compose builds)
    BX_ARCH="$([[ "$ARCH" == "aarch64" ]] && echo arm64 || echo amd64)"
    curl -fsSL "https://github.com/docker/buildx/releases/download/v0.26.1/buildx-v0.26.1.linux-${BX_ARCH}" \
      -o /usr/local/lib/docker/cli-plugins/docker-buildx
    chmod +x /usr/local/lib/docker/cli-plugins/docker-buildx
    ;;
  ubuntu|debian)
    apt-get update
    apt-get install -y ca-certificates curl git gnupg
    install -m 0755 -d /etc/apt/keyrings
    curl -fsSL "https://download.docker.com/linux/${ID}/gpg" -o /etc/apt/keyrings/docker.asc
    chmod a+r /etc/apt/keyrings/docker.asc
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/${ID} ${VERSION_CODENAME} stable" \
      > /etc/apt/sources.list.d/docker.list
    apt-get update
    apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
    ;;
  *)
    echo "Unsupported OS: $ID (use Amazon Linux 2023 or Ubuntu)" >&2
    exit 1
    ;;
esac

systemctl enable --now docker
usermod -aG docker "$TARGET_USER"

# AWS CLI (for S3 backups), if missing
if ! command -v aws >/dev/null 2>&1; then
  case "$ID" in
    amzn) dnf install -y awscli ;;
    *) apt-get install -y unzip && curl -fsSL "https://awscli.amazonaws.com/awscli-exe-linux-$(uname -m).zip" -o /tmp/awscli.zip \
         && unzip -q /tmp/awscli.zip -d /tmp && /tmp/aws/install && rm -rf /tmp/aws /tmp/awscli.zip ;;
  esac
fi

if ! swapon --show | grep -q /swapfile; then
  echo "==> Adding 2G swap"
  fallocate -l 2G /swapfile
  chmod 600 /swapfile
  mkswap /swapfile
  swapon /swapfile
  echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi

docker --version
docker compose version
echo
echo "Done. Log out and back in (so '$TARGET_USER' picks up the docker group), then:"
echo "  ./scripts/init-env.sh your.domain.org && nano .env && ./scripts/deploy.sh"
