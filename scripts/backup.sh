#!/bin/bash

# 数据库备份脚本
# 每日自动备份数据库

set -e

# 配置
BACKUP_DIR="/backups"
DATE=$(date +%Y%m%d_%H%M%S)
RETENTION_DAYS=30

# 从环境变量获取数据库配置
DB_HOST=${MYSQL_HOST:-localhost}
DB_USER=${MYSQL_USER:-root}
DB_PASSWORD=${MYSQL_PASSWORD}
DB_NAME=${MYSQL_DATABASE:-sms_verify}

# 创建备份目录
mkdir -p "$BACKUP_DIR"

echo "🗄️  开始备份数据库 $DB_NAME..."

# 执行备份
BACKUP_FILE="$BACKUP_DIR/sms_verify_backup_$DATE.sql"

mysqldump \
  --host="$DB_HOST" \
  --user="$DB_USER" \
  --password="$DB_PASSWORD" \
  --single-transaction \
  --routines \
  --triggers \
  --events \
  --add-drop-table \
  --add-locks \
  --complete-insert \
  --disable-keys \
  --extended-insert \
  --lock-tables=false \
  --quick \
  --set-charset \
  "$DB_NAME" > "$BACKUP_FILE"

# 压缩备份文件
gzip "$BACKUP_FILE"
BACKUP_FILE="$BACKUP_FILE.gz"

echo "✅ 备份完成: $BACKUP_FILE"

# 获取备份文件大小
BACKUP_SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
echo "📦 备份大小: $BACKUP_SIZE"

# 清理旧备份
echo "🧹 清理 $RETENTION_DAYS 天前的旧备份..."
find "$BACKUP_DIR" -name "sms_verify_backup_*.sql.gz" -mtime +$RETENTION_DAYS -delete

# 列出当前备份
echo "📋 当前备份列表:"
ls -lh "$BACKUP_DIR"/sms_verify_backup_*.sql.gz | tail -10

echo "🎉 备份任务完成!"
