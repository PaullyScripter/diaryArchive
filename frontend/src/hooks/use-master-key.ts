"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { apiClient } from "@/lib/api/client";
import {
  decryptMasterKey,
  encryptMasterKey,
  generateMasterKey,
} from "@/lib/crypto";
import { useAuthStore } from "@/store/auth-store";

interface MasterKeyState {
  masterKey: CryptoKey | null;
  isLoading: boolean;
  error: string | null;
}

const masterKeyMap = new Map<string, CryptoKey>();

export function useMasterKey(): MasterKeyState & {
  loadMasterKey: (password: string) => Promise<void>;
  setupMasterKey: (password: string) => Promise<void>;
  reEncryptMasterKey: (
    currentPassword: string,
    newPassword: string
  ) => Promise<{ newEncryptedMasterKey: string; newMasterKeySalt: string } | null>;
  clearMasterKey: () => void;
  isAvailable: boolean;
} {
  const [state, setState] = useState<MasterKeyState>({
    masterKey: null,
    isLoading: false,
    error: null,
  });
  const user = useAuthStore((s) => s.user);
  const userId = user?.id;
  const hasMasterKey = user?.has_master_key ?? false;
  const hasAttempted = useRef(false);

  const isAvailable = hasMasterKey && state.masterKey !== null;

  const cachedKey = userId ? masterKeyMap.get(userId) : undefined;
  useEffect(() => {
    if (cachedKey && !state.masterKey) {
      setState({ masterKey: cachedKey, isLoading: false, error: null });
    }
  }, [cachedKey, state.masterKey]);

  const loadMasterKey = useCallback(
    async (password: string) => {
      if (!userId) {
        setState((s) => ({
          ...s,
          error: "Not authenticated",
          isLoading: false,
        }));
        return;
      }
      setState((s) => ({ ...s, isLoading: true, error: null }));
      try {
        const meResp = await apiClient.get("/users/me/encryption-key");
        const keyData = meResp.data.data || meResp.data;
        if (!keyData?.encrypted_master_key || !keyData?.master_key_salt) {
          setState((s) => ({
            ...s,
            error: "No encryption key found",
            isLoading: false,
          }));
          return;
        }
        const mk = await decryptMasterKey(
          keyData.encrypted_master_key,
          keyData.master_key_salt,
          password
        );
        masterKeyMap.set(userId, mk);
        setState({ masterKey: mk, isLoading: false, error: null });
      } catch {
        setState((s) => ({
          ...s,
          error: "Incorrect password or corrupted key data",
          isLoading: false,
        }));
        throw new Error("Incorrect password or corrupted key data");
      }
    },
    [userId]
  );

  const setupMasterKey = useCallback(
    async (password: string) => {
      if (!userId) {
        setState((s) => ({
          ...s,
          error: "Not authenticated",
          isLoading: false,
        }));
        return;
      }
      setState((s) => ({ ...s, isLoading: true, error: null }));
      try {
        const mk = await generateMasterKey();
        const { encryptedMasterKey, salt } = await encryptMasterKey(
          mk,
          password
        );
        await apiClient.put("/users/me/encryption-key", {
          encrypted_master_key: encryptedMasterKey,
          master_key_salt: salt,
        });
        masterKeyMap.set(userId, mk);
        useAuthStore.getState().setUser({
          ...useAuthStore.getState().user!,
          has_master_key: true,
        });
        setState({ masterKey: mk, isLoading: false, error: null });
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to set up encryption";
        setState((s) => ({
          ...s,
          error: message,
          isLoading: false,
        }));
        throw err;
      }
    },
    [userId]
  );

  const reEncryptMasterKey = useCallback(
    async (
      currentPassword: string,
      newPassword: string
    ): Promise<{ newEncryptedMasterKey: string; newMasterKeySalt: string } | null> => {
      if (!hasMasterKey || !state.masterKey) return null;
      const { encryptedMasterKey, salt } = await encryptMasterKey(
        state.masterKey,
        newPassword
      );
      await decryptMasterKey(
        encryptedMasterKey,
        salt,
        newPassword
      );
      return { newEncryptedMasterKey: encryptedMasterKey, newMasterKeySalt: salt };
    },
    [hasMasterKey, state.masterKey]
  );

  const clearMasterKey = useCallback(() => {
    if (userId) masterKeyMap.delete(userId);
    setState({ masterKey: null, isLoading: false, error: null });
  }, [userId]);

  useEffect(() => {
    if (hasMasterKey && !cachedKey && !hasAttempted.current) {
      hasAttempted.current = true;
    }
  }, [hasMasterKey, cachedKey]);

  return {
    ...state,
    loadMasterKey,
    setupMasterKey,
    reEncryptMasterKey,
    clearMasterKey,
    isAvailable,
  };
}

export function getMasterKey(userId: string): CryptoKey | undefined {
  return masterKeyMap.get(userId);
}
