# 🔐 Admin API Documentation

## 📋 **Overview**

The Admin API provides comprehensive management capabilities for the SMS
verification platform. All endpoints require admin authentication and are
prefixed with `/api/admin`.

## 🔑 **Authentication**

All admin endpoints require a valid admin JWT token in the Authorization header:

```http
Authorization: Bearer <admin_jwt_token>
```

## 📊 **System Statistics**

### **GET /api/admin/stats**

Get system overview statistics.

**Query Parameters:**

- `days` (optional): Number of days for statistics (default: 30)

**Response:**

```json
{
  "success": true,
  "data": {
    "totalUsers": 1250,
    "activeUsers": 980,
    "pendingUsers": 45,
    "suspendedUsers": 225,
    "totalRevenue": 15420.5,
    "monthlyRevenue": 1250.75,
    "totalTransactions": 3420,
    "pendingTransactions": 15,
    "systemHealth": "healthy",
    "uptime": 86400,
    "lastBackup": "2024-01-15T02:00:00Z"
  }
}
```

## 👥 **User Management**

### **GET /api/admin/users**

Get paginated list of users with filtering options.

**Query Parameters:**

- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 10)
- `status` (optional): Filter by user status
- `search` (optional): Search by username or email
- `dateFrom` (optional): Filter from date
- `dateTo` (optional): Filter to date

**Response:**

```json
{
  "success": true,
  "data": {
    "data": [
      {
        "id": 1,
        "username": "john_doe",
        "email": "john@example.com",
        "status": "active",
        "balance": 150.75,
        "total_recharged": 500.0,
        "total_spent": 349.25,
        "created_at": "2024-01-01T10:00:00Z",
        "last_login": "2024-01-15T14:30:00Z",
        "login_count": 45
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 10,
      "total": 1250,
      "pages": 125
    }
  }
}
```

### **GET /api/admin/users/:id**

Get detailed user information.

**Response:**

```json
{
  "success": true,
  "data": {
    "id": 1,
    "username": "john_doe",
    "email": "john@example.com",
    "phone": "+1234567890",
    "status": "active",
    "balance": 150.75,
    "total_recharged": 500.0,
    "total_spent": 349.25,
    "created_at": "2024-01-01T10:00:00Z",
    "last_login": "2024-01-15T14:30:00Z",
    "login_count": 45,
    "country": "US",
    "timezone": "America/New_York",
    "language": "en-US",
    "two_factor_enabled": false,
    "email_notifications": true,
    "sms_notifications": false,
    "push_notifications": true
  }
}
```

### **PUT /api/admin/users/:id/status**

Update user status.

**Request Body:**

```json
{
  "status": "suspended",
  "reason": "Violation of terms of service"
}
```

**Response:**

```json
{
  "success": true,
  "message": "User status updated successfully"
}
```

### **POST /api/admin/users/:id/balance**

Adjust user balance.

**Request Body:**

```json
{
  "amount": 50.0,
  "type": "add",
  "description": "Compensation for service issue"
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "old_balance": 150.75,
    "new_balance": 200.75,
    "adjustment": 50.0,
    "type": "add",
    "description": "Compensation for service issue"
  }
}
```

## 💰 **Transaction Management**

### **GET /api/admin/transactions**

Get paginated list of transactions.

**Query Parameters:**

- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 10)
- `type` (optional): Filter by transaction type
- `status` (optional): Filter by transaction status
- `userId` (optional): Filter by user ID
- `dateFrom` (optional): Filter from date
- `dateTo` (optional): Filter to date

**Response:**

```json
{
  "success": true,
  "data": {
    "data": [
      {
        "id": 1,
        "user_id": 1,
        "username": "john_doe",
        "type": "recharge",
        "amount": 100.0,
        "status": "completed",
        "description": "SafePing payment",
        "created_at": "2024-01-15T10:00:00Z",
        "payment_id": "f55e2fcd-8160-48e0-8645-385c2afdcb66"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 10,
      "total": 3420,
      "pages": 342
    }
  }
}
```

