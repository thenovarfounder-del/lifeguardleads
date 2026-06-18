import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { data, error } = await supabase.from('leads').insert([body]);
  if (error) return NextResponse.json({ error }, { status: 500 });
  return NextResponse.json({ success: true, data });
}
