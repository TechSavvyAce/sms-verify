# Database Schema Guide

## Overview

This directory contains the complete database schema for the SMS verification
platform with multi-verification support.

## Main Schema File

### `sms_verify.sql`

**Purpose**: Complete database schema including all tables, views, and stored
procedures for the multi-verification system.

**Key Features**:

- **Multi-Verification Support**: Email and SMS (phone) verification
- **Optional Passwords**: Users can register without passwords and set them
  later
- **Flexible Authentication**: Support for password-based and verification
  code-based login
- **Comprehensive User Management**: Extended user profiles with preferences and
  settings

## Database Structure

### Core Tables

1. **`users`** - User accounts with multi-verification support
2. **`activations`** - SMS activation services
3. **`rentals`** - Phone number rental services
4. **`transactions`** - Financial transactions
5. **`api_keys`** - User API key management
6. **`system_config`** - System configuration
7. **`user_activity_logs`** - User activity tracking

### Multi-Verification Fields in Users Table

The `users` table now includes:

- **Phone Verification**:
  - `phone` - Phone number (optional, unique)
  - `phone_verified` - Verification status
  - `phone_verified_at` - Verification timestamp

- **User Preferences**:
  - `country` - User's country
  - `timezone` - User's timezone
  - `language` - Language preference (default: zh-CN)
  - `avatar` - Profile picture URL
  - `two_factor_enabled` - 2FA status
  - `email_notifications` - Email notification settings
  - `sms_notifications` - SMS notification settings
  - `push_notifications` - Push notification settings

- **Flexible Authentication**:
  - `email` - Email address (optional, unique)
  - `password_hash` - Password hash (optional)

## How to Use

### Option 1: Fresh Database Setup

1. **Create a new database**:

   ```sql
   CREATE DATABASE sms_verify CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
   ```

2. **Import the complete schema**:
   ```bash
   mysql -u your_username -p sms_verify < sms_verify.sql
   ```

### Option 2: Update Existing Database

If you have an existing database and want to add multi-verification support:

1. **Backup your current database**:

   ```bash
   mysqldump -u your_username -p your_database > backup.sql
   ```

2. **Import the new schema** (this will recreate all tables):
   ```bash
   mysql -u your_username -p your_database < sms_verify.sql
   ```

## Verification

After importing the schema, verify the setup:

```sql
-- Check the users table structure
DESCRIBE users;

-- Check if multi-verification columns exist
SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_DEFAULT, COLUMN_COMMENT
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_SCHEMA = 'sms_verify'
AND TABLE_NAME = 'users'
AND COLUMN_NAME IN ('phone', 'phone_verified')
ORDER BY ORDINAL_POSITION;

-- Check indexes
SHOW INDEX FROM users;
```

## Features

### Multi-Verification Registration

- Users can register with email or phone
- Each verification method is optional
- Usernames are auto-generated based on verification method

### Flexible Login

- Traditional password-based login
- SMS verification code login
- Email verification code login

- Auto-registration for new users

### Enhanced User Profiles

- Optional password setting after registration
- User preferences and settings
- Notification preferences
- Two-factor authentication support

## Security Features

- **Unique Constraints**: Email and phone are unique
- **Indexed Fields**: Performance optimization for verification queries
- **Audit Logging**: User activity tracking
- **API Key Management**: Secure API access

## Next Steps

After setting up the database:

1. **Configure Environment Variables**:
   - Database connection settings
   - Email service configuration
   - SMS service configuration

2. **Start Your Application**:
   - The backend will automatically use the new schema
   - Test registration with different verification methods
   - Test login with verification codes

3. **Monitor and Optimize**:
   - Check database performance
   - Monitor user registration patterns
   - Optimize indexes if needed

## Troubleshooting

### Common Issues

1. **Import Errors**:
   - Ensure MySQL version compatibility (5.7+ recommended)
   - Check character set and collation settings
   - Verify database user privileges

2. **Duplicate Entry Errors**:
   - The schema includes unique constraints
   - Ensure no duplicate emails or phones

3. **Performance Issues**:
   - All necessary indexes are included
   - Monitor query performance and add indexes if needed

### Getting Help

If you encounter issues:

1. Check the MySQL error logs
2. Verify your database connection settings
3. Ensure you have the necessary database privileges
4. Test with a fresh database first

## Notes

- This schema is designed for production use
- All tables use InnoDB engine for transaction support
- UTF8MB4 character set for full Unicode support
- Foreign key constraints ensure data integrity
- Stored procedures provide safe schema modification utilities
