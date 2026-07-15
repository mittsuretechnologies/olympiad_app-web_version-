import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/auth-guard';

export async function GET(request: Request) {
  const { error } = requireRole(request, ['SUPERADMIN']);
  if (error) return error;
  try {
    const uploaders = await prisma.uploader.findMany({
      orderBy: { createdAt: 'desc' },
    });
    return NextResponse.json(uploaders);
  } catch (error) {
    console.error('GET /api/uploaders failed:', error);
    return NextResponse.json({ message: 'Failed to fetch uploaders' }, { status: 500 });
  }
}

async function generateUploaderId(): Promise<string> {
  const last = await prisma.uploader.findFirst({
    where: { uploaderId: { startsWith: 'UPL' } },
    orderBy: { uploaderId: 'desc' },
    select: { uploaderId: true },
  });
  const lastNum = last ? parseInt(last.uploaderId.replace('UPL', ''), 10) : 0;
  const nextNum = (isNaN(lastNum) ? 0 : lastNum) + 1;
  return `UPL${String(nextNum).padStart(3, '0')}`;
}

function generatePassword(length = 10): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789abcdefghijkmnpqrstuvwxyz';
  let out = '';
  for (let i = 0; i < length; i++) out += chars.charAt(Math.floor(Math.random() * chars.length));
  return out;
}

// e.g. "Tushar Joshi" + "UPL001" → "TUS001" (name prefix + numeric suffix)
function generateUsername(name: string, uploaderId: string): string {
  const numPart = uploaderId.replace(/[^0-9]/g, ''); // "001"
  const namePart = name.replace(/[^A-Za-z]/g, '').toUpperCase().slice(0, 10 - numPart.length);
  return (namePart + numPart).slice(0, 10);
}

export async function POST(request: Request) {
  const { error } = requireRole(request, ['SUPERADMIN']);
  if (error) return error;
  try {
    const body = await request.json();
    const name = (body.name ?? '').toString().trim();
    const email = (body.email ?? '').toString().trim();
    const phone = (body.phone ?? '').toString().trim();

    if (!name) {
      return NextResponse.json({ message: 'Uploader name is required' }, { status: 400 });
    }

    for (let attempt = 0; attempt < 3; attempt++) {
      const uploaderId = await generateUploaderId();
      const plainPassword = generatePassword(10);
      const hashedPassword = await bcrypt.hash(plainPassword, 10);

      try {
        const uploader = await prisma.uploader.create({
          data: {
            uploaderId,
            name,
            email: email || null,
            phone: phone || null,
            username: generateUsername(name, uploaderId),
            password: hashedPassword,
          },
        });

        return NextResponse.json({
          ...uploader,
          credentials: {
            username: uploader.username,
            password: plainPassword,
          },
        });
      } catch (err: any) {
        if (err?.code === 'P2002' && attempt < 2) continue;
        throw err;
      }
    }

    return NextResponse.json({ message: 'Could not allocate uploaderId' }, { status: 500 });
  } catch (error) {
    console.error('POST /api/uploaders failed:', error);
    return NextResponse.json({ message: 'Failed to create uploader' }, { status: 500 });
  }
}
