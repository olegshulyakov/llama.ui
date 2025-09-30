/**
 * Mock Email Service
 * In a real application, you would replace this with a proper email service
 * like Nodemailer using a provider like SendGrid, Mailgun, or AWS SES.
 */
export class EmailService {
  /**
   * "Sends" an OTP email by logging it to the console.
   * @param email The recipient's email address.
   * @param otp The one-time password to send.
   */
  public static async sendOtp(email: string, otp: string): Promise<void> {
    console.log('--- MOCK EMAIL ---');
    console.log(`To: ${email}`);
    console.log(`Subject: Your One-Time Password`);
    console.log(`Your OTP is: ${otp}`);
    console.log('This code will expire in 15 minutes.');
    console.log('------------------');

    // In a real implementation, you'd have something like:
    /*
        const transporter = nodemailer.createTransport({ ... });
        await transporter.sendMail({
            from: '"Sync Service" <no-reply@example.com>',
            to: email,
            subject: "Your One-Time Password",
            text: `Your OTP is: ${otp}`,
            html: `<b>Your OTP is: ${otp}</b>`
        });
        */

    // Simulate network delay
    return new Promise((resolve) => setTimeout(resolve, 500));
  }
}
