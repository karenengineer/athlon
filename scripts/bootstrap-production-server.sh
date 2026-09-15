#!/usr/bin/env bash
set -euo pipefail

if [[ "$(id -un)" != "ubuntu" ]]; then
  printf 'Run this script as the ubuntu user.\n' >&2
  exit 1
fi

if [[ -z "$(swapon --show --noheadings)" ]]; then
  if [[ ! -f /swapfile ]]; then
    sudo fallocate -l 2G /swapfile
  fi

  sudo chmod 600 /swapfile
  sudo mkswap /swapfile >/dev/null
  sudo swapon /swapfile

  if ! grep -Fqx '/swapfile none swap sw 0 0' /etc/fstab; then
    printf '/swapfile none swap sw 0 0\n' | sudo tee -a /etc/fstab >/dev/null
  fi
fi

sudo apt-get update
sudo env DEBIAN_FRONTEND=noninteractive apt-get install -y \
  docker.io \
  docker-compose-v2 \
  rsync \
  curl \
  openssl \
  util-linux
sudo systemctl enable --now docker
sudo usermod -aG docker ubuntu
sudo install -d -o ubuntu -g ubuntu /opt/athlon /opt/athlon/backups

if [[ -e /opt/athlon/.env ]]; then
  sudo chown ubuntu:ubuntu /opt/athlon/.env
  sudo chmod 600 /opt/athlon/.env
fi
