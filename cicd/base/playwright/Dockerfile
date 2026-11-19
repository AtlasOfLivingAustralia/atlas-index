# Build image for every atlas-index UI build/test action in CodePipeline.
#
# - Playwright browsers + OS dependencies, pinned to the @playwright/test version in yarn.lock
# - Node.js major from .nvmrc, with corepack so the yarn version from package.json is used
# - Native toolchain for the `canvas` workspace dependency (built from source, see package.json)
# - AWS CLI v2 (S3 reports, publishing)
#
# Built and pushed by cicd/base/playwright/build_image.sh; tagged pw<playwright>-node<node major>-<hash>.

ARG PLAYWRIGHT_VERSION
FROM mcr.microsoft.com/playwright:v${PLAYWRIGHT_VERSION}-noble

ARG PLAYWRIGHT_VERSION
ARG NODE_MAJOR

RUN apt-get update \
 && apt-get install -y --no-install-recommends \
      build-essential ca-certificates curl git gnupg jq python3 unzip \
      libcairo2-dev libpango1.0-dev libjpeg-dev libgif-dev librsvg2-dev \
 && curl -fsSL "https://deb.nodesource.com/setup_${NODE_MAJOR}.x" | bash - \
 && apt-get install -y --no-install-recommends nodejs \
 && rm -rf /var/lib/apt/lists/*

RUN curl -fsSL "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o /tmp/awscliv2.zip \
 && unzip -q /tmp/awscliv2.zip -d /tmp \
 && /tmp/aws/install \
 && rm -rf /tmp/aws /tmp/awscliv2.zip

RUN npm install -g corepack \
 && corepack enable

ENV PLAYWRIGHT_IMAGE_VERSION=${PLAYWRIGHT_VERSION}
