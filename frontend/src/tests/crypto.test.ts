import { describe, it, expect } from "vitest";
import {
  encryptDiary,
  decryptDiary,
  generateMasterKey,
  encryptMasterKey,
  decryptMasterKey,
  type DiaryPlaintext,
} from "@/lib/crypto";

describe("crypto", () => {
  it("round-trips a diary through encrypt/decrypt", async () => {
    const mk = await generateMasterKey();

    const plaintext: DiaryPlaintext = {
      title: "My Private Diary",
      contentHtml: "<p>Hello world with <strong>bold</strong> text.</p>",
      tags: ["personal", "thoughts"],
    };

    const encrypted = await encryptDiary(plaintext, mk);
    expect(encrypted.ciphertext).toBeTruthy();
    expect(encrypted.iv).toBeTruthy();
    expect(encrypted.salt).toBeTruthy();

    const decrypted = await decryptDiary(encrypted, mk);
    expect(decrypted.title).toBe("My Private Diary");
    expect(decrypted.contentHtml).toContain("<strong>bold</strong>");
    expect(decrypted.tags).toEqual(["personal", "thoughts"]);
  });

  it("fails to decrypt with wrong master key", async () => {
    const mk1 = await generateMasterKey();
    const mk2 = await generateMasterKey();

    const encrypted = await encryptDiary(
      { title: "Secret", contentHtml: "<p>test</p>", tags: [] },
      mk1,
    );

    await expect(decryptDiary(encrypted, mk2)).rejects.toThrow();
  });

  it("master key round-trips through wrap/unwrap", async () => {
    const mk = await generateMasterKey();
    const password = "CorrectHorseBatteryStaple1!";

    const { encryptedMasterKey, salt, iv } = await encryptMasterKey(mk, password);
    expect(encryptedMasterKey).toBeTruthy();
    expect(salt).toBeTruthy();
    expect(iv).toBeTruthy();

    const decrypted = await decryptMasterKey(encryptedMasterKey, salt, iv, password);
    expect(decrypted).toBeDefined();

    const plain = await decryptDiary(
      await encryptDiary({ title: "Test", contentHtml: "<p>x</p>", tags: [] }, mk),
      decrypted,
    );
    expect(plain.title).toBe("Test");
  });

  it("fails to unwrap master key with wrong password", async () => {
    const mk = await generateMasterKey();
    const { encryptedMasterKey, salt, iv } = await encryptMasterKey(mk, "Password1!");

    await expect(
      decryptMasterKey(encryptedMasterKey, salt, iv, "WrongPassword1!"),
    ).rejects.toThrow();
  });

  it("generates unique ciphertexts for same plaintext", async () => {
    const mk = await generateMasterKey();
    const plain: DiaryPlaintext = { title: "A", contentHtml: "<p>B</p>", tags: [] };

    const e1 = await encryptDiary(plain, mk);
    const e2 = await encryptDiary(plain, mk);

    expect(e1.ciphertext).not.toBe(e2.ciphertext);
    expect(e1.iv).not.toBe(e2.iv);
  });
});
