import { child, onDisconnect, onValue, ref, serverTimestamp, set, update, type Unsubscribe } from "firebase/database";
import { getFirebaseDatabase } from "./firebaseClient";
import type { OnlineMatchState, OnlinePlayerSnapshot, OnlineRoomSnapshot } from "./onlineTypes";

type OnlineRoomClientOptions = {
  roomCode: string;
  playerId: string;
  playerName: string;
  playerColor: number;
  isHost: boolean;
};

export class OnlineRoomClient {
  private readonly roomCode: string;
  private readonly playerId: string;
  private readonly playerName: string;
  private readonly playerColor: number;
  private readonly isHost: boolean;
  private unsubscribe?: Unsubscribe;
  private lastWriteAt = 0;
  private lastMatchWriteAt = 0;

  constructor(options: OnlineRoomClientOptions) {
    this.roomCode = options.roomCode;
    this.playerId = options.playerId;
    this.playerName = options.playerName;
    this.playerColor = options.playerColor;
    this.isHost = options.isHost;
  }

  async connect(onRoom: (room: OnlineRoomSnapshot | null) => void) {
    const database = getFirebaseDatabase();
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
    await onDisconnect(playerRef).remove();

    this.unsubscribe = onValue(roomRef, (snapshot) => {
      onRoom(snapshot.val() as OnlineRoomSnapshot | null);
    });
  }

  updatePlayer(snapshot: Omit<OnlinePlayerSnapshot, "id" | "name" | "color" | "updatedAt">) {
    const now = performance.now();
    if (now - this.lastWriteAt < 90) {
      return;
    }

    this.lastWriteAt = now;
    const database = getFirebaseDatabase();
    if (!database) {
      return;
    }

    const playerRef = ref(database, `rooms/${this.roomCode}/players/${this.playerId}`);
    void update(playerRef, {
      ...snapshot,
      id: this.playerId,
      name: this.playerName,
      color: this.playerColor,
      updatedAt: serverTimestamp()
    });
  }

  updateMatchState(match: OnlineMatchState) {
    if (!this.isHost) {
      return;
    }

    const now = performance.now();
    if (now - this.lastMatchWriteAt < 80) {
      return;
    }

    this.lastMatchWriteAt = now;
    const database = getFirebaseDatabase();
    if (!database) {
      return;
    }

    void set(ref(database, `rooms/${this.roomCode}/match`), {
      ...match,
      updatedAt: serverTimestamp()
    });
    void update(ref(database, `rooms/${this.roomCode}`), {
      updatedAt: serverTimestamp()
    });
  }

  disconnect() {
    this.unsubscribe?.();
    const database = getFirebaseDatabase();
    if (!database) {
      return;
    }

    void set(ref(database, `rooms/${this.roomCode}/players/${this.playerId}`), null);
  }

  private createBaseSnapshot(): OnlinePlayerSnapshot {
    return {
      id: this.playerId,
      name: this.playerName,
      color: this.playerColor,
      x: 0,
      y: 0,
      aimX: 1,
      aimY: 0,
      alive: true,
      hasBomb: false,
      hasWeapon: false,
      updatedAt: Date.now()
    };
  }
}
