# Firebase Security Guide for Histogram

## Are my Firebase keys safe on GitHub?

**Client-side Firebase keys (apiKey, projectId, etc.) are designed to be public.**
Firebase themselves say this. They are not secrets.

**Your real security comes from Firebase Security Rules** — not from hiding the config.

---

## What's safe vs. what's NOT

### ✅ SAFE to commit (public by design)
- `apiKey`
- `authDomain`
- `projectId`
- `storageBucket`
- `messagingSenderId`
- `appId`
- `measurementId`

### ❌ NEVER commit
- Firebase **Admin SDK** service account keys (`serviceAccountKey.json`)
- Any `admin` or `server` credentials
- Your `.env` file (now gitignored)

---

## How to set up

### 1. Create your `.env` file (already done)

Copy `.env.example` to `.env` and fill in your values:

```bash
cp .env.example .env
```

### 2. Never commit `.env`

Already added to `.gitignore`. Verify:

```bash
git status  # .env should not appear
```

### 3. Deploy to Vercel / Netlify / etc.

Add these same environment variables in your hosting platform's dashboard
(Settings → Environment Variables).

---

## Recommended: Firebase Security Rules

This is what **actually** protects your app.

### Firestore Rules (go to Firebase Console → Firestore → Rules)

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // Users can only read/write their own profile
    match /users/{uid} {
      allow read: if true;
      allow write: if request.auth != null && request.auth.uid == uid;
    }

    // Username claims
    match /usernames/{name} {
      allow read: if true;
      allow create: if request.auth != null;
      allow delete: if request.auth != null && resource.data.uid == request.auth.uid;
    }

    // Posts — anyone can read, only author can create/delete
    match /posts/{postId} {
      allow read: if true;
      allow create: if request.auth != null;
      allow delete: if request.auth != null && resource.data.authorId == request.auth.uid;
    }
  }
}
```

### Storage Rules (Firebase Console → Storage → Rules)

```
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /posts/{userId}/{allPaths=**} {
      allow read: if true;
      allow write: if request.auth != null
                   && request.auth.uid == userId
                   && request.resource.size < 5 * 1024 * 1024
                   && request.resource.contentType.matches('image/.*');
    }
  }
}
```

---

## If your keys ARE leaked

Even though they're public by design, if someone misuses your project:

1. Go to **Firebase Console → Project Settings → Users and permissions**
2. Rotate the API key (or create a new Web App)
3. Update your `.env` with the new values
4. Tighten your Security Rules (see above)

---

## Summary

| Concern | Risk | Fix |
|---|---|---|
| API keys on GitHub | Low (they're public by design) | Use Security Rules |
| `.env` on GitHub | **High** | Already gitignored ✅ |
| Admin SDK keys on GitHub | **Critical** | Never use client-side |
| Firestore open access | **High** | Set Security Rules |
| Storage open access | **High** | Set Security Rules |
