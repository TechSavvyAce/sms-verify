# 🚀 SMS Verification Platform - Deployment Configuration

## 📋 **Deployment Checklist**

### **Phase 1: Environment Setup**

- [ ] **Server Requirements**
  - [ ] Ubuntu 20.04+ / CentOS 8+ / Debian 11+
  - [ ] 4GB+ RAM, 2+ CPU cores
  - [ ] 50GB+ storage
  - [ ] Public IP address
  - [ ] Domain name (optional but recommended)

- [ ] **Software Dependencies**
  - [ ] Node.js 18+ LTS
  - [ ] MySQL 8.0+ / PostgreSQL 13+
  - [ ] Redis 6.0+ (for caching)
  - [ ] Nginx (reverse proxy)
  - [ ] PM2 (process manager)
  - [ ] Certbot (SSL certificates)

### **Phase 2: Database Setup**

- [ ] **MySQL Configuration**

  ```sql
  CREATE DATABASE sms_verify CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
  CREATE USER 'sms_user'@'localhost' IDENTIFIED BY 'strong_password_here';
  GRANT ALL PRIVILEGES ON sms_verify.* TO 'sms_user'@'localhost';
  FLUSH PRIVILEGES;
  ```

- [ ] **Database Migration**
  ```bash
  # Run database setup scripts
  npm run migrate
  npm run seed
  ```

### **Phase 3: Environment Configuration**

- [ ] **Backend Environment (.env)**

  ```env
  # Server Configuration
  NODE_ENV=production
  PORT=3001
  FRONTEND_URL=https://yourdomain.com

  # Database Configuration
  DB_HOST=localhost
  DB_PORT=3306
  DB_NAME=sms_verify
  DB_USER=sms_user
  DB_PASSWORD=strong_password_here

  # JWT Configuration
  JWT_SECRET=your_super_secret_jwt_key_here
  JWT_REFRESH_SECRET=your_super_secret_refresh_key_here
  JWT_EXPIRES_IN=15m
  JWT_REFRESH_EXPIRES_IN=7d

  # Email Configuration (Choose one)
  EMAIL_PROVIDER=hostinger  # or gmail, ethereal
  EMAIL_HOST=smtp.hostinger.com
  EMAIL_PORT=587
  EMAIL_USER=your_email@yourdomain.com
  EMAIL_PASS=your_email_password

  # SafePing Configuration
  SAFEPING_API_KEY=your_safeping_api_key
  SAFEPING_WEBHOOK_SECRET=your_webhook_secret

  # Security Configuration
  INTERNAL_API_KEYS=key1,key2,key3
  HEALTH_CHECK_TOKEN=your_health_check_token

  # Rate Limiting (Optional)
  RATE_LIMIT_WINDOW_MS=900000
  RATE_LIMIT_MAX_REQUESTS=100

  # Logging Configuration
  LOG_LEVEL=info
  LOG_FILE_PATH=./logs/app.log

  # Backup Configuration
  BACKUP_ENABLED=true
  BACKUP_SCHEDULE=0 2 * * *  # Daily at 2 AM
  BACKUP_RETENTION_DAYS=30
  ```

- [ ] **Frontend Environment (.env.production)**
  ```env
  REACT_APP_API_URL=https://yourdomain.com/api
  REACT_APP_WEBSOCKET_URL=wss://yourdomain.com
  REACT_APP_ENVIRONMENT=production
  ```

### **Phase 4: Backend Deployment**

- [ ] **PM2 Configuration (ecosystem.config.js)**

  ```javascript
  module.exports = {
    apps: [
      {
        name: "sms-verify-backend",
        script: "server.js",
        instances: "max",
        exec_mode: "cluster",
        env: {
          NODE_ENV: "production",
          PORT: 3001,
        },
        error_file: "./logs/err.log",
        out_file: "./logs/out.log",
        log_file: "./logs/combined.log",
        time: true,
        max_memory_restart: "1G",
        restart_delay: 4000,
        max_restarts: 10,
        min_uptime: "10s",
      },
    ],
  };
  ```

