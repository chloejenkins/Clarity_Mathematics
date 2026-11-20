# The always-on preview site (render-preview.yaml): the whole app with demo
# data and the "Preview as" picker instead of real sign-in. It brings its own
# throwaway Postgres inside the container, so it never touches the real
# database or the live site, and every pull request preview gets its own copy.
#
# Build from the repo root:  docker build -f preview/Dockerfile -t clarity-preview .
# Run:                       docker run -p 10000:10000 clarity-preview
FROM postgres:16-bookworm

# Node 24 from the official image (same version as the live site).
COPY --from=node:24-bookworm-slim /usr/local/bin/node /usr/local/bin/node
COPY --from=node:24-bookworm-slim /usr/local/lib/node_modules /usr/local/lib/node_modules
RUN ln -s ../lib/node_modules/npm/bin/npm-cli.js /usr/local/bin/npm \
 && npm install -g pnpm@10.28.0

WORKDIR /app
COPY . .
RUN pnpm install --frozen-lockfile

# Website with the demo sign-in swapped in for Clerk, marked "don't index".
RUN PORT=3000 BASE_PATH=/ VITE_E2E_AUTH=1 VITE_DEMO=1 VITE_CLERK_PUBLISHABLE_KEY=pk_test_e2e \
      pnpm --filter @workspace/tutor-hub run build \
 && sed -i 's#<head>#<head>\n    <meta name="robots" content="noindex, nofollow" />#' artifacts/tutor-hub/dist/public/index.html \
 && printf 'User-agent: *\nDisallow: /\n' > artifacts/tutor-hub/dist/public/robots.txt

# API with the matching demo sign-in (see artifacts/api-server/src/testing/fake-clerk.ts).
RUN cd artifacts/api-server && E2E_AUTH_BYPASS=1 node build.mjs

ENV PORT=10000
EXPOSE 10000
ENTRYPOINT []
CMD ["preview/start.sh"]
