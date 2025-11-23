# Debug Login Issues

Run this query to check your user account type:

```sql
SELECT
    id,
    email,
    display_name,
    CASE
        WHEN password IS NOT NULL AND password_salt IS NOT NULL THEN 'Password Auth'
        WHEN google_id IS NOT NULL THEN 'Google OAuth Only'
        ELSE 'Unknown'
    END as auth_type
FROM users
WHERE email = 'YOUR_EMAIL_HERE';
```

## Common Issues:

1. **Google OAuth Account**: If you signed up with Google, you can't use password login
   - The error will be: "This account uses Google login"
2. **No Password Set**: Account exists but has no password
   - The error will be: "Invalid credentials"

## Solutions:

### Option 1: Use Google OAuth in Postman

See existing collection: `souschef-ocr.postman_collection.json` for Google OAuth flow

### Option 2: Create a password-based test account

Use the registration endpoint to create a new account with email/password

### Option 3: Add password to existing Google account (requires custom endpoint)

Not currently supported - would need to add a "set password" endpoint

## Test the login endpoint directly:

```powershell
curl.exe -X POST https://souschef-api-238603140451.us-central1.run.app/auth/login `
  -H "Content-Type: application/json" `
  -d '{"email":"test@example.com","password":"testpass123"}'
```
