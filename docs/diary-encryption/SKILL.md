---
name: diary-encryption
description: End-to-end encryption architecture and key management for DiaryArchive.
---

# DiaryArchive Encryption Skill

Public diaries:
- encrypted at rest only.

Private diaries:
- true end-to-end encryption
- encrypt before upload
- server never has plaintext
- server never stores encryption keys
- keys remain user controlled

Always explain cryptographic tradeoffs.
Never invent insecure crypto.
Prefer established libraries and standards.
