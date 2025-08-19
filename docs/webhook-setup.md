# Webhook Configuration Guide

## Overview

The SMS verification platform uses webhooks to receive real-time notifications for:

- **Rental Status Updates**: When rental numbers receive SMS messages or status changes
- **Payment Notifications**: When payment transactions are completed or fail
- **Activation Updates**: When activation numbers receive SMS codes

## Environment Variables

Add these to your `.env` file:

```bash
# Webhook配置
WEBHOOK_SECRET=your-webhook-secret-key
APP_URL=https://smsyz.online

# 支付配置
PAYMENT_SECRET=your-payment-webhook-secret
```

## Webhook Endpoints

### 1. Rental Webhooks

**URL**: `POST /api/webhook/rental`
**Purpose**: Receive rental status updates from SMS-Activate

**Example Payload**:

```json
{
  "id": "12345",
  "phone": "79181234567",
  "status": "STATUS_OK",
  "endDate": "2024-01-31T12:01:52",
  "messages": [
    {
      "phoneFrom": "79180230628",
      "text": "Verification code: 123456",
      "service": "telegram",
      "date": "2024-01-30 14:31:58"
    }
  ]
}
```

### 2. Payment Webhooks

**URL**: `POST /api/webhook/payment`
**Purpose**: Receive payment status updates

**Example Payload**:

```json
{
  "order_id": "pay_1704025312000_abc123",
  "status": "success",
  "amount": "10.00",
  "currency": "USD",
  "transaction_id": "txn_xyz789",
  "payment_method": "card",
  "timestamp": "2024-01-01T00:00:00Z"
}
```

### 3. Activation Webhooks

**URL**: `POST /api/webhook/activation`
**Purpose**: Receive activation status updates

**Example Payload**:

```json
{
  "id": "67890",
  "phone": "79181234567",
  "status": "STATUS_OK",
  "sms": "123456",
  "service": "telegram",
  "country": "0"
}
```

## Security

All webhooks use HMAC-SHA256 signature verification:

1. **Signature Header**: `X-Webhook-Signature: sha256={signature}`
2. **Secret**: Uses `WEBHOOK_SECRET` environment variable
3. **Payload**: Raw JSON body is used for signature calculation

### Verification Process

```javascript
const crypto = require("crypto");

function verifyWebhook(payload, signature, secret) {
  const expectedSignature = crypto
    .createHmac("sha256", secret)
    .update(payload)
    .digest("hex");

  return crypto.timingSafeEqual(
    Buffer.from(expectedSignature, "hex"),
    Buffer.from(signature.replace("sha256=", ""), "hex")
  );
}
```

## SMS-Activate Integration

### Automatic Webhook Registration

When creating rentals or activations, the system automatically:

1. Generates a unique webhook URL with embedded secret
2. Registers the webhook with SMS-Activate API
3. Processes incoming notifications automatically

### Manual Webhook Configuration

To manually configure webhooks with SMS-Activate:

1. **Get Webhook URL**:

   ```bash
   GET /api/webhook/config?type=rental
   ```

2. **Response**:

   ```json
   {
     "success": true,
     "data": {
       "webhook_url": "https://smsyz.online/api/webhook/rental?secret=abc123",
       "webhook_secret": "abc123",
       "headers": {
         "Content-Type": "application/json",
         "X-Webhook-Signature": "sha256={signature}"
       }
     }
   }
   ```

3. **Register with SMS-Activate**:
   Use the provided URL when calling SMS-Activate APIs that support webhooks.

## Testing Webhooks

### Test Endpoint

**URL**: `POST /api/webhook/test`

**Request**:

```json
{
  "url": "https://smsyz.online/api/webhook/rental?secret=test123",
  "payload": {
    "id": "test",
    "phone": "1234567890",
    "status": "STATUS_OK"
  },
  "secret": "test123"
}
```

### Health Check

**URL**: `GET /api/webhook/health`

Returns webhook service status and available endpoints.

## Webhook Processing

### 1. Rental Updates

- **Active → Completed**: Mark rental as completed when SMS received
- **Active → Expired**: Automatic expiration handling
- **Active → Cancelled**: Handle cancellation refunds
- **Message Updates**: Store received SMS messages

### 2. Payment Updates

- **Success**: Update user balance and transaction status
- **Failed/Cancelled**: Mark transaction as failed
- **Refunds**: Process refund transactions

### 3. Activation Updates

- **SMS Received**: Store verification code and mark as completed
- **Timeout**: Handle activation timeouts and refunds
- **Cancelled**: Process cancellation refunds

## Error Handling

### Webhook Failures

- **Invalid Signature**: Return 401 Unauthorized
- **Missing Data**: Return 400 Bad Request
- **Processing Error**: Return 500 Internal Server Error
- **Not Found**: Return 404 if record doesn't exist

### Retry Mechanism

SMS-Activate will retry failed webhooks:

- **Retry Count**: Up to 5 attempts
- **Backoff**: Exponential backoff (1s, 2s, 4s, 8s, 16s)
- **Timeout**: 30 seconds per attempt

## Monitoring

### Webhook Logs

All webhook events are logged with:

- **Timestamp**: When webhook was received
- **Type**: rental/payment/activation
- **Status**: success/failure
- **Processing Time**: Time taken to process
- **Error Details**: If processing failed

### Metrics

Track webhook performance:

- **Success Rate**: Percentage of successful webhook processing
- **Average Response Time**: Time to process webhooks
- **Error Rate**: Frequency of webhook failures

## Troubleshooting

### Common Issues

1. **Webhook Not Received**:

   - Check firewall settings
   - Verify HTTPS certificate
   - Confirm webhook URL accessibility

2. **Signature Verification Failed**:

   - Check `WEBHOOK_SECRET` configuration
   - Verify payload encoding (UTF-8)
   - Ensure raw body is used for signature

3. **Processing Errors**:
   - Check database connectivity
   - Verify user/rental/transaction exists
   - Review application logs

### Debug Mode

Enable webhook debugging by setting:

```bash
LOG_LEVEL=debug
```

This will log all webhook payloads and processing details.
