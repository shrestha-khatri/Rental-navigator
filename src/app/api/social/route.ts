import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { userId, action, propertyId, visibility, precision } = body;

    if (action === 'delete_data') {
      await prisma.userPropertyAction.deleteMany({ where: { userId } });
      return NextResponse.json({ success: true, message: 'All social data deleted' });
    }

    if (action === 'set_home') {
      const updated = await prisma.userPropertyAction.upsert({
        where: {
          userId_propertyId: { userId, propertyId }
        },
        update: {
          living_status: 'CURRENT',
          visibility: visibility || 'ONLY_ME',
          precision: precision || 'BUILDING_ONLY'
        },
        create: {
          userId,
          propertyId,
          living_status: 'CURRENT',
          visibility: visibility || 'ONLY_ME',
          precision: precision || 'BUILDING_ONLY'
        }
      });
      return NextResponse.json({ success: true, data: updated });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
