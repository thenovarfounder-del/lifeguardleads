import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const SHOVELS_KEY = process.env.SHOVELS_API_KEY;
const TRACERFY_KEY = process.env.TRACERFY_API_KEY;

const COUNTIES = [
  'Miami-Dade','Broward','Palm Beach','Orange','Osceola',
  'Seminole','Lake','Polk','Hillsborough','Collier',
  'St. Lucie','Martin','Indian River'
];

// Step 1 - Pull window/door permits from Shovels
async function fetchFromShovels() {
  const leads = [];
  try {
    const date = new Date();
    date.setDate(date.getDate() - 7);
    const dateStr = date.toISOString().split('T')[0];

    const url = 'https://api.shovels.ai/v2/permits?' + new URLSearchParams({
      state: 'FL',
      category: 'window_door',
      date_start: dateStr,
      limit: '500',
    });

    const resp = await fetch(url, {
      headers: {
        'X-API-Key': SHOVELS_KEY,
        'Content-Type': 'application/json',
      }
    });

    const data = await resp.json();
    const permits = data.permits || data.items || data.results || data || [];

    console.log('Shovels returned:', permits.length, 'permits');

    for (const p of permits) {
      const county = COUNTIES.find(c =>
        (p.county || '').toLowerCase().includes(c.toLowerCase().split(' ')[0])
      ) || p.county || 'Unknown';

      leads.push({
        owner_name: p.owner_name || p.applicant_name || '',
        property_address: p.address || p.site_address || p.street_address || '',
        city: p.city || p.site_city || '',
        county: county,
        state: 'FL',
        permit_number: p.permit_number || p.id || '',
        permit_type: p.description || p.work_description || 'Impact Window/Door',
        permit_date: p.issue_date ? String(p.issue_date).substring(0,10) : '',
        job_value: p.fees_total ? '$'+p.fees_total : p.job_value ? '$'+p.job_value : '',
        contractor: p.contractor_name || '',
        status: 'New',
      });
    }
  } catch(e) {
    console.error('Shovels error:', e.message);
  }
  return leads;
}

// Step 2 - Send to Tracerfy to get phone numbers
async function enrichWithTracerfy(leads) {
  if (!leads.length) return leads;

  try {
    // Submit batch to Tracerfy
    const addresses = leads.map(l => ({
      address: l.property_address,
      city: l.city,
      state: 'FL',
    }));

    const submitResp = await fetch('https://tracerfy.com/v1/api/trace/', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + TRACERFY_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ addresses, trace_type: 'normal' })
    });

    const submitData = await submitResp.json();
    const queueId = submitData.id || submitData.queue_id;

    if (!queueId) {
      console.log('Tracerfy queue not created:', JSON.stringify(submitData));
      return leads;
    }

    console.log('Tracerfy queue created:', queueId);

    // Wait for processing (poll every 5 seconds, max 60 seconds)
    let attempts = 0;
    let enriched = null;

    while (attempts < 12) {
      await new Promise(r => setTimeout(r, 5000));
      const checkResp = await fetch('https://tracerfy.com/v1/api/queue/' + queueId, {
        headers: { 'Authorization': 'Bearer ' + TRACERFY_KEY }
      });
      const checkData = await checkResp.json();

      if (!checkData.pending && checkData.download_url) {
        // Download the enriched CSV
        const csvResp = await fetch(checkData.download_url);
        const csvText = await csvResp.text();
        enriched = parseTracerfyCSV(csvText, leads);
        break;
      }
      attempts++;
    }

    return enriched || leads;

  } catch(e) {
    console.error('Tracerfy error:', e.message);
    return leads;
  }
}

function parseTracerfyCSV(csv, originalLeads) {
  const lines = csv.trim().split('\n');
  if (lines.length < 2) return originalLeads;

  const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/"/g,''));
  const enriched = [...originalLeads];

  for (let i = 1; i < lines.length; i++) {
    const vals = lines[i].split(',').map(v => v.trim().replace(/^"|"$/g,''));
    const row = {};
    headers.forEach((h, idx) => { row[h] = vals[idx] || ''; });

    const address = (row.address || '').toLowerCase();
    const match = enriched.find(l =>
      l.property_address.toLowerCase().includes(address.split(' ')[0]) ||
      address.includes((l.property_address || '').toLowerCase().split(' ')[0])
    );

    if (match) {
      match.phone1 = row.primary_phone || row.mobile_1 || row.phone_1 || '';
      match.phone2 = row.mobile_2 || row.phone_2 || '';
      match.phone3 = row.mobile_3 || row.phone_3 || '';
      match.email1 = row.email_1 || row.email1 || '';
      match.email2 = row.email_2 || row.email2 || '';
      if (row.first_name && !match.owner_name) {
        match.owner_name = (row.first_name + ' ' + row.last_name).trim();
      }
    }
  }

  return enriched;
}

// Step 3 - Save to Supabase skipping duplicates
async function saveLeads(leads) {
  let saved = 0;
  let skipped = 0;

  for (const lead of leads) {
    if (!lead.owner_name && !lead.property_address) continue;

    const { data: existing } = await supabase
      .from('leads')
      .select('id')
      .eq('permit_number', lead.permit_number || '')
      .eq('property_address', lead.property_address || '')
      .limit(1);

    if (existing && existing.length > 0) {
      skipped++;
      continue;
    }

    const { error } = await supabase.from('leads').insert([{
      ...lead,
      date_scraped: new Date().toISOString()
    }]);

    if (!error) saved++;
  }

  return { saved, skipped };
}

export async function GET() {
  const start = Date.now();
  console.log('=== LifeGuard Leads Auto-Fetch Starting ===');

  try {
    // Step 1 - Get permits from Shovels
    console.log('Step 1: Fetching from Shovels...');
    const leads = await fetchFromShovels();
    console.log('Found:', leads.length, 'permits');

    if (leads.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No new permits found',
        found: 0,
        saved: 0,
        duration: ((Date.now()-start)/1000).toFixed(1)+'s'
      });
    }

    // Step 2 - Enrich with phone numbers via Tracerfy
    console.log('Step 2: Enriching with Tracerfy...');
    const enriched = await enrichWithTracerfy(leads);
    const withPhones = enriched.filter(l => l.phone1).length;
    console.log('Leads with phones:', withPhones);

    // Step 3 - Save to dashboard
    console.log('Step 3: Saving to dashboard...');
    const { saved, skipped } = await saveLeads(enriched);

    const duration = ((Date.now()-start)/1000).toFixed(1);
    console.log('Complete:', saved, 'saved,', skipped, 'skipped in', duration+'s');

    return NextResponse.json({
      success: true,
      message: 'Auto-fetch complete',
      found: leads.length,
      with_phones: withPhones,
      saved,
      skipped,
      duration: duration+'s'
    });

  } catch(e) {
    console.error('Auto-fetch error:', e);
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}
