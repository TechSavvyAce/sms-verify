#!/bin/bash

# SMS验证平台部署脚本
# 使用方法: ./scripts/deploy.sh [environment]
# 环境: development, staging, production

set -e

ENVIRONMENT=${1:-development}
PROJECT_ROOT=$(dirname "$(dirname "$(realpath "$0")")")
cd "$PROJECT_ROOT"

echo "🚀 开始部署 SMS验证平台 - 环境: $ENVIRONMENT"

# 检查环境配置
if [ ! -f ".env.$ENVIRONMENT" ]; then
    echo "❌ 找不到环境配置文件: .env.$ENVIRONMENT"
    echo "请复制 env.example 并重命名为 .env.$ENVIRONMENT，然后配置相应的环境变量"
    exit 1
fi

# 备份当前配置
if [ -f ".env" ]; then
    cp .env .env.backup.$(date +%Y%m%d_%H%M%S)
    echo "✅ 已备份当前环境配置"
fi

# 应用环境配置
cp ".env.$ENVIRONMENT" .env
echo "✅ 已应用 $ENVIRONMENT 环境配置"

# 安装后端依赖
echo "📦 安装后端依赖..."
npm ci --only=production

# 安装前端依赖并构建
echo "📦 安装前端依赖并构建..."
cd client
npm ci
npm run build
cd ..

# 数据库迁移和初始化
echo "🗄️  执行数据库迁移..."
npm run db:migrate

# 启动服务前的检查
echo "🔍 执行部署前检查..."

# 检查数据库连接
node -e "
const db = require('./config/database');
db.authenticate()
  .then(() => {
    console.log('✅ 数据库连接正常');
    process.exit(0);
  })
  .catch(err => {
    console.error('❌ 数据库连接失败:', err.message);
    process.exit(1);
  });
"

# 检查关键环境变量
node -e "
const requiredVars = [
  'JWT_SECRET',
  'DB_HOST',
  'DB_NAME',
  'DB_USER',
  'SMS_ACTIVATE_API_KEY'
];

const missing = requiredVars.filter(var => !process.env[var]);
if (missing.length > 0) {
  console.error('❌ 缺少关键环境变量:', missing.join(', '));
  process.exit(1);
}
console.log('✅ 环境变量检查通过');
"

# 根据环境选择部署方式
if [ "$ENVIRONMENT" = "production" ]; then
    echo "🔥 生产环境部署"
    
    # 使用 PM2 管理进程
    if command -v pm2 &> /dev/null; then
        echo "📋 使用 PM2 管理进程..."
        
        # 停止现有进程
        pm2 stop sms-verify || true
        pm2 delete sms-verify || true
        
        # 启动新进程
        pm2 start ecosystem.config.js --env production
        pm2 save
        
        echo "✅ 生产环境部署完成"
        echo "📊 查看状态: pm2 status"
        echo "📝 查看日志: pm2 logs sms-verify"
    else
        echo "❌ 请先安装 PM2: npm install -g pm2"
        exit 1
    fi
    
elif [ "$ENVIRONMENT" = "staging" ]; then
    echo "🧪 预发布环境部署"
    
    # 杀死现有进程
    pkill -f "node.*server.js" || true
    
    # 后台启动
    nohup npm start > logs/app.log 2>&1 &
    echo $! > .pid
    
    echo "✅ 预发布环境部署完成"
    echo "📊 查看进程: ps -p $(cat .pid)"
    echo "📝 查看日志: tail -f logs/app.log"
    
else
    echo "🛠️  开发环境启动"
    
    # 开发环境直接启动
    npm run dev &
    CLIENT_PID=$!
    
    cd client
    npm start &
    SERVER_PID=$!
    
    echo "✅ 开发环境启动完成"
    echo "🖥️  前端地址: http://localhost:3000"
    echo "⚙️  后端地址: http://localhost:3001"
    echo "停止服务: kill $CLIENT_PID $SERVER_PID"
fi

echo ""
echo "🎉 部署完成！"
echo "环境: $ENVIRONMENT"
echo "时间: $(date)"

# 部署后验证
echo "🔍 执行部署后验证..."
sleep 5

# 健康检查
if curl -f http://localhost:3001/api/health &>/dev/null; then
    echo "✅ 后端健康检查通过"
else
    echo "❌ 后端健康检查失败"
    exit 1
fi

echo "🎊 所有检查通过，部署成功！"
