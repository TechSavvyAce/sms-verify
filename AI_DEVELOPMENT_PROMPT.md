# 🚀 Complete SMS Middleware Platform Development Prompt

## 🎯 Project Overview

Create a comprehensive SMS middleware platform that acts as a bridge between SMS-Activate.io API and Chinese users. The platform should provide SMS activation and phone number rental services with a focus on scalability, real-time status management, and excellent user experience.

## 🏗️ System Architecture Requirements

### **Core Business Logic**

- **Middleware Concept**: We are NOT the SMS provider - we're a middleware connecting users to SMS-Activate.io
- **Multi-user Support**: One API key serves thousands of users simultaneously
- **Real-time Status Management**: Flexible status tracking for all operations
- **Chinese Market Focus**: All UI/UX optimized for Chinese users
- **Scalable Architecture**: Handle high concurrent users with single API integration

## 📋 Detailed Requirements

### **1. Backend Architecture (Node.js + Express + MySQL)**

#### **Database Schema Design**

```sql
-- Users table with comprehensive tracking
CREATE TABLE users (
  id INT PRIMARY KEY AUTO_INCREMENT,
  username VARCHAR(50) UNIQUE NOT NULL,
  email VARCHAR(100) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  balance DECIMAL(10,2) DEFAULT 0.00,
  total_spent DECIMAL(10,2) DEFAULT 0.00,
  total_recharged DECIMAL(10,2) DEFAULT 0.00,
  status ENUM('active', 'suspended', 'pending') DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  last_login TIMESTAMP NULL,
  login_count INT DEFAULT 0
);

-- SMS Activations with comprehensive tracking
CREATE TABLE activations (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT NOT NULL,
  activation_id VARCHAR(50) NOT NULL, -- SMS-Activate ID
  service VARCHAR(50) NOT NULL,
  country_id INT NOT NULL,
  phone_number VARCHAR(20),
  cost DECIMAL(8,4) NOT NULL,
  status ENUM('0','1','3','6','8') DEFAULT '0', -- SMS-Activate status codes
  sms_code VARCHAR(20) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  expires_at TIMESTAMP NULL,
  last_check_at TIMESTAMP NULL,
  check_count INT DEFAULT 0,
  FOREIGN KEY (user_id) REFERENCES users(id),
  INDEX idx_user_status (user_id, status),
  INDEX idx_activation_id (activation_id),
  INDEX idx_expires_at (expires_at)
);

-- Phone Number Rentals
CREATE TABLE rentals (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT NOT NULL,
  rental_id VARCHAR(50) NOT NULL, -- SMS-Activate rental ID
  service VARCHAR(50) NOT NULL,
  country_id INT NOT NULL,
  phone_number VARCHAR(20),
  cost DECIMAL(8,4) NOT NULL,
  duration_hours INT NOT NULL,
  status ENUM('active', 'expired', 'cancelled') DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP NOT NULL,
  last_check_at TIMESTAMP NULL,
  sms_received JSON NULL, -- Store multiple SMS messages
  FOREIGN KEY (user_id) REFERENCES users(id),
  INDEX idx_user_status (user_id, status),
  INDEX idx_rental_id (rental_id),
  INDEX idx_expires_at (expires_at)
);

-- Transaction logging for financial tracking
CREATE TABLE transactions (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT NOT NULL,
  type ENUM('recharge', 'activation', 'rental', 'refund') NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  balance_before DECIMAL(10,2) NOT NULL,
  balance_after DECIMAL(10,2) NOT NULL,
  reference_id VARCHAR(100) NULL, -- activation_id or rental_id
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id),
  INDEX idx_user_type (user_id, type),
  INDEX idx_created_at (created_at)
);

-- System configuration and API management
CREATE TABLE system_config (
  id INT PRIMARY KEY AUTO_INCREMENT,
  config_key VARCHAR(100) UNIQUE NOT NULL,
  config_value TEXT NOT NULL,
  description TEXT,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Rate limiting and user activity tracking
CREATE TABLE user_activity_logs (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT NOT NULL,
  action VARCHAR(100) NOT NULL,
  ip_address VARCHAR(45),
  user_agent TEXT,
  details JSON,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id),
  INDEX idx_user_created (user_id, created_at),
  INDEX idx_action_created (action, created_at)
);
```

#### **Core Backend Services**

**1. SMS-Activate Integration Service**

