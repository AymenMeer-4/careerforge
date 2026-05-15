import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import sql from '@/lib/db';
import { mapSpecialtyToCluster } from '@/lib/cluster';
import { computeStudentDimensions } from '@/lib/readiness';

export async function GET() {
  try {
    const session = await getSession();
    if (!session || session.role !== 'student') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const [profile] = await sql`
      SELECT 
        s.user_id, s.university, s.region, s.specialty, s.cluster, s.year_of_study, 
        s.gpa_scale, s.gpa_value, s.onboarding_completed_at, s.city, 
        s.opportunity_types, s.employment_experience, s.hours_per_week, 
        s.interests, s.target_role, s.profile_completed_at, s.created_at, s.updated_at,
        u.name, u.email, u.phone, u.language_pref 
      FROM students s
      JOIN users u ON s.user_id = u.id
      WHERE s.user_id = ${session.userId}
    `;

    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    const experiences = await sql`
      SELECT * FROM student_experiences 
      WHERE student_id = ${session.userId}
      ORDER BY date_completed DESC NULLS LAST, created_at DESC
    `;

    const courses = await sql`
      SELECT * FROM student_courses
      WHERE student_id = ${session.userId}
      ORDER BY created_at ASC
    `;

    return NextResponse.json({ ...profile, experiences, courses });
  } catch (error: any) {
    console.error('Error fetching student profile:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const session = await getSession();
    if (!session || session.role !== 'student') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    
    // Auto-map cluster if specialty is updated
    if (body.specialty && !body.cluster) {
      body.cluster = mapSpecialtyToCluster(body.specialty);
    }

    // 1. Update students table fields
    const studentAllowedFields = [
      'university', 'region', 'specialty', 'cluster', 'year_of_study', 
      'gpa_scale', 'gpa_value', 'onboarding_completed_at',
      'city', 'opportunity_types', 'employment_experience', 
      'hours_per_week', 'interests', 'target_role'
    ];

    const studentUpdateData: Record<string, any> = {};
    for (const key of studentAllowedFields) {
      if (body[key] !== undefined) {
        studentUpdateData[key] = body[key];
      }
    }
    
    if (Object.keys(studentUpdateData).length > 0) {
      const studentColumns = Object.keys(studentUpdateData);
      await sql`
        UPDATE students SET 
        ${sql(studentUpdateData, studentColumns as any)},
        updated_at = NOW()
        WHERE user_id = ${session.userId}
      `;
    }

    // 2. Update users table fields
    const userAllowedFields = ['name', 'email', 'phone'];
    const userUpdateData: Record<string, any> = {};
    for (const key of userAllowedFields) {
      if (body[key] !== undefined) {
        userUpdateData[key] = body[key];
      }
    }

    if (Object.keys(userUpdateData).length > 0) {
      const userColumns = Object.keys(userUpdateData);
      await sql`
        UPDATE users SET 
        ${sql(userUpdateData, userColumns as any)},
        updated_at = NOW()
        WHERE id = ${session.userId}
      `;
    }

    if (Object.keys(studentUpdateData).length === 0 && Object.keys(userUpdateData).length === 0) {
      return NextResponse.json({ error: 'No valid fields provided' }, { status: 400 });
    }

    // 3. Check for profile completion
    const [updatedProfile] = await sql`
      SELECT 
        s.user_id, s.university, s.region, s.specialty, s.cluster, s.year_of_study, 
        s.gpa_scale, s.gpa_value, s.onboarding_completed_at, s.city, 
        s.opportunity_types, s.employment_experience, s.hours_per_week, 
        s.interests, s.target_role, s.profile_completed_at, s.created_at, s.updated_at,
        u.name, u.email, u.phone 
      FROM students s
      JOIN users u ON s.user_id = u.id
      WHERE s.user_id = ${session.userId}
    `;

    const isComplete = 
      updatedProfile.name && updatedProfile.email && updatedProfile.phone &&
      updatedProfile.university && updatedProfile.region && updatedProfile.specialty &&
      updatedProfile.year_of_study && updatedProfile.gpa_scale && updatedProfile.gpa_value !== null &&
      updatedProfile.city && 
      (updatedProfile.opportunity_types && Array.isArray(updatedProfile.opportunity_types) ? updatedProfile.opportunity_types.length > 0 : true) && // Array check is safe fallback
      (updatedProfile.target_role && Array.isArray(updatedProfile.target_role) ? updatedProfile.target_role.length > 0 : !!updatedProfile.target_role) && 
      updatedProfile.hours_per_week && 
      (updatedProfile.interests && Array.isArray(updatedProfile.interests) ? updatedProfile.interests.length > 0 : true);

    if (isComplete && !updatedProfile.profile_completed_at) {
      await sql`UPDATE students SET profile_completed_at = NOW() WHERE user_id = ${session.userId}`;
    }

    // Internally call recompute readiness
    try {
      await computeStudentDimensions(session.userId);
    } catch (computeError) {
      console.error('Failed to compute dimensions after profile update:', computeError);
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error updating student profile:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
