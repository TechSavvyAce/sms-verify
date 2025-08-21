# Profile Page Features

## Overview

The Profile page is a comprehensive, production-ready user profile management
system with multiple tabs and advanced functionality.

## Features

### 1. Personal Overview Tab

- **Profile Header**: Large avatar display with username, status tags, and
  action buttons
- **Statistics Cards**: Balance, total spent, total recharged, and login count
- **Account Progress**: Visual progress indicators for account status, 2FA, and
  avatar setup
- **Quick Actions**: Edit profile and change avatar buttons

### 2. Personal Profile Tab

- **View Mode**: Detailed profile information in a clean descriptions layout
- **Edit Mode**: Comprehensive form with validation for:
  - Username and email
  - Phone number
  - Country/region selection
  - Timezone selection
  - Language preference
  - Avatar upload with preview

### 3. Security Settings Tab

- **Two-Factor Authentication**: Status display and management button
- **Login Security**: Password change history, failed attempts, trusted devices
- **API Keys**: Count and management
- **Notification Preferences**: Toggle switches for email, SMS, and push
  notifications

### 4. Activity Records Tab

- **Timeline View**: Chronological display of user activities
- **Activity Types**: Login, profile updates, password changes, payments
- **Status Indicators**: Color-coded success/failed/warning statuses
- **Detailed Information**: IP addresses, timestamps, and descriptions

## Technical Implementation

### Frontend Components

- **React Hooks**: useState, useEffect, useRef for state management
- **Ant Design**: Comprehensive UI components (Cards, Tabs, Forms, etc.)
- **TypeScript**: Strong typing with interfaces for UserProfile, ActivityLog,
  SecuritySettings
- **Form Handling**: Ant Design Form with validation and submission

### Backend API Endpoints

- `GET /api/user/profile` - Get user profile
- `PUT /api/user/profile` - Update user profile
- `GET /api/user/activity-logs` - Get activity logs
- `GET /api/user/security-settings` - Get security settings
- `PUT /api/user/notifications` - Update notification preferences
- `PUT /api/user/avatar` - Update avatar

### Database Schema

The User model includes new fields:

- `phone`, `country`, `timezone`, `language` - Profile information
- `avatar` - Profile picture URL
- `two_factor_enabled` - 2FA status
- `email_notifications`, `sms_notifications`, `push_notifications` -
  Notification preferences

## Usage Instructions

### For Users

1. **View Profile**: Navigate to Profile page to see overview
2. **Edit Information**: Click "Edit Profile" button to modify details
3. **Upload Avatar**: Use the avatar upload area to change profile picture
4. **Manage Security**: Configure 2FA and notification preferences
5. **Monitor Activity**: Review account activity and security events

### For Developers

1. **Database Migration**: Run `node scripts/migrate-user-profile.js` to add new
   fields
2. **API Testing**: Use the provided endpoints for integration testing
3. **Customization**: Modify the ProfilePage component to add new features
4. **Styling**: Update CSS classes and Ant Design theme for branding

## Security Features

- **Input Validation**: Server-side validation for all profile updates
- **Activity Logging**: Comprehensive audit trail for user actions
- **Permission Checks**: Authentication required for all profile operations
- **Data Sanitization**: Proper handling of user input and file uploads

## Future Enhancements

- **Profile Completion Score**: Gamification of profile setup
- **Advanced 2FA**: Support for hardware tokens and authenticator apps
- **Profile Templates**: Predefined profile configurations
- **Social Integration**: Connect with social media accounts
- **Profile Analytics**: Usage statistics and insights

## Troubleshooting

### Common Issues

1. **Avatar Upload Fails**: Check file size and format restrictions
2. **Profile Update Errors**: Verify required fields and validation rules
3. **Activity Logs Empty**: Ensure backend logging is properly configured
4. **Notification Toggles Not Working**: Check API endpoint permissions

### Debug Mode

Enable debug logging in the browser console to see API calls and responses.

## Performance Considerations

- **Lazy Loading**: Activity logs are loaded on demand
- **Image Optimization**: Avatar images are optimized for web display
- **Caching**: Profile data is cached in local state
- **Debounced Updates**: Form submissions are debounced to prevent spam
