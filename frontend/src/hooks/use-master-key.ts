"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AxiosError } from "axios";

import { apiClient } from "@/lib/api/client";
import {
  decryptMasterKey,
  encryptMasterKey,
  generateMasterKey,
  importMasterKey,
} from "@/lib/crypto";
import {
  clearMasterKey as clearMasterKeyFromCache,
  getMasterKey,
  setMasterKey,
} from "@/lib/master-key-cache";
import { useAuthStore } from "@/store/auth-store";

function extractErrorMessage(err: unknown, fallback: string): string {
  if (err instanceof AxiosError) {
    const apiMsg = err.response?.data?.error?.message;
    if (apiMsg) return apiMsg;
    if (err.response?.status === 401) return "Authentication failed. Please log in again.";
    if (err.response?.status) return `Server error (${err.response.status}). Please try again.`;
    return err.message || fallback;
  }
  if (err instanceof Error) return err.message;
  return fallback;
}

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
  ) => Promise<{ newEncryptedMasterKey: string; newMasterKeySalt: string; newMasterKeyIv: string } | null>;
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

  const cachedKey = userId ? getMasterKey(userId) : undefined;
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
        if (!keyData?.encrypted_master_key || !keyData?.master_key_salt || !keyData?.master_key_iv) {
          setState((s) => ({
            ...s,
            error: "No encryption key found",
            isLoading: false,
          }));
          return;
        }
        const masterBytes = await decryptMasterKey(
          keyData.encrypted_master_key,
          keyData.master_key_salt,
          keyData.master_key_iv,
          password
        );
        const mk = await importMasterKey(masterBytes);
        setMasterKey(userId, mk);
        setState({ masterKey: mk, isLoading: false, error: null });
      } catch (err: unknown) {
        const message = extractErrorMessage(err, "Incorrect password or corrupted key data");
        setState((s) => ({
          ...s,
          error: message,
          isLoading: false,
        }));
        throw new Error(message);
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
        const masterBytes = generateMasterKey();
        const mk = await importMasterKey(masterBytes);
        const { encryptedMasterKey, salt, iv } = await encryptMasterKey(
          masterBytes,
          password
        );
        await apiClient.put("/users/me/encryption-key", {
          encrypted_master_key: encryptedMasterKey,
          master_key_salt: salt,
          master_key_iv: iv,
        });
        setMasterKey(userId, mk);
        useAuthStore.getState().setUser({
          ...useAuthStore.getState().user!,
          has_master_key: true,
        });
        setState({ masterKey: mk, isLoading: false, error: null });
      } catch (err: unknown) {
        const message = extractErrorMessage(err, "Failed to set up encryption");
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
    ): Promise<{ newEncryptedMasterKey: string; newMasterKeySalt: string; newMasterKeyIv: string } | null> => {
      if (!hasMasterKey || !userId) return null;
      const meResp = await apiClient.get("/users/me/encryption-key");
      const keyData = meResp.data.data || meResp.data;
      if (!keyData?.encrypted_master_key || !keyData?.master_key_salt || !keyData?.master_key_iv) {
        return null;
      }
      let masterBytes: Uint8Array;
      try {
        masterBytes = await decryptMasterKey(
          keyData.encrypted_master_key,
          keyData.master_key_salt,
          keyData.master_key_iv,
          currentPassword
        );
      } catch {
        throw new Error(
          "Could not unlock your master key with your current password. " +
            "Changing the password now would permanently destroy your private diaries. " +
            "Enter the correct current password, or keep your password unchanged."
        );
      }
      const { encryptedMasterKey, salt, iv } = await encryptMasterKey(
        masterBytes,
        newPassword
      );
      const check = await decryptMasterKey(
        encryptedMasterKey,
        salt,
        iv,
        newPassword
      );
      void check;
      const refreshed = await importMasterKey(masterBytes);
      setMasterKey(userId, refreshed);
      setState((s) => ({ ...s, masterKey: refreshed }));
      return { newEncryptedMasterKey: encryptedMasterKey, newMasterKeySalt: salt, newMasterKeyIv: iv };
    },
    [hasMasterKey, userId]
  );

  const clearMasterKey = useCallback(() => {
    if (userId) clearMasterKeyFromCache(userId);
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

export { getMasterKey, clearMasterKeyFromCache };
