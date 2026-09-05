import { prisma } from "@/server/db/client";

/**
 * The single `YoutubeConnection` row (fixed id `"default"` — see the
 * schema's own comment on that model). This repository is deliberately
 * dumb: it never encrypts/decrypts anything itself (that's
 * `src/server/integrations/youtube.ts`'s job) and never exposes the
 * decrypted token — callers reading `encryptedRefreshToken` off the
 * returned row are expected to be that one module, never a route or
 * Server Action directly.
 */
export const youtubeConnectionRepository = {
  get() {
    return prisma.youtubeConnection.findUnique({ where: { id: "default" } });
  },

  upsert(data: { channelId: string; channelTitle: string; encryptedRefreshToken: string; scope: string; connectedById: string }) {
    return prisma.youtubeConnection.upsert({
      where: { id: "default" },
      create: { id: "default", ...data },
      update: data,
    });
  },

  disconnect() {
    return prisma.youtubeConnection.deleteMany({ where: { id: "default" } });
  },
};