```javascript
class SMSActivateService {
  constructor() {
    this.apiKey = process.env.SMS_ACTIVATE_API_KEY;
    this.baseURL = "https://sms-activate.io/stubs/handler_api.php";
    this.rateLimiter = new RateLimiter(100, 60000); // 100 requests per minute
  }

  // Get available services with caching
  async getServices() {
    // Implement caching (Redis recommended)
    // Handle rate limiting
    // Parse and format for Chinese users
  }

  // Get countries for specific service
  async getCountriesForService(service) {
    // Real-time availability checking
    // Price calculation with markup
    // Chinese country name mapping
  }

  // Purchase activation number
  async purchaseActivation(service, country, operator = null) {
    // Balance checking before purchase
    // Transaction logging
    // Error handling with user-friendly messages
  }

  // Check SMS status with intelligent polling
  async checkActivationStatus(activationId) {
    // Implement exponential backoff
    // Handle all SMS-Activate status codes
    // Update local database
  }

  // Rent phone number
  async rentPhoneNumber(service, country, time) {
    // Duration validation
    // Cost calculation
    // Rental tracking setup
  }

  // Cancel activation/rental with refund logic
  async cancelOperation(id, type) {
    // Refund calculation
    // Status updates
    // Transaction recording
  }
}
```

**2. User Balance Management Service**

```javascript
class BalanceService {
  // Atomic balance operations
  async deductBalance(userId, amount, reference, description) {
    // Database transaction
    // Balance validation
    // Transaction logging
  }

  async addBalance(userId, amount, reference, description) {
    // Recharge processing
    // Transaction logging
    // Balance updates
  }

  // Real-time balance checking
  async getUserBalance(userId) {
    // Fresh balance calculation
    // Pending transaction consideration
  }
}
```

**3. Real-time Status Management Service**

```javascript
class StatusManagerService {
  constructor() {
    this.checkQueue = new Queue("status-checks");
    this.setupScheduledTasks();
  }

  // Intelligent status checking
  async scheduleStatusCheck(activationId, priority = "normal") {
    // Queue-based checking
    // Priority handling
    // Rate limiting per user
  }

  // Bulk status updates
  async checkMultipleActivations(activationIds) {
    // Batch processing
    // Concurrent API calls with limits
    // Database bulk updates
  }

  // Cleanup expired operations
  async cleanupExpiredOperations() {
    // Find expired activations/rentals
    // Process refunds
    // Update statuses
  }
}
```

**4. User Activity and Analytics Service**

```javascript
class AnalyticsService {
  // Track user behavior
  async logUserActivity(userId, action, details) {
    // Activity logging
    // Rate limiting detection
    // Suspicious activity flagging
  }

  // Generate user statistics
  async getUserStats(userId) {
    // Success rates
    // Spending patterns
    // Service preferences
  }

  // System-wide analytics
  async getSystemStats() {
    // Revenue tracking
    // Service popularity
    // User growth metrics
  }
}
```

#### **API Endpoints Structure**

**Authentication & User Management**

- `POST /api/auth/register` - User registration with email verification
- `POST /api/auth/login` - JWT-based authentication
- `POST /api/auth/refresh` - Token refresh
- `GET /api/user/profile` - User profile with statistics
- `PUT /api/user/profile` - Profile updates
- `GET /api/user/balance` - Real-time balance
- `GET /api/user/transactions` - Transaction history with pagination

**SMS Services**

- `GET /api/services` - Available services with Chinese names
- `GET /api/countries/:service` - Countries for service with real-time pricing
- `POST /api/activations` - Purchase SMS activation
- `GET /api/activations` - User's activations with real-time status
- `GET /api/activations/:id/status` - Check specific activation
- `POST /api/activations/:id/cancel` - Cancel activation with refund

**Rental Services**

- `POST /api/rentals` - Rent phone number
- `GET /api/rentals` - User's rentals with SMS history
- `GET /api/rentals/:id/sms` - Get SMS messages for rental
- `POST /api/rentals/:id/cancel` - Cancel rental with refund

**Financial Operations**

- `POST /api/recharge` - Balance recharge (integration with payment gateways)
- `GET /api/pricing` - Current pricing with markup
- `POST /api/withdraw` - Balance withdrawal (if supported)

**System & Analytics**

- `GET /api/stats/user` - User statistics and insights
- `GET /api/system/status` - System health and API status

### **2. Frontend Architecture (React + TypeScript)**

#### **Component Structure**

