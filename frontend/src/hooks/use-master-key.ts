"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AxiosError } from "axios";

import { apiClient } from "@/lib/api/client";
import {
  decryptMasterKey,
  encryptMasterKey,
  generateMasterKey,
} from "@/lib/crypto";
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
        if (!keyData?.encrypted_master_key || !keyData?.master_key_salt || !keyData?.master_key_iv) {
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
          keyData.master_key_iv,
          password
        );
        masterKeyMap.set(userId, mk);
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
        const mk = await generateMasterKey();
        const { encryptedMasterKey, salt, iv } = await encryptMasterKey(
          mk,
          password
        );
        await apiClient.put("/users/me/encryption-key", {
          encrypted_master_key: encryptedMasterKey,
          master_key_salt: salt,
          master_key_iv: iv,
        });
        masterKeyMap.set(userId, mk);
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
      if (!hasMasterKey || !state.masterKey) return null;
      const { encryptedMasterKey, salt, iv } = await encryptMasterKey(
        state.masterKey,
        newPassword
      );
      await decryptMasterKey(
        encryptedMasterKey,
        salt,
        iv,
        newPassword
      );
      return { newEncryptedMasterKey: encryptedMasterKey, newMasterKeySalt: salt, newMasterKeyIv: iv };
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
