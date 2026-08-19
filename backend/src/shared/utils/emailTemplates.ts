export const otpEmailTemplate = (data: {
  name: string;
  otp: string;
  expiresInMinutes: number;
  appName: string;
  supportEmail: string;
}): string => `
  <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
    <h2>مرحباً ${data.name}</h2>
    <p>رمز التحقق الخاص بك هو:</p>
    <h1 style="color: #1a1a2e; letter-spacing: 5px; text-align: center; padding: 20px; background: #f0f2f5; border-radius: 8px;">${data.otp}</h1>
    <p>رمز التحقق صالح لمدة ${data.expiresInMinutes} دقائق.</p>
    <p>إذا لم تطلب هذا الرمز، يرجى تجاهل هذه الرسالة.</p>
  </div>
`;