```
src/
├── components/
│   ├── common/
│   │   ├── Header.tsx
│   │   ├── Sidebar.tsx
│   │   ├── LoadingSpinner.tsx
│   │   ├── StatusBadge.tsx
│   │   └── PriceDisplay.tsx
│   ├── auth/
│   │   ├── LoginForm.tsx
│   │   ├── RegisterForm.tsx
│   │   └── ProfileSettings.tsx
│   ├── services/
│   │   ├── ServiceSelector.tsx
│   │   ├── CountrySelector.tsx
│   │   ├── ActivationCard.tsx
│   │   └── RentalCard.tsx
│   ├── dashboard/
│   │   ├── BalanceWidget.tsx
│   │   ├── QuickStats.tsx
│   │   ├── RecentActivity.tsx
│   │   └── ActiveNumbers.tsx
│   └── financial/
│       ├── RechargeModal.tsx
│       ├── TransactionHistory.tsx
│       └── PricingTable.tsx
├── pages/
│   ├── Dashboard.tsx
│   ├── GetNumber.tsx
│   ├── RentNumber.tsx
│   ├── History.tsx
│   ├── Recharge.tsx
│   └── Profile.tsx
├── hooks/
│   ├── useAuth.ts
│   ├── useBalance.ts
│   ├── useServices.ts
│   ├── useActivations.ts
│   ├── useRentals.ts
│   └── useRealTimeUpdates.ts
├── services/
│   ├── api.ts
│   ├── websocket.ts
│   ├── statusManager.ts
│   └── priceCalculator.ts
├── utils/
│   ├── formatters.ts
│   ├── validators.ts
│   ├── constants.ts
│   └── helpers.ts
└── types/
    ├── user.ts
    ├── services.ts
    ├── activations.ts
    └── api.ts
```

#### **Key Frontend Features**

**Real-time Updates System**

```typescript
// Custom hook for real-time status updates
const useRealTimeUpdates = () => {
  const [activations, setActivations] = useState([]);
  const [rentals, setRentals] = useState([]);

  useEffect(() => {
    // WebSocket connection for real-time updates
    const ws = new WebSocket(WS_URL);

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      handleRealTimeUpdate(data);
    };

    // Polling fallback
    const pollInterval = setInterval(() => {
      checkPendingOperations();
    }, 30000);

    return () => {
      ws.close();
      clearInterval(pollInterval);
    };
  }, []);
};
```

**Intelligent Service Selection**

```typescript
// Service selector with search, filtering, and pricing
const ServiceSelector = () => {
  const [services, setServices] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");

  // Real-time price updates
  // Service availability checking
  // Chinese service name mapping
  // Popular services highlighting
};
```

**Balance Management Interface**

```typescript
// Real-time balance display with transaction history
const BalanceWidget = () => {
  const { balance, isLoading } = useBalance();
  const [showRechargeModal, setShowRechargeModal] = useState(false);

  // Real-time balance updates
  // Quick recharge options
  // Spending analytics
  // Low balance warnings
};
```

### **3. Admin Panel Architecture**

#### **Admin Dashboard Features**

- **User Management**: User list, status changes, balance adjustments
- **System Monitoring**: API status, error rates, performance metrics
- **Financial Overview**: Revenue tracking, refund management, pricing control
- **Service Management**: Service availability, pricing markup configuration
- **Analytics Dashboard**: User behavior, service popularity, system health

#### **Admin API Endpoints**

- `GET /api/admin/users` - User management with search and filters
- `PUT /api/admin/users/:id/status` - User status management
- `POST /api/admin/users/:id/balance` - Manual balance adjustments
- `GET /api/admin/system/stats` - System-wide statistics
- `GET /api/admin/financial/overview` - Financial dashboard data
- `PUT /api/admin/config/:key` - System configuration updates

### **4. Technical Implementation Details**

#### **Rate Limiting Strategy**

```javascript
// Multi-level rate limiting
const rateLimitConfig = {
  global: { requests: 1000, window: 60000 }, // 1000 req/min globally
  perUser: { requests: 100, window: 60000 }, // 100 req/min per user
  smsActivate: { requests: 90, window: 60000 }, // SMS-Activate API limits
  statusCheck: { requests: 30, window: 60000 }, // Status check limits
};
```

#### **Caching Strategy**

```javascript
// Redis-based caching for performance
const cacheConfig = {
  services: { ttl: 3600 }, // 1 hour
  countries: { ttl: 1800 }, // 30 minutes
  prices: { ttl: 300 }, // 5 minutes
  userBalance: { ttl: 60 }, // 1 minute
};
```

#### **Error Handling & Monitoring**

```javascript
// Comprehensive error tracking
class ErrorHandler {
  static handleSMSActivateError(error) {
    // Map SMS-Activate errors to user-friendly Chinese messages
    // Log for monitoring
    // Trigger alerts for critical errors
  }

  static handleUserError(error, userId) {
    // User-specific error logging
    // Rate limiting on repeated errors
    // Automatic support ticket creation
  }
}
```

#### **Security Implementation**

- **JWT Authentication**: Secure token-based auth with refresh tokens
- **Input Validation**: Comprehensive validation using Joi
- **SQL Injection Prevention**: Parameterized queries with Sequelize ORM
- **Rate Limiting**: Multiple layers of rate limiting
- **API Key Security**: Encrypted storage of SMS-Activate API key
- **User Activity Monitoring**: Suspicious activity detection

#### **Performance Optimization**

