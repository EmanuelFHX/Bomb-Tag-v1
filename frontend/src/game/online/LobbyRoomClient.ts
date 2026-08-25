import { child, get, onDisconnect, onValue, ref, serverTimestamp, set, update, type Unsubscribe } from "firebase/database";
import { getFirebaseDatabase, prepareFirebaseConnection } from "./firebaseClient";
import type { OnlinePlayerSnapshot, OnlineRoomSnapshot } from "./onlineTypes";

type LobbyRoomClientOptions = {
  roomCode: string;
  playerId: string;
  playerName: string;
  playerColor: number;
  isHost: boolean;
  onError: () => void;
};

export class LobbyRoomClient {
  private readonly roomCode: string;
  private readonly playerId: string;
  private readonly playerName: string;
  private readonly playerColor: number;
  private readonly isHost: boolean;
  private readonly onError: () => void;
  private unsubscribe?: Unsubscribe;

  constructor(options: LobbyRoomClientOptions) {
    this.roomCode = options.roomCode;
    this.playerId = options.playerId;
    this.playerName = options.playerName;
    this.playerColor = options.playerColor;
    this.isHost = options.isHost;
    this.onError = options.onError;
  }

  async connect(onRoom: (room: OnlineRoomSnapshot | null) => void) {
    const database = await prepareFirebaseConnection();
    if (!database) {
      throw new Error("Firebase config missing");
    }

    const roomRef = ref(database, `rooms/${this.roomCode}`);
    const playerRef = child(roomRef, `players/${this.playerId}`);

    if (this.isHost) {
      await set(roomRef, {
        code: this.roomCode,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        status: "waiting",
        hostId: this.playerId,
        players: {}
      });
    } else {
      const snapshot = await get(roomRef);
      if (!snapshot.exists()) {
        onRoom(null);
        return;
      }
    }

    await set(playerRef, this.createBaseSnapshot());
    void onDisconnect(playerRef).remove().catch(() => undefined);

    this.unsubscribe = onValue(
      roomRef,
      (snapshot) => onRoom(snapshot.val() as OnlineRoomSnapshot | null),
      () => this.onError()
    );
  }

  startMatch() {
    if (!this.isHost) {
      return false;
    }

    const database = getFirebaseDatabase();
    if (!database) {
      return false;
    }

    try {
      void update(ref(database, `rooms/${this.roomCode}`), {
        status: "playing",
        updatedAt: serverTimestamp()
      }).catch(() => this.onError());
      return true;
    } catch {
      return false;
    }
  }

  disconnect() {
    this.unsubscribe?.();
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
