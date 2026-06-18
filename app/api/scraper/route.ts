import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

const KEYWORDS = [
  'impact window', 'impact door', 'impact resistant',
  'hurricane window', 'hurricane door', 'window replacement',
  'door replacement', 'fenestration', 'opening protection',
  'impact glass', 'impact glazing', 'wind resistant'
];

function isImpactPermit(text: string): boolean {
  const lower = text.toLowerCase();
  return KEYWORDS.some(kw => lower.includes(kw));
}

// MIAMI-DADE - Open Data API
async function scrapeMiamiDade(): Promise<any[]> {
  const leads: any[] = [];
  try {
    const date = new Date();
    date.setDate(date.getDate() - 7);
    const dateStr = date.toISOString().split('T')[0];
    
    const url = `https://opendata.miamidade.gov/resource/nscw-7fv2.json?$limit=1000&$where=issue_date >= '${dateStr}'&$order=issue_date DESC`;
    const resp = await fetch(url);
    const data = await resp.json();
    
    for (const p of data) {
      const desc = `${p.work_description || ''} ${p.permit_type || ''}`;
      if (isImpactPermit(desc)) {
        leads.push({
          owner_name: p.owner_name || '',
          property_address: p.site_address || '',
          city: p.site_city || 'Miami',
          county: 'Miami-Dade',
          permit_number: p.permit_number || '',
          permit_type: p.work_description || '',
          permit_date: p.issue_date ? p.issue_date.substring(0, 10) : '',
          job_value: p.job_value ? `$${p.job_value}` : '',
          contractor: p.contractor_name || '',
          status: 'New',
        });
      }
    }
    console.log(`Miami-Dade: ${leads.length} permits found`);
  } catch (e) {
    console.error('Miami-Dade error:', e);
  }
  return leads;
}

// PALM BEACH - Open Data API  
async function scrapePalmBeach(): Promise<any[]> {
  const leads: any[] = [];
  try {
    const date = new Date();
    date.setDate(date.getDate() - 7);
    const dateStr = date.toISOString().split('T')[0];

    const url = `https://data.pbcgov.com/resource/building-permits.json?$limit=1000&$where=issue_date >= '${dateStr}'`;
    const resp = await fetch(url);
    const data = await resp.json();

    for (const p of data) {
      const desc = `${p.description || ''} ${p.work_type || ''}`;
      if (isImpactPermit(desc)) {
        leads.push({
          owner_name: p.owner_name || '',
          property_address: p.address || '',
          city: p.city || '',
          county: 'Palm Beach',
          permit_number: p.permit_number || '',
          permit_type: p.description || '',
          permit_date: p.issue_date ? p.issue_date.substring(0, 10) : '',
          job_value: p.job_value ? `$${p.job_value}` : '',
          contractor: p.contractor_name || '',
          status: 'New',
        });
      }
    }
    console.log(`Palm Beach: ${leads.length} permits found`);
  } catch (e) {
    console.error('Palm Beach error:', e);
  }
  return leads;
}

// ORANGE COUNTY (ORLANDO) - Open Data API
async function scrapeOrangeCounty(): Promise<any[]> {
  const leads: any[] = [];
  try {
    const date = new Date();
    date.setDate(date.getDate() - 7);
    const dateStr = date.toISOString().split('T')[0];

    const url = `https://data-ocfl.opendata.arcgis.com/api/explore/v2.1/catalog/datasets/building-permits/records?limit=100&where=issue_date >= date'${dateStr}'&order_by=issue_date DESC`;
    const resp = await fetch(url);
    const data = await resp.json();
    const records = data.results || [];

    for (const p of records) {
      const desc = `${p.description || ''} ${p.work_type || ''}`;
      if (isImpactPermit(desc)) {
        leads.push({
          owner_name: p.owner_name || '',
          property_address: p.address || '',
          city: p.city || 'Orlando',
          county: 'Orange',
          permit_number: p.permit_number || '',
          permit_type: p.description || '',
          permit_date: p.issue_date ? String(p.issue_date).substring(0, 10) : '',
          job_value: p.job_value ? `$${p.job_value}` : '',
          contractor: p.contractor_name || '',
          status: 'New',
        });
      }
    }
    console.log(`Orange County: ${leads.length} permits found`);
  } catch (e) {
    console.error('Orange County error:', e);
  }
  return leads;
}

// HILLSBOROUGH (TAMPA) - Open Data API
async function scrapeHillsborough(): Promise<any[]> {
  const leads: any[] = [];
  try {
    const date = new Date();
    date.setDate(date.getDate() - 7);
    const dateStr = date.toISOString().split('T')[0];

    const url = `https://data.hillsboroughcounty.org/resource/building-permits.json?$limit=1000&$where=issue_date >= '${dateStr}'`;
    const resp = await fetch(url);
    const data = await resp.json();

    for (const p of data) {
      const desc = `${p.description || ''} ${p.work_type || ''}`;
      if (isImpactPermit(desc)) {
        leads.push({
          owner_name: p.owner_name || '',
          property_address: p.address || '',
          city: p.city || 'Tampa',
          county: 'Hillsborough',
          permit_number: p.permit_number || '',
          permit_type: p.description || '',
          permit_date: p.issue_date ? p.issue_date.substring(0, 10) : '',
          job_value: p.job_value ? `$${p.job_value}` : '',
          contractor: p.contractor_name || '',
          status: 'New',
        });
      }
    }
    console.log(`Hillsborough: ${leads.length} permits found`);
  } catch (e) {
    console.error('Hillsborough error:', e);
  }
  return leads;
}

