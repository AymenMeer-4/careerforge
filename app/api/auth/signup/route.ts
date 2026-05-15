import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import sql from '@/lib/db';
import { getIronSession } from 'iron-session';
import { sessionOptions, SessionData } from '@/lib/session';
import { cookies } from 'next/headers';
import { z } from 'zod';

export const runtime = 'nodejs';

const phoneRegex = /^(\+9665\d{8}|05\d{8})$/;
const crRegex = /^[12345789]\d{9}$/;
const passwordRegex = /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d@$!%*#?&^_-]{8,}$/;

const signupSchema = z.object({
  role: z.enum(['student', 'corporate']),
  email: z.string().email('Invalid email address'),
  password: z.string().regex(passwordRegex, 'Password must be at least 8 characters long and contain at least one letter and one number'),
  name: z.string().min(1, 'Name is required'),
  phone: z.string().regex(phoneRegex, 'Invalid Saudi phone number'),
  companyName: z.string().optional(),
  sector: z.enum(['medicine', 'engineering', 'tech', 'other']).optional(),
  crNumber: z.string().regex(crRegex, 'Invalid CR number').optional(),
}).superRefine((data, ctx) => {
  if (data.role === 'corporate') {
    if (!data.companyName) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Company name is required for corporate role', path: ['companyName'] });
    }
    if (!data.sector) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Sector is required for corporate role', path: ['sector'] });
    }
    if (!data.crNumber) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'CR Number is required for corporate role', path: ['crNumber'] });
    }
  }
});

function normalizePhone(phone: string) {
  if (phone.startsWith('05')) {
    return '+966' + phone.substring(1);
  }
  return phone;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const result = signupSchema.safeParse(body);
    
    if (!result.success) {
      return NextResponse.json({ error: result.error.issues[0].message }, { status: 400 });
    }
    
    const data = result.data;
    const normalizedPhone = normalizePhone(data.phone);
    
    const existingUser = await sql`SELECT id FROM users WHERE email = ${data.email} LIMIT 1`;
    if (existingUser.length > 0) {
      return NextResponse.json({ error: 'Email already exists' }, { status: 400 });
    }
    
    const passwordHash = await bcrypt.hash(data.password, 10);
    
    let userId: string = '';
    
    await sql.begin(async (tx) => {
      const [user] = await tx`
        INSERT INTO users (email, password_hash, name, phone, role)
        VALUES (${data.email}, ${passwordHash}, ${data.name}, ${normalizedPhone}, ${data.role})
        RETURNING id
      `;
      userId = user.id;
      
      if (data.role === 'student') {
        await tx`
          INSERT INTO students (user_id)
          VALUES (${userId})
        `;
      } else if (data.role === 'corporate') {
        await tx`
          INSERT INTO corporates (user_id, company_name, sector, cr_number, verification_status)
          VALUES (${userId}, ${data.companyName!}, ${data.sector!}, ${data.crNumber!}, 'pending')
        `;
      }
    });
    
    const cookieStore = await cookies();
    const session = await getIronSession<SessionData>(cookieStore, sessionOptions);
    session.userId = userId;
    session.role = data.role;
    await session.save();
    
    return NextResponse.json({ userId, role: data.role });
    
  } catch (error) {
    console.error('Signup error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
