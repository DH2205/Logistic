import { hashPassword } from '@/lib/auth';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/database';
import { authenticateToken } from '@/lib/middleware';
import { isAdmin, normalizeRole } from '@/lib/roles';
import { AdminUserUpdateSchema, formatZodErrors } from '@/lib/validation';

/**
 * PATCH /api/admin/users/:id
 * Admin only: update profile fields, role (e.g. appoint staff), optional password reset.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await authenticateToken(request);
    if ('error' in authResult) {
      return NextResponse.json(
        { message: authResult.error },
        { status: authResult.status }
      );
    }
    if (!isAdmin(authResult.role)) {
      return NextResponse.json(
        { message: 'Administrator access required.' },
        { status: 403 }
      );
    }

    const { id } = await params;
    const targetId = id?.trim();
    if (!targetId) {
      return NextResponse.json({ message: 'User id required' }, { status: 400 });
    }

    const row = await db.get('users').find({ id: targetId }).value();
    if (!row) {
      return NextResponse.json({ message: 'User not found' }, { status: 404 });
    }

    const body = await request.json().catch(() => ({}));
    const parsed = AdminUserUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { message: 'Invalid update', errors: formatZodErrors(parsed.error.issues) },
        { status: 400 }
      );
    }

    const d = parsed.data;
    if (d.email !== undefined) {
      const other = await db.get('users').find({ email: d.email }).value();
      if (other && String((other as { id?: string }).id) !== targetId) {
        return NextResponse.json(
          { message: 'Another account already uses this email.' },
          { status: 409 }
        );
      }
    }

    const updates: Record<string, unknown> = {};
    if (d.name !== undefined) updates.name = d.name;
    if (d.email !== undefined) updates.email = d.email;
    if (d.phone !== undefined) updates.phone = d.phone;
    if (d.address !== undefined) updates.address = d.address;
    if (d.role !== undefined) updates.role = d.role;

    if (d.password !== undefined) {
      updates.password = await hashPassword(d.password);
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ message: 'No changes supplied.' }, { status: 400 });
    }

    updates.updated_at = new Date().toISOString();

    const updateResult = await db.get('users').find({ id: targetId }).assign(updates);
    const updated = updateResult.value();
    if (!updated) {
      return NextResponse.json({ message: 'Failed to update user' }, { status: 500 });
    }

    const u = updated as Record<string, unknown>;
    return NextResponse.json({
      success: true,
      user: {
        id: String(u.id ?? ''),
        email: u.email,
        name: u.name,
        phone: u.phone ?? null,
        address: u.address ?? null,
        role: normalizeRole(String(u.role ?? 'customer')),
        uniqueIdUser: String(u.unique_id_user ?? u.id ?? ''),
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error patching admin user:', error);
    return NextResponse.json(
      { message: 'Server error', error: message },
      { status: 500 }
    );
  }
}
