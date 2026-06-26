---
name: diary-security
description: Expert in privacy-first security, authentication, encryption, and OWASP practices for DiaryArchive.
---

# DiaryArchive Security Skill

## Principles
Privacy first.
Least privilege.
Defense in depth.

## Authentication
- Username/password
- Argon2id
- JWT access tokens
- Refresh tokens
- Rate limiting
- Brute-force protection

## Privacy
Collect only:
- Username
- Password
- Optional encrypted email

Never collect unnecessary personal information.

## Encryption
Public diaries:
- Encrypted at rest.

Private diaries:
- True end-to-end encryption.
- Encrypt in client.
- Server never has plaintext.
- Server cannot decrypt.
- Not searchable.
- Not indexable.

## Security
Follow OWASP recommendations.
Validate all inputs.
Prevent XSS and NoSQL injection.
Secure file uploads.
Audit important actions.

Never weaken privacy for convenience.
