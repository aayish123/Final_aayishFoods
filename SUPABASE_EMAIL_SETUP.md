# Supabase Email Template Configuration for Password Reset

## Problem
By default, Supabase sends "magic links" that automatically sign users in. We want to send proper password reset links that redirect to a form where users can enter a new password.

## Solution
Configure the email template to use `{{ .TokenHash }}` instead of `{{ .ConfirmationURL }}`.

## Steps to Configure:

### 1. Go to Supabase Dashboard
- Open your Supabase project dashboard
- Go to **Authentication** → **Email Templates**

### 2. Edit the "Confirm recovery" template
- Find the "Confirm recovery" email template
- Look for the current button/link that probably looks like:
```html
<a href="{{ .ConfirmationURL }}">Reset Password</a>
```

### 3. Replace with Token-Based Link
Replace the link with:
```html
<a href="{{ .SiteURL }}/reset-password?token={{ .TokenHash }}&type=recovery">Reset Your Password</a>
```

### 4. Complete Email Template Example
Here's a complete email template you can use:

```html
<h2>Reset your password</h2>
<p>Follow this link to reset the password for your user:</p>
<p><a href="{{ .SiteURL }}/reset-password?token={{ .TokenHash }}&type=recovery">Reset Your Password</a></p>
<p>Or copy and paste the URL into your browser:</p>
<p>{{ .SiteURL }}/reset-password?token={{ .TokenHash }}&type=recovery</p>
<p>If you didn't request this password reset, you can safely ignore this email.</p>
```

### 5. Set Site URL
Make sure your **Site URL** is configured correctly in:
- **Authentication** → **URL Configuration** → **Site URL**
- Set it to: `http://localhost:5173` (for development) or your production domain

### 6. Add Redirect URLs
In **Authentication** → **URL Configuration** → **Redirect URLs**, add:
- `http://localhost:5173/reset-password`
- Your production URL + `/reset-password`

## How It Works After Configuration:

1. **User requests password reset** → Enters email in auth modal
2. **Supabase sends email** with token-based link (not magic link)
3. **User clicks link** → Goes to `/reset-password?token=xxx&type=recovery`
4. **PasswordReset page** verifies the token using `supabase.auth.verifyOtp()`
5. **User enters new password** → Updates password while authenticated
6. **User is redirected to sign in** → Clean flow completed

## Key Differences:
- ❌ **Before:** `{{ .ConfirmationURL }}` = Magic link (auto sign-in)
- ✅ **After:** `{{ .TokenHash }}` = Reset token (requires verification)

## Testing:
1. Request password reset from your app
2. Check email - link should go to `/reset-password?token=...`
3. Click link - should show password reset form (not auto sign-in)
4. Enter new password - should update successfully
5. Sign in with new password - should work