- [ ] **Nginx Configuration (/etc/nginx/sites-available/sms-verify)**

  ```nginx
  server {
      listen 80;
      server_name yourdomain.com www.yourdomain.com;

      # Redirect HTTP to HTTPS
      return 301 https://$server_name$request_uri;
  }

  server {
      listen 443 ssl http2;
      server_name yourdomain.com www.yourdomain.com;

      # SSL Configuration
      ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
      ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;
      ssl_protocols TLSv1.2 TLSv1.3;
      ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512:ECDHE-RSA-AES256-GCM-SHA384:DHE-RSA-AES256-GCM-SHA384;
      ssl_prefer_server_ciphers off;

      # Security Headers
      add_header X-Frame-Options DENY;
      add_header X-Content-Type-Options nosniff;
      add_header X-XSS-Protection "1; mode=block";
      add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

      # API Backend
      location /api {
          proxy_pass http://localhost:3001;
          proxy_http_version 1.1;
          proxy_set_header Upgrade $http_upgrade;
          proxy_set_header Connection 'upgrade';
          proxy_set_header Host $host;
          proxy_set_header X-Real-IP $remote_addr;
          proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
          proxy_set_header X-Forwarded-Proto $scheme;
          proxy_cache_bypass $http_upgrade;
          proxy_read_timeout 300s;
          proxy_connect_timeout 75s;
      }

      # WebSocket Support
      location /socket.io {
          proxy_pass http://localhost:3001;
          proxy_http_version 1.1;
          proxy_set_header Upgrade $http_upgrade;
          proxy_set_header Connection "upgrade";
          proxy_set_header Host $host;
          proxy_set_header X-Real-IP $remote_addr;
          proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
          proxy_set_header X-Forwarded-Proto $scheme;
      }

      # Frontend Static Files
      location / {
          root /var/www/sms-verify/client/build;
          try_files $uri $uri/ /index.html;

          # Cache static assets
          location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
              expires 1y;
              add_header Cache-Control "public, immutable";
          }
      }

      # Health Check
      location /health {
          access_log off;
          return 200 "healthy\n";
          add_header Content-Type text/plain;
      }
  }
  ```

### **Phase 5: Frontend Deployment**

- [ ] **Build Process**

  ```bash
  # Install dependencies
  npm install

  # Build for production
  npm run build

  # Copy build files to web server
  sudo cp -r build/* /var/www/sms-verify/client/
  ```

### **Phase 6: SSL Certificate Setup**

- [ ] **Let's Encrypt SSL**

  ```bash
  # Install Certbot
  sudo apt install certbot python3-certbot-nginx

  # Obtain SSL certificate
  sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com

  # Auto-renewal
  sudo crontab -e
  # Add: 0 12 * * * /usr/bin/certbot renew --quiet
  ```

### **Phase 7: Service Management**

- [ ] **Systemd Service (/etc/systemd/system/sms-verify.service)**

  ```ini
  [Unit]
  Description=SMS Verify Backend Service
  After=network.target mysql.service redis.service

  [Service]
  Type=forking
  User=www-data
  Group=www-data
  WorkingDirectory=/var/www/sms-verify
  ExecStart=/usr/bin/pm2 start ecosystem.config.js
  ExecReload=/usr/bin/pm2 reload ecosystem.config.js
  ExecStop=/usr/bin/pm2 stop ecosystem.config.js
  Restart=always
  RestartSec=10

  [Install]
  WantedBy=multi-user.target
  ```

- [ ] **Enable and Start Services**
  ```bash
  sudo systemctl enable sms-verify
  sudo systemctl start sms-verify
  sudo systemctl enable nginx
  sudo systemctl start nginx
  ```

### **Phase 8: Monitoring & Maintenance**

- [ ] **Log Rotation (/etc/logrotate.d/sms-verify)**

  ```
  /var/www/sms-verify/logs/*.log {
      daily
      missingok
      rotate 30
      compress
      delaycompress
      notifempty
      create 644 www-data www-data
      postrotate
          /usr/bin/pm2 reloadLogs
      endscript
  }
  ```

- [ ] **Backup Script (/usr/local/bin/backup-sms-verify.sh)**

  ```bash
  #!/bin/bash
  BACKUP_DIR="/var/backups/sms-verify"
  DATE=$(date +%Y%m%d_%H%M%S)

  # Create backup directory
  mkdir -p $BACKUP_DIR

  # Database backup
  mysqldump -u sms_user -p sms_verify > $BACKUP_DIR/db_backup_$DATE.sql

  # Application backup
  tar -czf $BACKUP_DIR/app_backup_$DATE.tar.gz /var/www/sms-verify

  # Clean old backups (keep 30 days)
  find $BACKUP_DIR -name "*.sql" -mtime +30 -delete
  find $BACKUP_DIR -name "*.tar.gz" -mtime +30 -delete
  ```

