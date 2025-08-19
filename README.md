# 🚀 SMS 验证平台

一个现代化的 SMS 验证平台，基于 Node.js、React 和 MySQL 构建。提供号码激活、号码租用、用户管理、支付系统等完整功能。

## ✨ 功能特性

### 🔐 用户系统

- ✅ 用户注册/登录
- ✅ 邮箱验证
- ✅ 密码重置
- ✅ JWT 认证
- ✅ API 密钥管理
- ✅ 用户设置面板

### 📱 SMS 服务

- ✅ 号码激活服务
- ✅ 号码租用服务
- ✅ 实时短信接收
- ✅ 多国家支持
- ✅ 多服务平台支持

### 💰 支付系统

- ✅ 在线充值
- ✅ 支付回调处理
- ✅ 交易记录
- ✅ 余额管理
- ✅ 多支付方式支持

### 📊 管理功能

- ✅ 用户管理
- ✅ 交易管理
- ✅ 租用记录管理
- ✅ 系统监控
- ✅ 数据统计

### 🔧 技术特性

- ✅ 响应式设计
- ✅ WebSocket 实时通信
- ✅ 邮件通知系统
- ✅ 数据库备份
- ✅ 容器化部署
- ✅ 生产环境优化

## 🛠️ 技术栈

### 后端

- **Node.js** - 运行时环境
- **Express.js** - Web 框架
- **Sequelize** - ORM
- **MySQL** - 数据库
- **Socket.io** - WebSocket 通信
- **JWT** - 身份认证
- **Nodemailer** - 邮件服务
- **PM2** - 进程管理

### 前端

- **React 18** - UI 框架
- **TypeScript** - 类型安全
- **Ant Design** - UI 组件库
- **Zustand** - 状态管理
- **React Router** - 路由管理
- **Axios** - HTTP 客户端

### 基础设施

- **Docker** - 容器化
- **Nginx** - 反向代理
- **Redis** - 缓存 (可选)
- **Let's Encrypt** - SSL 证书

## 🚀 快速开始

### 环境要求

- Node.js >= 18.0.0
- MySQL >= 8.0
- Redis >= 6.0 (可选)
- npm 或 yarn

### 1. 克隆项目

```bash
git clone https://github.com/your-username/sms-verify.git
cd sms-verify
```

### 2. 环境配置

```bash
# 复制环境配置文件
cp env.example .env

# 编辑配置文件
nano .env
```

### 3. 数据库设置

```bash
# 创建数据库
mysql -u root -p
CREATE DATABASE sms_verify CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

# 导入数据库结构
mysql -u root -p sms_verify < database/schema.sql
```

### 4. 安装依赖

```bash
# 安装后端依赖
npm install

# 安装前端依赖
cd client
npm install
cd ..
```

### 5. 启动服务

#### 开发环境

```bash
# 启动后端 (终端1)
npm run dev

# 启动前端 (终端2)
cd client
npm start
```

#### 生产环境

```bash
# 构建前端
cd client
npm run build
cd ..

# 使用 PM2 启动
npm install -g pm2
pm2 start ecosystem.config.js --env production
```

## 🐳 Docker 部署

### 1. 使用 Docker Compose (推荐)

```bash
# 复制环境配置
cp env.example .env
# 编辑 .env 文件

# 启动所有服务
docker-compose up -d

# 查看服务状态
docker-compose ps

# 查看日志
docker-compose logs -f app
```

### 2. 单独构建镜像

```bash
# 构建镜像
docker build -t sms-verify .

# 运行容器
docker run -d \
  --name sms-verify \
  -p 3001:3001 \
  -e NODE_ENV=production \
  -e DB_HOST=your-db-host \
  -e DB_PASSWORD=your-db-password \
  sms-verify
```

## ⚙️ 配置说明

### 环境变量

| 变量名                 | 说明              | 默认值        | 必需 |
| ---------------------- | ----------------- | ------------- | ---- |
| `NODE_ENV`             | 运行环境          | `development` | 否   |
| `PORT`                 | 服务端口          | `3001`        | 否   |
| `DB_HOST`              | 数据库主机        | `localhost`   | 是   |
| `DB_PASSWORD`          | 数据库密码        | -             | 是   |
| `JWT_SECRET`           | JWT 密钥          | -             | 是   |
| `SMS_ACTIVATE_API_KEY` | SMS 服务 API 密钥 | -             | 是   |
| `EMAIL_PROVIDER`       | 邮件服务提供商    | `smtp`        | 否   |

完整配置请参考 `env.example` 文件。

### SMS-Activate API 配置

