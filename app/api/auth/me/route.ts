import { getSession } from '@/lib/session';

export async function GET() {
  try {
    const session = await getSession();

    if (session && session.userId) {
      return Response.json(
        { userId: session.userId, role: session.role },
        { status: 200 }
      );
    }

    return Response.json({ error: 'unauthenticated' }, { status: 401 });
  } catch (error) {
    console.error('Error in /api/auth/me:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