### **Phase 9: Security Hardening**

- [ ] **Firewall Configuration (UFW)**

  ```bash
  sudo ufw default deny incoming
  sudo ufw default allow outgoing
  sudo ufw allow ssh
  sudo ufw allow 80/tcp
  sudo ufw allow 443/tcp
  sudo ufw enable
  ```

- [ ] **Fail2ban Configuration**
  ```bash
  sudo apt install fail2ban
  sudo systemctl enable fail2ban
  sudo systemctl start fail2ban
  ```

### **Phase 10: Performance Optimization**

- [ ] **Redis Caching**

  ```bash
  # Install Redis
  sudo apt install redis-server

  # Configure Redis
  sudo nano /etc/redis/redis.conf
  # Set: maxmemory 256mb
  # Set: maxmemory-policy allkeys-lru
  ```

- [ ] **Database Optimization**
  ```sql
  -- Add indexes for better performance
  CREATE INDEX idx_users_email ON users(email);
  CREATE INDEX idx_users_status ON users(status);
  CREATE INDEX idx_transactions_user_id ON transactions(user_id);
  CREATE INDEX idx_transactions_created_at ON transactions(created_at);
  ```

## 🚀 **Quick Deployment Script**

```bash
#!/bin/bash
# deploy.sh - Quick deployment script

echo "🚀 Starting SMS Verify Platform deployment..."

# Update system
sudo apt update && sudo apt upgrade -y

# Install dependencies
sudo apt install -y nodejs npm mysql-server redis-server nginx certbot python3-certbot-nginx

# Clone repository
git clone https://github.com/yourusername/sms-verify.git /var/www/sms-verify
cd /var/www/sms-verify

# Install dependencies
npm install
cd client && npm install && npm run build && cd ..

# Setup database
sudo mysql -e "CREATE DATABASE IF NOT EXISTS sms_verify CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
sudo mysql -e "CREATE USER IF NOT EXISTS 'sms_user'@'localhost' IDENTIFIED BY 'your_password';"
sudo mysql -e "GRANT ALL PRIVILEGES ON sms_verify.* TO 'sms_user'@'localhost';"

# Setup environment
cp env.example .env
# Edit .env with your configuration

# Setup PM2
sudo npm install -g pm2
pm2 start ecosystem.config.js
pm2 startup
pm2 save

# Setup Nginx
sudo cp nginx/nginx.conf /etc/nginx/sites-available/sms-verify
sudo ln -s /etc/nginx/sites-available/sms-verify /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl restart nginx

# Setup SSL (replace yourdomain.com)
sudo certbot --nginx -d yourdomain.com

echo "✅ Deployment completed! Please check your configuration."
```

## 📊 **Health Check Endpoints**

- **Backend Health**: `https://yourdomain.com/api/health`
- **Frontend**: `https://yourdomain.com`
- **Admin Panel**: `https://yourdomain.com/admin`

## 🔧 **Troubleshooting**

### **Common Issues**

1. **Port already in use**: Check if another service is using port 3001
2. **Database connection failed**: Verify database credentials and service
   status
3. **SSL certificate issues**: Check Certbot logs and domain configuration
4. **Permission denied**: Ensure proper file ownership (www-data:www-data)

### **Log Locations**

- **Application logs**: `/var/www/sms-verify/logs/`
- **Nginx logs**: `/var/log/nginx/`
- **System logs**: `/var/log/syslog`
- **PM2 logs**: `pm2 logs`

## 📈 **Scaling Considerations**

- **Load Balancer**: Use HAProxy or Nginx for multiple backend instances
- **Database**: Consider read replicas for high-traffic scenarios
- **Caching**: Implement Redis clustering for better performance
- **CDN**: Use Cloudflare or AWS CloudFront for static assets
- **Monitoring**: Implement Prometheus + Grafana for metrics

---

**🎯 Ready for Production Deployment!**
