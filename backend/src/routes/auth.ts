import { Router, Request, Response } from 'express';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { DatabaseService } from '../services/database';
import { EmailService } from '../services/email';
import { User } from '../models/types';

const router = Router();
const SALT_ROUNDS = 10;
const OTP_EXPIRATION_MINUTES = parseInt(
  process.env.OTP_EXPIRATION_MINUTES || '15',
  10
);
const JWT_SECRET = process.env.JWT_SECRET || 'default-secret';

// POST /api/auth/request-otp
// Generates and "sends" a one-time password to the user's email.
router.post('/request-otp', async (req: Request, res: Response) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ message: 'Email is required.' });
  }

  try {
    const otp = crypto.randomInt(100000, 999999).toString();
    const otpHash = await bcrypt.hash(otp, SALT_ROUNDS);
    const expiresAt = Date.now() + OTP_EXPIRATION_MINUTES * 60 * 1000;

    await DatabaseService.run(
      'INSERT INTO otps (email, otp_hash, expires_at) VALUES (?, ?, ?)',
      [email, otpHash, expiresAt]
    );

    await EmailService.sendOtp(email, otp);

    res.status(200).json({ message: 'OTP has been sent to your email.' });
  } catch (error) {
    console.error('Error requesting OTP:', error);
    res.status(500).json({ message: 'Failed to send OTP.' });
  }
});

// POST /api/auth/verify-otp
// Verifies the OTP and, on success, returns a JWT. Creates a user if one doesn't exist.
router.post('/verify-otp', async (req: Request, res: Response) => {
  const { email, otp } = req.body;

  if (!email || !otp) {
    return res.status(400).json({ message: 'Email and OTP are required.' });
  }

  try {
    const record = await DatabaseService.get<{
      otp_hash: string;
      expires_at: number;
    }>(
      'SELECT otp_hash, expires_at FROM otps WHERE email = ? ORDER BY id DESC LIMIT 1',
      [email]
    );

    if (!record) {
      return res.status(400).json({ message: 'Invalid OTP or email.' });
    }

    if (Date.now() > record.expires_at) {
      return res.status(400).json({ message: 'OTP has expired.' });
    }

    const isValid = await bcrypt.compare(otp, record.otp_hash);
    if (!isValid) {
      return res.status(400).json({ message: 'Invalid OTP.' });
    }

    // OTP is valid, find or create user.
    const user: User | undefined = await DatabaseService.get<User>(
      'SELECT * FROM users WHERE email = ?',
      [email]
    );

    let userId: number;
    if (!user) {
      const result = await DatabaseService.run(
        'INSERT INTO users (email, created_at) VALUES (?, ?)',
        [email, Date.now()]
      );
      userId = result.lastID;
    } else {
      userId = user.id;
    }

    // Clean up used OTP
    await DatabaseService.run('DELETE FROM otps WHERE email = ?', [email]);

    // Generate JWT
    const token = jwt.sign({ userId }, JWT_SECRET, { expiresIn: '7d' });

    res.status(200).json({ message: 'Login successful.', token });
  } catch (error) {
    console.error('Error verifying OTP:', error);
    res.status(500).json({ message: 'Failed to verify OTP.' });
  }
});

export default router;