## ⚙️ **System Configuration**

### **GET /api/admin/config**

Get current system configuration.

**Response:**

```json
{
  "success": true,
  "data": {
    "platform_name": "SMS验证平台",
    "maintenance_mode": false,
    "registration_open": true,
    "email_verification": true,
    "login_fail_limit": 5,
    "session_timeout": 120,
    "password_min_length": 8,
    "force_2fa": false,
    "rate_limiting": {
      "enabled": true,
      "window_ms": 900000,
      "max_requests": 100
    },
    "email_settings": {
      "provider": "hostinger",
      "host": "smtp.hostinger.com",
      "port": 587
    },
    "payment_settings": {
      "safeping_enabled": true,
      "webhook_secret": "configured"
    }
  }
}
```

### **PUT /api/admin/config**

Update system configuration.

**Request Body:**

```json
{
  "platform_name": "SMS Verification Platform",
  "maintenance_mode": false,
  "registration_open": true,
  "email_verification": true,
  "login_fail_limit": 5,
  "session_timeout": 120,
  "password_min_length": 8,
  "force_2fa": false
}
```

**Response:**

```json
{
  "success": true,
  "message": "Configuration updated successfully"
}
```

## 📝 **System Logs**

### **GET /api/admin/logs**

Get system logs with filtering.

**Query Parameters:**

- `level` (optional): Log level (error, warn, info, debug)
- `days` (optional): Number of days to look back
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 50)
- `search` (optional): Search in log messages

**Response:**

```json
{
  "success": true,
  "data": {
    "data": [
      {
        "timestamp": "2024-01-15T15:30:00Z",
        "level": "info",
        "message": "User john_doe logged in successfully",
        "user_id": 1,
        "ip_address": "192.168.1.100",
        "user_agent": "Mozilla/5.0...",
        "metadata": {
          "action": "login",
          "status": "success"
        }
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 50,
      "total": 1250,
      "pages": 25
    }
  }
}
```

## 📊 **Analytics & Reports**

### **GET /api/admin/analytics/revenue**

Get revenue analytics.

**Query Parameters:**

- `period` (optional): Period (daily, weekly, monthly, yearly)
- `start_date` (optional): Start date
- `end_date` (optional): End date

**Response:**

```json
{
  "success": true,
  "data": {
    "total_revenue": 15420.5,
    "period_revenue": 1250.75,
    "transaction_count": 3420,
    "average_transaction": 4.51,
    "top_users": [
      {
        "user_id": 1,
        "username": "john_doe",
        "total_spent": 349.25
      }
    ],
    "revenue_by_type": {
      "recharge": 12000.0,
      "purchase": 3420.5
    },
    "daily_revenue": [
      {
        "date": "2024-01-15",
        "revenue": 125.5,
        "transactions": 28
      }
    ]
  }
}
```

### **GET /api/admin/analytics/users**

Get user analytics.

**Query Parameters:**

- `period` (optional): Period (daily, weekly, monthly, yearly)

**Response:**

```json
{
  "success": true,
  "data": {
    "total_users": 1250,
    "active_users": 980,
    "new_users": 45,
    "user_growth_rate": 3.7,
    "retention_rate": 78.4,
    "users_by_status": {
      "active": 980,
      "pending": 45,
      "suspended": 225
    },
    "users_by_country": {
      "US": 450,
      "CN": 320,
      "JP": 180
    },
    "daily_registrations": [
      {
        "date": "2024-01-15",
        "registrations": 12
      }
    ]
  }
}
```

## 🔒 **Security Management**

### **GET /api/admin/security/overview**

Get security overview.

**Response:**

```json
{
  "success": true,
  "data": {
    "failed_logins": 25,
    "suspicious_ips": 3,
    "locked_accounts": 8,
    "recent_breaches": 0,
    "security_score": 85,
    "recommendations": [
      "Enable 2FA for all admin accounts",
      "Review failed login attempts",
      "Update SSL certificates"
    ]
  }
}
```