1. 注册 [SMS-Activate](https://sms-activate.ae/) 账户
2. 获取 API 密钥
3. 在 `.env` 文件中配置：

```bash
SMS_ACTIVATE_API_KEY=your_api_key_here
SMS_ACTIVATE_BASE_URL=https://api.sms-activate.ae/stubs/handler_api.php
```

### 邮件服务配置

支持多种邮件服务提供商：

- **SMTP** - 通用 SMTP 服务
- **Gmail** - Google Gmail
- **SendGrid** - SendGrid 服务
- **Mailgun** - Mailgun 服务

## 📦 项目结构

```
sms-verify/
├── client/                 # 前端项目
│   ├── src/
│   │   ├── components/     # React 组件
│   │   ├── pages/         # 页面组件
│   │   ├── stores/        # 状态管理
│   │   ├── services/      # API 服务
│   │   ├── hooks/         # 自定义 Hook
│   │   └── types/         # TypeScript 类型
│   └── public/            # 静态资源
├── config/                # 配置文件
├── models/                # 数据模型
├── routes/                # API 路由
├── services/              # 业务服务
├── middleware/            # 中间件
├── utils/                 # 工具函数
├── database/              # 数据库文件
├── scripts/               # 部署脚本
├── nginx/                 # Nginx 配置
├── logs/                  # 日志文件
└── docs/                  # 文档
```

## 🔧 开发指南

### 添加新功能

1. **后端 API**

   ```bash
   # 创建新路由
   touch routes/new-feature.js

   # 创建对应模型
   touch models/NewFeature.js

   # 更新 models/index.js
   ```

2. **前端页面**

   ```bash
   # 创建新页面
   mkdir client/src/pages/NewFeature
   touch client/src/pages/NewFeature/NewFeaturePage.tsx

   # 添加路由到 App.tsx
   ```

### 数据库迁移

```bash
# 修改模型后同步数据库
npm run db:sync

# 或者强制重建 (开发环境)
npm run db:sync:force
```

### API 测试

```bash
# 使用内置的健康检查
curl http://localhost:3001/api/health

# 测试认证
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"test","password":"123456"}'
```

## 📊 监控和日志

### 查看服务状态

```bash
# PM2 状态
pm2 status

# Docker 状态
docker-compose ps

# 查看日志
pm2 logs
# 或
docker-compose logs -f
```

### 健康检查

- **后端健康检查**: `GET /api/health`
- **数据库连接检查**: 包含在健康检查中
- **服务可用性监控**: 通过 PM2 或 Docker 健康检查

## 🔒 安全措施

### 生产环境安全清单

- [ ] 更改所有默认密码
- [ ] 使用强 JWT 密钥
- [ ] 启用 HTTPS
- [ ] 配置防火墙规则
- [ ] 设置速率限制
- [ ] 启用日志监控
- [ ] 定期备份数据库
- [ ] 更新依赖包

### API 安全

- JWT 令牌认证
- API 密钥管理
- 请求速率限制
- 输入验证和清理
- SQL 注入防护

## 🚀 部署到生产环境

### 1. 服务器准备

```bash
# 更新系统
sudo apt update && sudo apt upgrade -y

# 安装 Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# 安装 Docker Compose
sudo apt install docker-compose-plugin
```

### 2. 部署应用

```bash
# 克隆代码
git clone https://github.com/your-username/sms-verify.git
cd sms-verify

# 配置环境变量
cp env.example .env.production
nano .env.production

# 启动服务
./scripts/deploy.sh production
```

### 3. 配置域名和 SSL

```bash
# 使用 Certbot 获取 SSL 证书
sudo apt install certbot
sudo certbot certonly --standalone -d your-domain.com

# 配置 Nginx
sudo cp nginx/nginx.conf /etc/nginx/sites-available/sms-verify
sudo ln -s /etc/nginx/sites-available/sms-verify /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

## 🔄 维护和更新

### 数据库备份

```bash
# 手动备份
./scripts/backup.sh

# 自动备份 (crontab)
0 2 * * * /path/to/sms-verify/scripts/backup.sh
```

### 应用更新

```bash
# 拉取最新代码
git pull origin main

# 重新部署
./scripts/deploy.sh production
```

### 监控和告警

- 服务器资源监控
- 应用性能监控
- 错误日志告警
- 数据库性能监控

## 🤝 贡献指南

### 开发流程

1. Fork 项目
2. 创建功能分支 (`git checkout -b feature/amazing-feature`)
3. 提交更改 (`git commit -m 'Add amazing feature'`)
4. 推送到分支 (`git push origin feature/amazing-feature`)
5. 创建 Pull Request

### 代码规范

- 使用 ESLint 和 Prettier
- 遵循 TypeScript 最佳实践
- 编写单元测试
- 更新相关文档

## 📄 许可证

本项目采用 MIT 许可证 - 查看 [LICENSE](LICENSE) 文件了解详情。

## 💬 支持和反馈

- 📧 邮箱: support@sms-verify.com
- 🐛 问题反馈: [GitHub Issues](https://github.com/your-username/sms-verify/issues)
- 💬 讨论: [GitHub Discussions](https://github.com/your-username/sms-verify/discussions)

## 🙏 致谢

感谢所有为这个项目做出贡献的开发者和用户！

---

⭐ 如果这个项目对您有帮助，请给我们一个 Star！
