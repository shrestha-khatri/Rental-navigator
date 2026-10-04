import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId'); 
    const dateStr = searchParams.get('date') || new Date().toISOString().split('T')[0];
    
    // Explicitly treat date strings as UTC midnight to match effective_from DB semantics
    const targetDate = new Date(`${dateStr}T00:00:00Z`);
    
    // Bounds: minLng, minLat, maxLng, maxLat
    const bounds = searchParams.get('bbox')?.split(',').map(Number);
    
    // Basic spatial filter
    let whereClause: any = {};
    if (bounds && bounds.length === 4) {
      whereClause = {
        latitude: { gte: bounds[1], lte: bounds[3] },
        longitude: { gte: bounds[0], lte: bounds[2] }
      };
    }

    // Fetch properties
    const properties = await prisma.mapProperty.findMany({
      where: whereClause,
      include: {
        rule_caches: {
          where: {
            target_date: targetDate
          }
        },
        user_actions: {
          include: {
            user: true
          }
        }
      }
    });

    // PRIVACY ENFORCEMENT: Filter social data server-side
    let userFriends: string[] = [];
    if (userId) {
      const friendships = await prisma.friendship.findMany({
        where: {
          status: 'ACCEPTED',
          OR: [{ userAId: userId }, { userBId: userId }]
        }
      });
      userFriends = friendships.map(f => f.userAId === userId ? f.userBId : f.userAId);
    }

    const processedProperties = properties.map(prop => {
      // Filter out living_status if the requester doesn't have permission
      const safeActions = prop.user_actions.map(action => {
        if (action.userId === userId) return action; // Can see own data
        
        const isFriend = userFriends.includes(action.userId);
        if (!isFriend || action.visibility === 'ONLY_ME') {
          // Strip private data
          return { ...action, living_status: null };
        }
        
        if (action.visibility === 'ALL_FRIENDS' && isFriend) {
          // Maybe downgrade exact address if precision is BUILDING_ONLY
          // Since we are returning the whole property anyway, we just pass the action.
          return action;
        }
        
        return { ...action, living_status: null };
      }).filter(a => a.is_liked || a.living_status);

      return {
        ...prop,
        user_actions: safeActions
      };
    });

    return NextResponse.json({ properties: processedProperties });

  } catch (error: any) {
    console.error('Map API Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
