FROM mcr.microsoft.com/devcontainers/javascript-node:22-bookworm

USER root

RUN corepack enable && \
    corepack prepare yarn@1.22.22 --activate && \
    apt-get update && \
    apt-get install -y --no-install-recommends \
    g++=4:12.2.0-3 \
    make=4.3-4.1 \
    python3 \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

USER node