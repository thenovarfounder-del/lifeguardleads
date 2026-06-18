import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const SHOVELS_KEY = process.env.SHOVELS_API_KEY;
const TRACERFY_KEY = process.env.TRACERFY_API_KEY;
const BASE_URL = 'https://api.shovels.ai/v2';

// Step 1 - Pull window/door permits from Shovels
async function fetchFromShovels() {
  const leads = [];
  try {
    const dateTo = new Date().toISOString().split('T')[0];
    const dateFrom = new Date(Date.now() - 7*24*60*60*1000).toISOString().split('T')[0];

    // Search Florida window/door permits
    const params = new URLSearchParams({
      geo_id: 'FL',
      permit_from: dateFrom,
      permit_to: dateTo,
      permit_tags: 'window_door',
      size: '500',
    });

    const url = BASE_URL + '/permits/search?' + params.toString();
    console.log('Fetching:', url);

    const resp = await fetch(url, {
      headers: { 'X-API-Key': SHOVELS_KEY }
    });

    const raw = await resp.text();
    console.log('Shovels raw response:', raw.substring(0, 300));

    const data = JSON.parse(raw);
    const permits = data.items || data.permits || data.results || [];
    console.log('Permits found:', permits.length);

    for (const p of permits) {
      leads.push({
        owner_name: p.owner_name || p.applicant || '',
        property_address: p.address || p.street || '',
        city: p.city || '',
        county: p.county || 'Florida',
        state: 'FL',
        permit_number: p.number || p.id || '',
        permit_type: p.description || 'Impact Window/Door',
        permit_date: p.file_date || p.issue_date || '',
        job_value: p.fees_total ? '$'+p.fees_total : '',
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
    const addresses = leads
      .filter(l => l.property_address)
      .map(l => ({
        address: l.property_address,
        city: l.city,
        state: 'FL',
      }));

    if (!addresses.length) return leads;

    console.log('Sending', addresses.length, 'addresses to Tracerfy...');

    const submitResp = await fetch('https://tracerfy.com/v1/api/trace/', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + TRACERFY_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ addresses, trace_type: 'normal' })
    });

    const submitText = await submitResp.text();
    console.log('Tracerfy submit response:', submitText.substring(0, 200));
    const submitData = JSON.parse(submitText);
    const queueId = submitData.id || submitData.queue_id;

    if (!queueId) return leads;
    console.log('Tracerfy queue ID:', queueId);

    // Poll for completion max 55 seconds
    for (let i = 0; i < 11; i++) {
      await new Promise(r => setTimeout(r, 5000));
      const checkResp = await fetch('https://tracerfy.com/v1/api/queue/' + queueId, {
        headers: { 'Authorization': 'Bearer ' + TRACERFY_KEY }
      });
      const checkData = await checkResp.json();
      console.log('Queue status pending:', checkData.pending);

      if (!checkData.pending && checkData.download_url) {
        const csvResp = await fetch(checkData.download_url);
        const csvText = await csvResp.text();
        return parseTracerfyCSV(csvText, leads);
      }
    }
  } catch(e) {
    console.error('Tracerfy error:', e.message);
  }
  return leads;
}

function parseTracerfyCSV(csv, originalLeads) {
  try {
    const lines = csv.trim().split('\n');
    if (lines.length < 2) return originalLeads;
    const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/"/g,''));
    const enriched = [...originalLeads];

    for (let i = 1; i < lines.length; i++) {
      const vals = lines[i].split(',').map(v => v.trim().replace(/^"|"$/g,''));
      const row = {};
      headers.forEach((h, idx) => { row[h] = vals[idx] || ''; });

      const rowAddr = (row.address || '').toLowerCase().trim();
      const match = enriched.find(l => {
        const leadAddr = (l.property_address || '').toLowerCase().trim();
        return leadAddr && rowAddr && (
          leadAddr.includes(rowAddr.split(' ')[0]) ||
          rowAddr.includes(leadAddr.split(' ')[0])
        );
      });

      if (match) {
        match.phone1 = row.primary_phone || row.mobile_1 || '';
        match.phone2 = row.mobile_2 || '';
        match.phone3 = row.mobile_3 || '';
        match.email1 = row.email_1 || '';
        match.email2 = row.email_2 || '';
        if ((row.first_name || row.last_name) && !match.owner_name) {
          match.owner_name = ((row.first_name||'') + ' ' + (row.last_name||'')).trim();
        }
      }
    }
    return enriched;
  } catch(e) {
    console.error('CSV parse error:', e.message);
    return originalLeads;
  }
}

async function saveLeads(leads) {
  let saved = 0;
  let skipped = 0;

  for (const lead of leads) {
    if (!lead.property_address) continue;

    const { data: existing } = await supabase
      .from('leads')
      .select('id')
      .eq('property_address', lead.property_address)
      .limit(1);

    if (existing && existing.length > 0) { skipped++; continue; }

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
  console.log('=== LifeGuard Leads Fetch Starting ===');

  try {
    const leads = await fetchFromShovels();

    if (leads.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No new permits found from Shovels',
        found: 0,
        saved: 0,
        duration: ((Date.now()-start)/1000).toFixed(1)+'s'
      });
    }

    const enriched = await enrichWithTracerfy(leads);
    const withPhones = enriched.filter(l => l.phone1).length;
    const { saved, skipped } = await saveLeads(enriched);

    return NextResponse.json({
      success: true,
      message: 'Fetch complete',
      found: leads.length,
      with_phones: withPhones,
      saved,
      skipped,
      duration: ((Date.now()-start)/1000).toFixed(1)+'s'
    });

  } catch(e) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}
