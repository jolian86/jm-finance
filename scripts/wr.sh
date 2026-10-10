#!/bin/sh
# wrangler para deploy na Cloudflare a partir do box. Precisa de CLOUDFLARE_API_TOKEN no ambiente (nunca no repositório).
export CLOUDFLARE_ACCOUNT_ID=8912b4962683a0ba457d6394b2d22691
DIR=$(cd "$(dirname "$0")/.." && pwd)
NODE=/workspace/node22/bin/node; [ -x "$NODE" ] || NODE=node   # wrangler 4 pede Node 22+
exec "$NODE" "$DIR/node_modules/wrangler/bin/wrangler.js" "$@"
