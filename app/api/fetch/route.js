import { NextResponse } from 'next/server';

const SHOVELS_KEY = process.env.SHOVELS_API_KEY;
const BASE_URL = 'https://api.shovels.ai/v2';

export async function GET() {
  try {
    // Test 1 - Check API key works
    const testResp = await fetch(BASE_URL + '/meta/release', {
      headers: { 'X-API-Key': SHOVELS_KEY }
    });
    const testData = await testResp.json();

    // Test 2 - Search FL window door permits
    const params = new URLSearchParams({
      geo_id: 'FL',
      permit_from: '2026-06-01',
      permit_to: '2026-06-18',
      permit_tags: 'window_door',
      size: '10',
    });

    const searchResp = await fetch(BASE_URL + '/permits/search?' + params, {
      headers: { 'X-API-Key': SHOVELS_KEY }
    });
    const searchText = await searchResp.text();
    const searchStatus = searchResp.status;

    // Test 3 - Try without tags
    const params2 = new URLSearchParams({
      geo_id: 'FL',
      permit_from: '2026-06-01',
      permit_to: '2026-06-18',
      size: '5',
    });

    const search2Resp = await fetch(BASE_URL + '/permits/search?' + params2, {
      headers: { 'X-API-Key': SHOVELS_KEY }
    });
    const search2Text = await search2Resp.text();
    const search2Status = search2Resp.status;

    return NextResponse.json({
      api_key_present: !!SHOVELS_KEY,
      api_key_first10: SHOVELS_KEY ? SHOVELS_KEY.substring(0,10) : 'missing',
      meta_test: testData,
      search_with_tags_status: searchStatus,
      search_with_tags: JSON.parse(searchText),
      search_without_tags_status: search2Status,
      search_without_tags: JSON.parse(search2Text),
    });

  } catch(e) {
    return NextResponse.json({ error: e.message, stack: e.stack });
  }
}