// ST LUCIE COUNTY
async function scrapeStLucie(): Promise<any[]> {
  const leads: any[] = [];
  try {
    const date = new Date();
    date.setDate(date.getDate() - 7);
    const dateStr = date.toISOString().split('T')[0];

    const url = `https://data.stlucieco.gov/resource/building-permits.json?$limit=1000&$where=issue_date >= '${dateStr}'`;
    const resp = await fetch(url);
    const data = await resp.json();

    for (const p of data) {
      const desc = `${p.description || ''} ${p.work_type || ''}`;
      if (isImpactPermit(desc)) {
        leads.push({
          owner_name: p.owner_name || '',
          property_address: p.address || '',
          city: p.city || 'Port St. Lucie',
          county: 'St. Lucie',
          permit_number: p.permit_number || '',
          permit_type: p.description || '',
          permit_date: p.issue_date ? p.issue_date.substring(0, 10) : '',
          job_value: p.job_value ? `$${p.job_value}` : '',
          contractor: p.contractor_name || '',
          status: 'New',
        });
      }
    }
    console.log(`St. Lucie: ${leads.length} permits found`);
  } catch (e) {
    console.error('St. Lucie error:', e);
  }
  return leads;
}

// SAVE TO SUPABASE - skip duplicates
async function saveLeads(leads: any[]): Promise<number> {
  let saved = 0;
  for (const lead of leads) {
    if (!lead.owner_name && !lead.property_address) continue;
    
    // Check for duplicate
    const { data: existing } = await supabase
      .from('leads')
      .select('id')
      .eq('permit_number', lead.permit_number)
      .eq('county', lead.county)
      .limit(1);
    
    if (existing && existing.length > 0) continue;
    
    const { error } = await supabase.from('leads').insert([lead]);
    if (!error) saved++;
  }
  return saved;
}

// SKIP TRACE WITH TRACERFY
async function skipTrace(leads: any[]): Promise<any[]> {
  const TRACERFY_KEY = process.env.TRACERFY_API_KEY;
  if (!TRACERFY_KEY || TRACERFY_KEY === 'YOUR_KEY') {
    console.log('Tracerfy not configured - skipping phone lookup');
    return leads;
  }
  
  const enriched = [];
  for (const lead of leads) {
    try {
      const resp = await fetch('https://api.tracerfy.com/v1/skip-trace', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${TRACERFY_KEY}`
        },
        body: JSON.stringify({
          name: lead.owner_name,
          address: lead.property_address,
          city: lead.city,
          state: 'FL'
        })
      });
      
      const data = await resp.json();
      if (data.phones && data.phones.length > 0) {
        lead.phone1 = data.phones[0] || '';
        lead.phone2 = data.phones[1] || '';
        lead.phone3 = data.phones[2] || '';
      }
      if (data.emails && data.emails.length > 0) {
        lead.email1 = data.emails[0] || '';
        lead.email2 = data.emails[1] || '';
        lead.email3 = data.emails[2] || '';
      }
      enriched.push(lead);
      await new Promise(r => setTimeout(r, 200));
    } catch (e) {
      enriched.push(lead);
    }
  }
  return enriched;
}

export async function GET(req: NextRequest) {
  const start = Date.now();
  console.log('=== LifeGuard Leads Scraper Starting ===');
  
  try {
    // Scrape all counties
    const [miamiLeads, palmBeachLeads, orangeLeads, hillsboroughLeads, stLucieLeads] = await Promise.all([
      scrapeMiamiDade(),
      scrapePalmBeach(),
      scrapeOrangeCounty(),
      scrapeHillsborough(),
      scrapeStLucie(),
    ]);

    const allLeads = [
      ...miamiLeads,
      ...palmBeachLeads,
      ...orangeLeads,
      ...hillsboroughLeads,
      ...stLucieLeads,
    ];

    console.log(`Total leads found: ${allLeads.length}`);

    // Skip trace for phone numbers
    const enrichedLeads = await skipTrace(allLeads);

    // Save to Supabase
    const saved = await saveLeads(enrichedLeads);

    const duration = ((Date.now() - start) / 1000).toFixed(1);
    
    return NextResponse.json({
      success: true,
      message: `Scraper complete in ${duration}s`,
      found: allLeads.length,
      saved: saved,
      counties: {
        'Miami-Dade': miamiLeads.length,
        'Palm Beach': palmBeachLeads.length,
        'Orange': orangeLeads.length,
        'Hillsborough': hillsboroughLeads.length,
        'St. Lucie': stLucieLeads.length,
      }
    });

  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
