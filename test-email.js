require("dotenv").config();
const EmailService = require("./services/EmailService");

async function testEmail() {
  console.log("Testing Email Service...\n");

  const emailService = new EmailService();

  // Test 1: Test SMTP connection
  console.log("1. Testing SMTP connection...");
  try {
    const connectionResult = await emailService.testConnection();
    console.log("Connection result:", connectionResult);
  } catch (error) {
    console.error("Connection test failed:", error.message);
  }

  console.log("\n2. Testing email sending...");
  try {
    const result = await emailService.sendMail(
      "test@example.com",
      "Test Email",
      "<h1>Test Email</h1><p>This is a test email to verify the service is working.</p>"
    );
    console.log("Email sent successfully:", result);
  } catch (error) {
    console.error("Email sending failed:", error.message);
  }
}

testEmail().catch(console.error);