### **POST /api/admin/security/ban-ip**

Ban IP address.

**Request Body:**

```json
{
  "ip_address": "192.168.1.100",
  "reason": "Multiple failed login attempts",
  "duration_hours": 24
}
```

**Response:**

```json
{
  "success": true,
  "message": "IP address banned successfully"
}
```

## 🗄️ **Database Management**

### **POST /api/admin/database/backup**

Create database backup.

**Request Body:**

```json
{
  "backup_type": "full",
  "include_logs": true,
  "compression": true
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "backup_id": "backup_20240115_153000",
    "file_path": "/var/backups/sms-verify/backup_20240115_153000.sql.gz",
    "size_mb": 45.2,
    "estimated_time": "2 minutes"
  }
}
```

### **GET /api/admin/database/backups**

Get list of available backups.

**Response:**

```json
{
  "success": true,
  "data": [
    {
      "id": "backup_20240115_153000",
      "created_at": "2024-01-15T15:30:00Z",
      "size_mb": 45.2,
      "type": "full",
      "status": "completed"
    }
  ]
}
```

## 📧 **Notification Management**

### **POST /api/admin/notifications/send**

Send system notification.

**Request Body:**

```json
{
  "type": "announcement",
  "title": "System Maintenance",
  "message": "Scheduled maintenance on January 20th",
  "target_users": "all",
  "priority": "medium",
  "scheduled_at": "2024-01-20T02:00:00Z"
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "notification_id": "notif_20240115_153000",
    "recipients": 1250,
    "scheduled": true
  }
}
```

## 🚀 **System Operations**

### **POST /api/admin/system/restart**

Restart system services.

**Request Body:**

```json
{
  "services": ["backend", "websocket"],
  "reason": "Configuration update"
}
```

**Response:**

```json
{
  "success": true,
  "message": "Services restart initiated"
}
```

### **GET /api/admin/system/health**

Get detailed system health status.

**Response:**

```json
{
  "success": true,
  "data": {
    "overall_status": "healthy",
    "services": {
      "database": {
        "status": "healthy",
        "response_time": 15,
        "connections": 8
      },
      "redis": {
        "status": "healthy",
        "memory_usage": "45%",
        "connected_clients": 12
      },
      "websocket": {
        "status": "healthy",
        "connected_users": 45,
        "uptime": 86400
      }
    },
    "system_resources": {
      "cpu_usage": 23.5,
      "memory_usage": 67.2,
      "disk_usage": 45.8,
      "network_io": "1.2 MB/s"
    }
  }
}
```

## 📊 **Error Codes**

| Code                       | Description                       |
| -------------------------- | --------------------------------- |
| `ADMIN_UNAUTHORIZED`       | Admin authentication required     |
| `INSUFFICIENT_PERMISSIONS` | Admin permissions insufficient    |
| `USER_NOT_FOUND`           | User not found                    |
| `INVALID_STATUS`           | Invalid user status               |
| `INVALID_AMOUNT`           | Invalid balance adjustment amount |
| `BACKUP_FAILED`            | Database backup failed            |
| `SERVICE_UNAVAILABLE`      | Service temporarily unavailable   |

## 🔐 **Admin Role Requirements**

To access admin endpoints, users must have:

- Valid admin JWT token
- Admin role in the system
- Active account status
- Required permissions for specific operations

## 📝 **Rate Limiting**

Admin endpoints have higher rate limits than regular user endpoints:

- **Default**: 1000 requests per 15 minutes
- **Configurable**: Can be adjusted via system configuration
- **Exemptions**: Health checks and critical operations

## 🚨 **Security Considerations**

1. **Admin tokens** should have shorter expiration times
2. **IP whitelisting** recommended for admin access
3. **Audit logging** for all admin operations
4. **Two-factor authentication** required for admin accounts
5. **Session management** with automatic logout on inactivity

---

**🔐 Admin API Documentation Complete!**
