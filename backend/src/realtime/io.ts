import { Server } from "socket.io";
import { Server as HttpServer } from "http";
import { createClient, type RedisClientType } from "redis";
import { createAdapter } from "@socket.io/redis-adapter";
import { getUserFromClerk } from "../modules/users/user.service.js";
import { createDirectMessage } from "../modules/chat/chat.service.js";
import { env } from "../config/env.js";
import { logger } from "../lib/logger.js";

let io: Server | null = null;
let redisClient: RedisClientType | null = null;

const ONLINE_USERS_SET = "online:users";

function socketsKeyFor(userId: number) {
  return `online:sockets:${userId}`;
}

async function addOnlineUser(rawUserId: unknown, socketId: string) {
  const userId = Number(rawUserId);
  if (!Number.isFinite(userId) || userId <= 0 || !redisClient) return;

  await redisClient.sAdd(socketsKeyFor(userId), socketId);
  await redisClient.sAdd(ONLINE_USERS_SET, String(userId));
}

async function removeOnlineUser(rawUserId: unknown, socketId: string) {
  const userId = Number(rawUserId);
  if (!Number.isFinite(userId) || userId <= 0 || !redisClient) return;

  const key = socketsKeyFor(userId);
  await redisClient.sRem(key, socketId);

  const remaining = await redisClient.sCard(key);
  if (remaining === 0) {
    await redisClient.sRem(ONLINE_USERS_SET, String(userId));
  }
}

async function getOnlineUserIds(): Promise<number[]> {
  if (!redisClient) return [];
  const ids = await redisClient.sMembers(ONLINE_USERS_SET);
  return ids.map(Number);
}

async function broadcasePresence() {
  const onlineUserIds = await getOnlineUserIds();
  io?.emit("presence:update", { onlineUserIds });
}

export async function initIo(httpServer: HttpServer) {
  if (io) return io; //safeguard -> only create once;

  const pubClient = createClient({ url: env.REDIS_URL });
  const subClient = pubClient.duplicate();
  redisClient = pubClient.duplicate() as RedisClientType;

  pubClient.on("error", (err) => logger.error(`Redis pubClient error: ${err.message}`));
  subClient.on("error", (err) => logger.error(`Redis subClient error: ${err.message}`));
  redisClient.on("error", (err) => logger.error(`Redis client error: ${err.message}`));

  await Promise.all([pubClient.connect(), subClient.connect(), redisClient.connect()]);
  logger.info("Connected to Redis (pub/sub + presence store)");

  io = new Server(httpServer, {
    cors: {
      origin: [
        "http://localhost:4000",
        "https://threads-app-psi-three.vercel.app",
      ],
      credentials: true,
    },
    adapter: createAdapter(pubClient, subClient),
  });

  io.on("connection", async (socket) => {
    console.log(`[io connection]------> ${socket.id}`);

    try {
      const clerkUserId = socket.handshake.auth?.userId;

      if (!clerkUserId || typeof clerkUserId !== "string") {
        console.log(`[Missing clerk user id]------> ${socket.id}`);
        socket.disconnect(true);
        return;
      }

      const profile = await getUserFromClerk(clerkUserId);
      const rawLocalUserId = profile.user.id;
      const localUserId = Number(rawLocalUserId);
      const displayName = profile.user.displayName ?? null;
      const handle = profile.user.handle ?? null;

      if (!Number.isFinite(localUserId) || localUserId <= 0) {
        console.log(`[Invalid user id]------> ${socket.id}`);
        socket.disconnect(true);
        return;
      }

      (socket.data as {
        userId: number;
        displayName: string | null;
        handle: string | null;
      }) = {
        userId: localUserId,
        displayName,
        handle,
      };

      const notiRoom = `notifications:user:${localUserId}`;
      socket.join(notiRoom);

      const dmRoom = `dm:user:${localUserId}`;
      socket.join(dmRoom);

      socket.on("dm:send", async (payload: unknown) => {
        try {
          const data = payload as {
            recipientUserId?: number;
            body?: string;
            imageUrl?: string;
          };

          const senderUserId = (socket.data as { userId?: number }).userId;
          if (!senderUserId) return;

          const recipientUserId = Number(data?.recipientUserId);
          if (!Number.isFinite(recipientUserId) || recipientUserId <= 0) {
            return;
          }

          if (senderUserId === recipientUserId) {
            return;
          }

          console.log(`dm:send`, senderUserId, recipientUserId);

          const message = await createDirectMessage({
            senderUserId,
            recipientUserId,
            body: data?.body ?? "",
            imageUrl: data?.imageUrl ?? null,
          });

          const senderRoom = `dm:user:${senderUserId}`;
          const recipientRoom = `dm:user:${recipientUserId}`;

          io?.to(senderRoom).to(recipientRoom).emit("dm:message", message);
        } catch (err) {
          console.error(err);
        }
      });

      socket.on("dm:typing", (payload: unknown) => {
        const data = payload as {
          recipientUserId?: number;
          isTyping?: boolean;
        };

        const senderUserId = (socket.data as { userId?: number }).userId;
        if (!senderUserId) return;

        const recipientUserId = Number(data?.recipientUserId);
        if (!Number.isFinite(recipientUserId) || recipientUserId <= 0) {
          return;
        }

        const recipientRoom = `dm:user:${recipientUserId}`;

        io?.to(recipientRoom).emit("dm:typing", {
          senderUserId,
          recipientRoom,
          isTyping: !!data?.isTyping,
        });
      });

      await addOnlineUser(localUserId, socket.id);
      await broadcasePresence();

      socket.on("disconnect", async () => {
        await removeOnlineUser(localUserId, socket.id);
        await broadcasePresence();
      });
    } catch (err) {
      console.log(`[Error while socket connection]------> ${err}`);
      socket.disconnect(true);
    }
  });

  return io;
}

export function getIo() {
  return io;
}