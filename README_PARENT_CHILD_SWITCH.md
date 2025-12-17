# Parent-Child Account Switching Feature

## Overview
This feature allows parents to switch between their children's accounts to view their profile data and stories as if they were the child. This enables parents to monitor and interact with their children's content effectively.

## API Endpoints

### 1. Switch to Child Profile
- **Endpoint**: `POST /api/parents/switch-child/:childId`
- **Authorization**: Bearer token (Parent account)
- **Description**: Generates a child session token that allows the parent to view content as the specified child
- **Response**:
```json
{
  "success": true,
  "message": "Switched to child profile successfully",
  "data": {
    "childId": "child ObjectId",
    "childName": "Child's name",
    "childEmoji": "Child's emoji",
    "childToken": "JWT token for child session"
  }
}
```

### 2. Switch Back to Parent Profile
- **Endpoint**: `POST /api/parents/switch-back`
- **Authorization**: Bearer token (Child session token)
- **Description**: Switches back from child session to parent account
- **Response**:
```json
{
  "success": true,
  "message": "Switched back to parent profile successfully",
  "data": {
    "parentId": "parent ObjectId",
    "parentName": "Parent's full name",
    "parentToken": "JWT token for parent account"
  }
}
```

### 3. Get Current Child Profile (in child session)
- **Endpoint**: `GET /api/parents/current-child`
- **Authorization**: Bearer token (Child session token)
- **Description**: Gets the profile of the child account currently being viewed as
- **Response**:
```json
{
  "success": true,
  "message": "Current child profile retrieved successfully",
  "data": {
    "childId": "child ObjectId",
    "childName": "Child's name",
    "childAge": "Child's age",
    "childGender": "Child's gender",
    "childPreferredLanguages": ["preferred languages"],
    "childInterests": ["child interests"],
    "childReadingLevel": "Reading level",
    "childPreferredVoice": "Preferred voice",
    "childSafeMode": "Safe mode setting"
  }
}
```

## How It Works

1. **Switching to Child**: Parents can call the `/api/parents/switch-child/:childId` endpoint to generate a special token that allows them to view content as the specified child.

2. **Viewing Content**: With the child session token, parents can access:
   - The child's stories (`/api/stories`)
   - Specific stories (`/api/stories/:id`)
   - Child's stories by child ID (`/api/stories/child/:childId`)
   - Child's profile data (`/api/children/:id`)

3. **Switching Back**: Parents can call `/api/parents/switch-back` to return to their own account with a regular parent token.

## Authentication Handling

The authentication middleware (`/middleware/authMiddleware.js`) has been enhanced to:
- Recognize regular parent tokens (`req.userType = 'parent'`)
- Recognize regular child tokens (`req.userType = 'child'`)
- Recognize child session tokens (when parent is viewing as child) (`req.userType = 'child_session'`)

When `req.userType` is `'child_session'`, the system treats the request as if it's coming from the child, allowing access to child-specific content while maintaining the parent's identity.

## Controllers Updated

All controllers have been updated to properly handle the child session tokens:
- `storyController.js`: Allows child session to access specific child's stories
- `childController.js`: Enables child session to view specific child profiles
- `parentController.js`: Provides switch functionality for parent/child sessions

## Security

- Parents can only switch to children that belong to them
- Child session tokens are validated to ensure the child belongs to the parent
- Access is restricted to prevent unauthorized viewing of other children's content