import { child, onDisconnect, onValue, ref, serverTimestamp, set, update, type Unsubscribe } from "firebase/database";
import { getFirebaseDatabase, prepareFirebaseConnection } from "./firebaseClient";
import type { OnlineMatchState, OnlinePlayerSnapshot, OnlineRoomSnapshot } from "./onlineTypes";

type OnlineRoomClientOptions = {
  roomCode: string;
  playerId: string;
  playerName: string;
  playerColor: number;
  isHost: boolean;
  onError: () => void;
};

const PLAYER_WRITE_INTERVAL_MS = 66;
const MATCH_WRITE_INTERVAL_MS = 66;

export class OnlineRoomClient {
  private readonly roomCode: string;
  private readonly playerId: string;
  private readonly playerName: string;
  private readonly playerColor: number;
  private readonly isHost: boolean;
  private readonly onError: () => void;
  private unsubscribe?: Unsubscribe;
  private unsubscribeMatch?: Unsubscribe;
  private lastWriteAt = 0;
  private lastMatchWriteAt = 0;

  constructor(options: OnlineRoomClientOptions) {
    this.roomCode = options.roomCode;
    this.playerId = options.playerId;
    this.playerName = options.playerName;
    this.playerColor = options.playerColor;
    this.isHost = options.isHost;
    this.onError = options.onError;
  }

  async connect(onRoom: (room: OnlineRoomSnapshot | null) => void, initialMatch?: OnlineMatchState) {
    const database = await prepareFirebaseConnection();
    if (!database) {
      throw new Error("Firebase config missing");
    }

    const roomRef = ref(database, `rooms/${this.roomCode}`);
    const playerRef = child(roomRef, `players/${this.playerId}`);

    if (this.isHost) {
      await update(roomRef, {
        code: this.roomCode,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        status: "playing",
        hostId: this.playerId
      });
    }

    await set(playerRef, this.createBaseSnapshot());
    void onDisconnect(playerRef).remove().catch(() => undefined);

    if (this.isHost && initialMatch) {
      await set(child(roomRef, "match"), {
        ...initialMatch,
        updatedAt: Date.now()
      });
    }

    const listenRef = child(roomRef, "players");
    this.unsubscribe = onValue(
      listenRef,
      (snapshot) => {
        if (this.isHost) {
          onRoom({
            code: this.roomCode,
            createdAt: Date.now(),
            updatedAt: Date.now(),
            status: "playing",
            hostId: this.playerId,
            players: snapshot.val() as OnlineRoomSnapshot["players"]
          });
          return;
        }

        onRoom({
          code: this.roomCode,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          status: "playing",
          hostId: "",
          players: snapshot.val() as OnlineRoomSnapshot["players"]
        });
      },
      () => this.onError()
    );

    if (!this.isHost) {
      this.unsubscribeMatch = onValue(
        child(roomRef, "match"),
        (snapshot) => {
          const match = snapshot.val() as OnlineRoomSnapshot["match"] | null;
          if (!match) {
            return;
          }

          onRoom({
            code: this.roomCode,
            createdAt: Date.now(),
            updatedAt: Date.now(),
            status: "playing",
            hostId: "",
            players: {},
            match
          });
        },
        () => this.onError()
      );
    }
  }

  updatePlayer(snapshot: Omit<OnlinePlayerSnapshot, "id" | "name" | "color" | "updatedAt">) {
    const now = performance.now();
    if (now - this.lastWriteAt < PLAYER_WRITE_INTERVAL_MS) {
      return true;
    }

    this.lastWriteAt = now;
    const database = getFirebaseDatabase();
    if (!database) {
      return false;
    }

    try {
      const playerRef = ref(database, `rooms/${this.roomCode}/players/${this.playerId}`);
      void update(playerRef, {
        ...snapshot,
        id: this.playerId,
        name: this.playerName,
        color: this.playerColor,
        updatedAt: serverTimestamp()
      }).catch(() => this.onError());
      return true;
    } catch {
      return false;
    }
  }

  updateMatchState(match: OnlineMatchState, force = false) {
    if (!this.isHost) {
      return true;
    }

    const now = performance.now();
    if (!force && now - this.lastMatchWriteAt < MATCH_WRITE_INTERVAL_MS) {
      return true;
    }

    this.lastMatchWriteAt = now;
    const database = getFirebaseDatabase();
    if (!database) {
      return false;
    }

    try {
      void set(ref(database, `rooms/${this.roomCode}/match`), {
        ...match,
        updatedAt: Date.now()
      }).catch(() => this.onError());
      return true;
    } catch {
      return false;
    }
  }

  disconnect() {
    this.unsubscribe?.();
    this.unsubscribeMatch?.();
    const database = getFirebaseDatabase();
    if (!database) {
      return;
    }

    void set(ref(database, `rooms/${this.roomCode}/players/${this.playerId}`), null).catch(() => undefined);
  }

  private createBaseSnapshot(): OnlinePlayerSnapshot {
    return {
      id: this.playerId,
      name: this.playerName,
      color: this.playerColor,
      x: 0,
      y: 0,
      velocityX: 0,
      velocityY: 0,
      aimX: 1,
      aimY: 0,
      alive: true,
      hasBomb: false,
      hasWeapon: false,
      updatedAt: Date.now()
    };
  }
}
