import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { seedDatabaseIfEmpty } from '@/lib/seed';


export async function GET() {
  try {
    await connectToDatabase();
    await seedDatabaseIfEmpty();

    return NextResponse.json({
      success: true,
      message: 'MongoDB Atlas connected and initialized successfully.',
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('Database connection error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to connect to MongoDB Atlas',
        hint: 'Ensure MONGODB_URI is set properly in .env.local',
      },
      { status: 500 }
    );
  }
}
