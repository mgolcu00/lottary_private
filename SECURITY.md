# Security Documentation

## Overview
This document outlines known security issues in the lottery application, particularly around the username/password authentication system.

## Username/Password Authentication System

### Current Implementation
The application uses a custom username/password authentication system built on top of Firebase Anonymous Auth:

1. **Anonymous Auth Workaround**: Users are signed in anonymously first using `signInAnonymously()` to gain Firestore read permissions
2. **Client-Side Storage**: Usernames and password hashes are stored in the `authUsers` Firestore collection
3. **SHA-256 Hashing**: Passwords are hashed using SHA-256 before storage
4. **Client-Side Verification**: Password verification happens in the browser

**Code Location**: `/src/contexts/AuthContext.tsx` (lines 152-224)

### Known Security Issues

#### 1. Weak Password Hashing
- **Issue**: SHA-256 is used for password hashing
- **Problem**: SHA-256 is designed for speed, not security. It's vulnerable to:
  - Rainbow table attacks
  - Brute force attacks (billions of hashes per second on modern hardware)
  - No salt or key stretching
- **Industry Standard**: Use bcrypt, scrypt, or argon2 with proper salt
- **Risk Level**: HIGH

#### 2. Client-Side Password Verification
- **Issue**: Password hash comparison happens in browser JavaScript
- **Problem**:
  - Anyone can read the `authUsers` collection and steal password hashes
  - Attackers can download all hashes and crack them offline
  - No rate limiting on verification attempts
- **Proper Solution**: Server-side verification via Cloud Functions
- **Risk Level**: HIGH

#### 3. Anonymous Auth Accumulation
- **Issue**: `signInAnonymously()` is called on every login attempt
- **Problem**:
  - Creates anonymous Firebase users that never get cleaned up
  - Project will accumulate thousands of anonymous users over time
  - Consumes Firebase authentication quota
- **Proper Solution**: Use proper Firebase Auth or Cloud Functions
- **Risk Level**: MEDIUM

#### 4. Username Enumeration
- **Issue**: Anyone authenticated can read the `authUsers` collection
- **Problem**: Attackers can enumerate all registered usernames
- **Industry Practice**: Don't reveal if username exists or not
- **Risk Level**: LOW

#### 5. No Password Complexity Requirements
- **Issue**: Only minimum length (3 characters) enforced
- **Problem**: Users can set weak passwords like "123", "aaa"
- **Recommendation**: Require mix of letters, numbers, special characters
- **Risk Level**: MEDIUM

#### 6. No Rate Limiting on Auth
- **Issue**: No server-side rate limiting on login attempts
- **Current**: Client-side rate limiting easily bypassed
- **Problem**: Vulnerable to brute force attacks
- **Risk Level**: MEDIUM

### Recommended Solutions

#### Short-Term (Quick Fixes)
1. Add Firestore rules to restrict `authUsers` collection reads
2. Add password complexity requirements in client
3. Implement better client-side rate limiting with localStorage
4. Add account lockout after X failed attempts

#### Long-Term (Proper Solution)
1. **Option A**: Migrate to Firebase Email/Password Authentication
   - Built-in security
   - Proper password hashing
   - Rate limiting included
   - Easy to implement

2. **Option B**: Use Firebase Cloud Functions
   - Keep username/password system
   - Move verification server-side
   - Use proper password hashing (bcrypt)
   - Implement rate limiting
   - Return Custom Auth Tokens

3. **Option C**: Remove username/password entirely
   - Keep only Google and Email authentication
   - Both are secure and well-tested
   - Reduces codebase complexity

### Why Not Fixed Yet?
Per user request during refactoring, the username/password authentication system has been kept as-is to focus on other critical issues (ticket purchase permissions, UI improvements, code cleanup). The security trade-offs are acknowledged and documented here for future improvement.

## Other Security Considerations

### Firestore Security Rules
The application uses Firestore Security Rules to protect data access. Key rules:

1. **Users Collection**: Users can only read/write their own data
2. **Tickets Collection**: Users can only update tickets from "available" to "requested" status
3. **Admin Operations**: Many operations require admin privileges
4. **Authentication Required**: All collections require authentication

**Rules Location**: `/firestore.rules`

### Admin Privileges
- Admin status controlled by `isAdmin` field in user document
- Default admin can be set via `VITE_ADMIN_EMAIL` environment variable
- Admins should be carefully managed - they have full control

### Environment Variables
Sensitive configuration is stored in environment variables:
- Firebase API keys and config
- Admin email for default admin

**Important**: Never commit `.env` files to version control.

### Data Validation
- Client-side validation exists for user input
- Server-side validation via Firestore Security Rules
- Transaction-based ticket purchases prevent race conditions

## Reporting Security Issues
If you discover a security vulnerability in this application, please report it responsibly:
1. Do not open a public GitHub issue
2. Contact the project maintainers directly
3. Provide detailed information about the vulnerability
4. Allow time for the issue to be addressed before public disclosure

## Security Checklist for Production

Before deploying to production, ensure:

- [ ] Firestore Security Rules are deployed and tested
- [ ] Environment variables are properly configured
- [ ] Firebase project has authentication limits configured
- [ ] Anonymous auth cleanup strategy is in place
- [ ] Admin users are properly designated
- [ ] HTTPS is enforced for all connections
- [ ] Consider implementing proper password authentication (see recommendations above)
- [ ] Review and audit all Firestore Security Rules
- [ ] Test all authentication flows thoroughly
- [ ] Monitor Firebase console for suspicious activity

## Resources
- [Firebase Security Rules Documentation](https://firebase.google.com/docs/firestore/security/get-started)
- [OWASP Password Storage Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html)
- [Firebase Authentication Best Practices](https://firebase.google.com/docs/auth/security)
