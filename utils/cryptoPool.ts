import type { ChampionPoolPayload } from "@/types/database";

const PBKDF2_ITERATIONS = 310_000;
const SALT_BYTES = 16;
const IV_BYTES = 12;

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
}

function fromBase64(b64: string): Uint8Array<ArrayBuffer> {
  const binary = atob(b64);
  const buffer = new ArrayBuffer(binary.length);
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

async function deriveAesKey(
  passphrase: string,
  salt: Uint8Array<ArrayBuffer>
): Promise<CryptoKey> {
  if (typeof window === "undefined" || !window.crypto?.subtle) {
    throw new Error("Web Crypto API is unavailable in this browser.");
  }

  const encoder = new TextEncoder();
  const keyMaterial = await window.crypto.subtle.importKey(
    "raw",
    encoder.encode(passphrase),
    "PBKDF2",
    false,
    ["deriveKey"]
  );

  return window.crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt,
      iterations: PBKDF2_ITERATIONS,
      hash: "SHA-256",
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

export interface EncryptedPoolFields {
  encrypted_payload: string;
  encryption_salt: string;
  encryption_iv: string;
  encryption_version: number;
}

export async function encryptPoolPayload(
  payload: ChampionPoolPayload,
  passphrase: string
): Promise<EncryptedPoolFields> {
  if (!passphrase) {
    throw new Error("Passphrase is required to encrypt your champion pool.");
  }

  const saltBuffer = new ArrayBuffer(SALT_BYTES);
  const salt = new Uint8Array(saltBuffer);
  window.crypto.getRandomValues(salt);

  const ivBuffer = new ArrayBuffer(IV_BYTES);
  const iv = new Uint8Array(ivBuffer);
  window.crypto.getRandomValues(iv);

  const key = await deriveAesKey(passphrase, salt);
  const plaintext = new TextEncoder().encode(JSON.stringify(payload));
  const ciphertext = await window.crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    plaintext
  );

  return {
    encrypted_payload: toBase64(new Uint8Array(ciphertext)),
    encryption_salt: toBase64(salt),
    encryption_iv: toBase64(iv),
    encryption_version: 1,
  };
}

export async function decryptPoolPayload(
  encrypted: Pick<
    EncryptedPoolFields,
    "encrypted_payload" | "encryption_salt" | "encryption_iv"
  >,
  passphrase: string
): Promise<ChampionPoolPayload> {
  if (!passphrase) {
    throw new Error("Enter your passphrase to unlock your champion pool.");
  }

  const salt = fromBase64(encrypted.encryption_salt);
  const iv = fromBase64(encrypted.encryption_iv);
  const ciphertext = fromBase64(encrypted.encrypted_payload);
  const key = await deriveAesKey(passphrase, salt);

  try {
    const decryptedBuffer = await window.crypto.subtle.decrypt(
      { name: "AES-GCM", iv },
      key,
      ciphertext
    );
    const jsonText = new TextDecoder().decode(decryptedBuffer);
    const parsed = JSON.parse(jsonText) as ChampionPoolPayload;
    if (!parsed || typeof parsed !== "object" || !parsed.roles) {
      throw new Error("Invalid decrypted champion pool format.");
    }
    return parsed;
  } catch {
    throw new Error("Incorrect passphrase or corrupted encrypted pool.");
  }
}

function getLocalStorageKey(userId: string): string {
  return `rankr_champ_pool_pass_${userId}`;
}

function getSessionStorageKey(userId: string): string {
  return `rankr_champ_pool_session_${userId}`;
}

export function getStoredPassphrase(userId: string): {
  passphrase: string | null;
  remembered: boolean;
} {
  if (typeof window === "undefined") {
    return { passphrase: null, remembered: false };
  }
  try {
    const localVal = window.localStorage.getItem(getLocalStorageKey(userId));
    if (localVal) {
      return { passphrase: localVal, remembered: true };
    }
    const sessionVal = window.sessionStorage.getItem(getSessionStorageKey(userId));
    if (sessionVal) {
      return { passphrase: sessionVal, remembered: false };
    }
  } catch {
    // ignore storage access errors
  }
  return { passphrase: null, remembered: false };
}

export function storePassphrase(
  userId: string,
  passphrase: string,
  rememberOnBrowser: boolean
): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(getSessionStorageKey(userId), passphrase);
    if (rememberOnBrowser) {
      window.localStorage.setItem(getLocalStorageKey(userId), passphrase);
    } else {
      window.localStorage.removeItem(getLocalStorageKey(userId));
    }
  } catch {
    // ignore storage access errors
  }
}

export function clearStoredPassphrase(userId: string): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(getSessionStorageKey(userId));
    window.localStorage.removeItem(getLocalStorageKey(userId));
  } catch {
    // ignore storage access errors
  }
}
