# Firebase Security Rules

## Firestore Rules

Go to **Firebase Console → Firestore → Rules** and paste:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // Users — anyone can read profiles, only owner can write
    match /users/{uid} {
      allow read: if true;
      allow create: if request.auth != null && request.auth.uid == uid;
      allow update: if request.auth != null && request.auth.uid == uid;
      allow delete: if false;
    }

    // Usernames — anyone can read, authenticated can create
    match /usernames/{name} {
      allow read: if true;
      allow create: if request.auth != null;
      allow delete: if request.auth != null && resource.data.uid == request.auth.uid;
      allow update: if false;
    }

    // Posts — anyone can read, only author can create/update/delete
    match /posts/{postId} {
      allow read: if true;
      allow create: if request.auth != null
                    && request.resource.data.authorId == request.auth.uid;
      allow update: if request.auth != null
                    && resource.data.authorId == request.auth.uid;
      allow delete: if request.auth != null
                    && resource.data.authorId == request.auth.uid;

      // Comments subcollection
      match /comments/{commentId} {
        allow read: if true;
        allow create: if request.auth != null
                      && request.resource.data.authorId == request.auth.uid;
        allow delete: if request.auth != null
                      && resource.data.authorId == request.auth.uid;
        allow update: if false;
      }
    }

    // Post Likes — only authenticated users can manage their own likes
    match /postLikes/{likeId} {
      allow read: if true;
      allow create: if request.auth != null
                    && request.resource.data.userId == request.auth.uid;
      allow delete: if request.auth != null
                    && resource.data.userId == request.auth.uid;
      allow update: if false;
    }

    // Post Saves — only authenticated users can manage their own saves
    match /postSaves/{saveId} {
      allow read: if request.auth != null
                  && resource.data.userId == request.auth.uid;
      allow create: if request.auth != null
                    && request.resource.data.userId == request.auth.uid;
      allow delete: if request.auth != null
                    && resource.data.userId == request.auth.uid;
      allow update: if false;
    }

    // Follows — authenticated users can manage their follows
    match /follows/{followId} {
      allow read: if request.auth != null;
      allow create: if request.auth != null
                    && request.resource.data.followerId == request.auth.uid;
      allow delete: if request.auth != null
                    && resource.data.followerId == request.auth.uid;
      allow update: if false;
    }
  }
}
```

## Storage Rules

Go to **Firebase Console → Storage → Rules**:

```
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    // Profile pictures — anyone can read, owner can write
    match /profilePics/{userId} {
      allow read: if true;
      allow write: if request.auth != null
                   && request.auth.uid == userId
                   && request.resource.size < 5 * 1024 * 1024
                   && request.resource.contentType.matches('image/.*');
    }

    // Post images — anyone can read, owner can write
    match /posts/{userId}/{allPaths=**} {
      allow read: if true;
      allow write: if request.auth != null
                   && request.auth.uid == userId
                   && request.resource.size < 10 * 1024 * 1024
                   && request.resource.contentType.matches('image/.*');
    }
  }
}
```

## Required Firestore Indexes

You may need to create composite indexes. When you first run the app, Firebase will log errors with direct links to create them:

1. **postLikes**: `postId` ASC, `userId` ASC
2. **postSaves**: `postId` ASC, `userId` ASC
3. **posts**: `authorId` ASC, `createdAt` DESC
4. **follows**: `followerId` ASC, `followingId` ASC

Or use the Firebase Console → Firestore → Indexes → Create Index.
