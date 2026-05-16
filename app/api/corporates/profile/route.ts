/**
 * GET /api/corporates/profile — current corporate (joined with users).
 */
import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import sql from '@/lib/db';

export async function GET() {
  try {
    const session = await getSession();
    if (!session || session.role !== 'corporate') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const [profile] = await sql`
      SELECT c.user_id, c.company_name, c.sector, c.cr_number, c.verification_status,
             u.name AS contact_name, u.email, u.phone, u.language_pref
      FROM corporates c JOIN users u ON u.id = c.user_id
      WHERE c.user_id = ${session.userId}
    `;
    if (!profile) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ profile });
  } catch (error: any) {
    console.error('GET /api/corporates/profile error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