- **Database Indexing**: Optimized indexes for common queries
- **Connection Pooling**: Efficient database connection management
- **Background Jobs**: Queue-based processing for heavy operations
- **CDN Integration**: Static asset optimization
- **Response Compression**: Gzip compression for API responses

### **5. Deployment & Infrastructure**

#### **Production Environment**

- **Server**: Ubuntu 20.04 LTS with Node.js 18+
- **Database**: MySQL 8.0 with optimized configuration
- **Cache**: Redis for session storage and caching
- **Queue**: Redis-based job queue for background tasks
- **Process Management**: PM2 for production process management
- **Reverse Proxy**: Nginx with SSL/TLS termination
- **Monitoring**: Winston logging with log rotation

#### **Development Workflow**

- **Version Control**: Git with feature branch workflow
- **Code Quality**: ESLint, Prettier, and TypeScript strict mode
- **Testing**: Jest for unit tests, Cypress for E2E testing
- **Documentation**: Comprehensive API documentation with Swagger
- **CI/CD**: Automated testing and deployment pipeline

## 🎯 Business Logic Priorities

### **1. Multi-user Scalability**

- Single SMS-Activate API key serving thousands of users
- Intelligent request queuing and rate limiting
- Fair resource allocation among users
- Real-time status updates without API abuse

### **2. Financial Accuracy**

- Precise balance tracking with atomic transactions
- Automatic refund processing for failed operations
- Transparent pricing with configurable markup
- Comprehensive transaction logging

### **3. User Experience Excellence**

- Chinese-optimized interface and messaging
- Real-time status updates and notifications
- Intuitive service selection and management
- Mobile-responsive design

### **4. System Reliability**

- Robust error handling and recovery
- Automatic cleanup of expired operations
- Health monitoring and alerting
- Graceful degradation during API issues

## 🚀 Development Phases

### **Phase 1: Core Infrastructure (Week 1-2)**

- Database schema implementation
- Basic authentication system
- SMS-Activate API integration
- Core user management

### **Phase 2: SMS Services (Week 3-4)**

- Activation service implementation
- Real-time status checking
- Basic frontend interface
- Balance management system

### **Phase 3: Rental Services (Week 5-6)**

- Phone number rental system
- Multi-SMS handling for rentals
- Enhanced frontend features
- Transaction history

### **Phase 4: Advanced Features (Week 7-8)**

- Admin panel development
- Analytics and reporting
- Performance optimization
- Security hardening

### **Phase 5: Production Deployment (Week 9-10)**

- Production environment setup
- Monitoring and logging
- Load testing and optimization
- Documentation and training

## 🎨 UI/UX Guidelines for Chinese Users

### **Design Principles**

- **Clean and Minimal**: Avoid clutter, focus on core functionality
- **Mobile-First**: Optimized for mobile usage patterns
- **Fast Loading**: Minimize load times with optimized assets
- **Intuitive Navigation**: Clear user flow and navigation

### **Chinese Localization**

- **Language**: Simplified Chinese throughout the interface
- **Cultural Adaptation**: Colors, imagery, and UX patterns suitable for Chinese users
- **Payment Integration**: Support for popular Chinese payment methods
- **Service Names**: Localized service names and descriptions

### **Color Scheme**

- **Primary**: Blue (#2563EB) for trust and reliability
- **Success**: Green (#10B981) for completed operations
- **Warning**: Orange (#F59E0B) for pending operations
- **Error**: Red (#EF4444) for failed operations
- **Background**: Light gray (#F9FAFB) for clean appearance

## 📊 Success Metrics

### **Technical Metrics**

- **API Response Time**: <200ms average
- **System Uptime**: >99.9%
- **Error Rate**: <1%
- **Concurrent Users**: Support 1000+ concurrent users

### **Business Metrics**

- **User Satisfaction**: High success rate for SMS operations
- **Revenue Growth**: Efficient markup and pricing strategy
- **User Retention**: Engaging user experience
- **Support Efficiency**: Minimal support tickets due to clear UX

## 🔧 Additional Considerations

### **Compliance and Legal**

- **Data Privacy**: GDPR-compliant data handling
- **Financial Regulations**: Proper transaction recording
- **Terms of Service**: Clear usage terms and limitations
- **Anti-Fraud**: Detection and prevention of fraudulent activities

### **Scalability Planning**

- **Database Sharding**: Plan for horizontal scaling
- **Microservices**: Modular architecture for easy scaling
- **CDN Integration**: Global content delivery
- **Load Balancing**: Multi-server deployment capability

This comprehensive prompt provides a complete roadmap for developing a professional SMS middleware platform. Focus on building a robust, scalable system that efficiently manages the relationship between your users and the SMS-Activate.io API while providing an excellent user experience for Chinese users.
