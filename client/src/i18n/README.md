# Internationalization (i18n) Implementation

This document describes the internationalization implementation for the SMS
Verification Platform.

## Overview

The application now supports both Chinese (Simplified) and English languages
with professional URL routing and seamless language switching.

## Features

- ✅ **Dual Language Support**: Chinese (zh-CN) and English (en-US)
- ✅ **URL-based Language Routing**: `/zh-CN/dashboard`, `/en-US/dashboard`
- ✅ **Language Switcher Component**: Easy language switching in the header
- ✅ **Automatic Language Detection**: Detects user's preferred language
- ✅ **Persistent Language Selection**: Remembers user's choice
- ✅ **Professional UI**: All text properly translated and localized
- ✅ **Antd Component Localization**: Date pickers, forms, etc. properly
  localized

## File Structure

```
client/src/i18n/
├── index.ts                 # i18n configuration
├── locales/
│   ├── zh-CN.json          # Chinese translations
│   └── en-US.json          # English translations
└── README.md               # This file

client/src/contexts/
└── LanguageContext.tsx     # Language context and provider

client/src/components/Common/
└── LanguageSwitcher.tsx    # Language switching component
```

## URL Structure

- **Chinese**: `https://yourdomain.com/zh-CN/dashboard`
- **English**: `https://yourdomain.com/en-US/dashboard`
- **Default**: Root URL redirects to Chinese (`/zh-CN`)

## Usage

### Using Translations in Components

```tsx
import { useTranslation } from "react-i18next";

const MyComponent = () => {
  const { t } = useTranslation();

  return (
    <div>
      <h1>{t("common.title")}</h1>
      <p>{t("common.description")}</p>
      <p>{t("common.welcome", { name: "John" })}</p>
    </div>
  );
};
```

### Language Switching

The language switcher is automatically included in the header. Users can click
the globe icon to switch languages.

### Adding New Translations

1. Add the key-value pair to both `zh-CN.json` and `en-US.json`
2. Use the key in your component with `t('your.key')`

Example:

```json
// zh-CN.json
{
  "newFeature": {
    "title": "新功能",
    "description": "这是一个新功能"
  }
}

// en-US.json
{
  "newFeature": {
    "title": "New Feature",
    "description": "This is a new feature"
  }
}
```

## Translation Keys Structure

The translations are organized into logical groups:

- `common.*` - Common UI elements (buttons, labels, etc.)
- `navigation.*` - Navigation menu items
- `auth.*` - Authentication related text
- `dashboard.*` - Dashboard page content
- `services.*` - Service-related content
- `profile.*` - Profile page content
- `header.*` - Header component text
- `sidebar.*` - Sidebar component text
- `errors.*` - Error messages
- `status.*` - Status indicators
- `time.*` - Time-related text
- `currency.*` - Currency formatting
- `validation.*` - Form validation messages

## Technical Implementation

### i18n Configuration

The i18n system is configured with:

- **Language Detection**: Automatic detection from URL, localStorage, browser
  settings
- **Fallback Language**: Chinese (zh-CN) as default
- **Namespace**: Single 'translation' namespace for simplicity
- **Interpolation**: Support for variable interpolation in translations

### Language Context

The `LanguageContext` provides:

- Current language state
- Language switching function
- Available languages list
- URL-based language routing

### Component Updates

All major components have been updated to use translation keys:

- AppHeader
- AppSidebar
- LoginPage
- DashboardPage
- And many more...

## Browser Support

- Modern browsers with ES6+ support
- LocalStorage for language persistence
- URL routing with React Router

## Performance

- Translations are loaded statically (no dynamic loading)
- Minimal bundle size impact
- Fast language switching
- Cached translations in localStorage

## Future Enhancements

- [ ] Add more languages (Japanese, Korean, etc.)
- [ ] RTL language support
- [ ] Dynamic translation loading
- [ ] Translation management system
- [ ] Pluralization support
- [ ] Date/time formatting per locale

## Maintenance

To maintain the translation system:

1. **Keep translations in sync**: When adding new features, update both language
   files
2. **Use consistent key naming**: Follow the established naming convention
3. **Test both languages**: Always test the application in both languages
4. **Review translations**: Have native speakers review translations for
   accuracy

## Troubleshooting

### Common Issues

1. **Missing translations**: Check if the key exists in both language files
2. **URL not updating**: Ensure the LanguageContext is properly wrapping the app
3. **Language not persisting**: Check localStorage permissions
4. **Antd components not localized**: Verify the ConfigProvider has the correct
   locale

### Debug Mode

Enable debug mode by setting `debug: true` in the i18n configuration to see
translation keys in the console.
