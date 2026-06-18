'use client';
import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

const COUNTIES = ['All Counties','Miami-Dade','Broward','Palm Beach','Orange','Osceola','Seminole','Lake','Polk','Hillsborough','Collier','St. Lucie','Martin','Indian River'];
const STATUSES = ['All','New','Called','Interested','Closed','Dead'];
const statusColor = {
  'New': '#0EA5E9',
  'Called': '#F59E0B',
  'Interested': '#8B5CF6',
  'Closed': '#22C55E',
  'Dead': '#EF4444',
};

export default function Dashboard() {
  const router = useRouter();
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [county, setCounty] = useState('All Counties');
  const [status, setStatus] = useState('All');
  const [search, setSearch] = useState('');
  const [stats, setStats] = useState({ total:0, new:0, called:0, interested:0, closed:0 });
  const [selectedLead, setSelectedLead] = useState(null);
  const [notes, setNotes] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [showCSV, setShowCSV] = useState(false);
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const fileRef = useRef(null);
  const [newLead, setNewLead] = useState({
    owner_name:'', property_address:'', city:'', county:'Miami-Dade',
    phone1:'', phone2:'', email1:'', permit_type:'Impact Window/Door',
    permit_date:'', job_value:'', permit_number:'', contractor:''
  });

  useEffect(() => {
    if (typeof window !== 'undefined') {
      if (!localStorage.getItem('lg_auth')) {
        router.push('/');
        return;
      }
    }
    fetchLeads();
  }, [county, status]);

  const fetchLeads = async () => {
    setLoading(true);
    let query = supabase.from('leads').select('*').order('date_scraped', { ascending: false });
    if (county !== 'All Counties') query = query.eq('county', county);
    if (status !== 'All') query = query.eq('status', status);
    const { data } = await query.limit(500);
    setLeads(data || []);
    const { data: all } = await supabase.from('leads').select('status');
    if (all) {
      setStats({
        total: all.length,
        new: all.filter(l => l.status === 'New').length,
        called: all.filter(l => l.status === 'Called').length,
        interested: all.filter(l => l.status === 'Interested').length,
        closed: all.filter(l => l.status === 'Closed').length,
      });
    }
    setLoading(false);
  };

  const updateStatus = async (id, newStatus) => {
    await supabase.from('leads').update({ status: newStatus }).eq('id', id);
    fetchLeads();
    if (selectedLead?.id === id) setSelectedLead({...selectedLead, status: newStatus});
  };

  const saveNotes = async () => {
    if (!selectedLead) return;
    await supabase.from('leads').update({ notes }).eq('id', selectedLead.id);
    fetchLeads();
    alert('Notes saved!');
  };

  const saveNewLead = async () => {
    if (!newLead.owner_name && !newLead.property_address) {
      alert('Please enter at least a name or address');
      return;
    }
    setSaving(true);
    const { error } = await supabase.from('leads').insert([{
      ...newLead,
      status: 'New',
      date_scraped: new Date().toISOString()
    }]);
    if (error) {
      alert('Error saving lead: ' + error.message);
    } else {
      setShowAddForm(false);
      setNewLead({
        owner_name:'', property_address:'', city:'', county:'Miami-Dade',
        phone1:'', phone2:'', email1:'', permit_type:'Impact Window/Door',
        permit_date:'', job_value:'', permit_number:'', contractor:''
      });
      fetchLeads();
    }
    setSaving(false);
  };

  const parseCSV = (text) => {
    const lines = text.trim().split('\n');
    if (lines.length < 2) return [];
    const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/[^a-z0-9_]/g,'_').replace(/"/g,''));
    const rows = [];
    for (let i = 1; i < lines.length; i++) {
      const vals = lines[i].split(',').map(v => v.trim().replace(/^"|"$/g,''));
      const row = {};
      headers.forEach((h, idx) => { row[h] = vals[idx] || ''; });
      rows.push(row);
    }
    return rows;
  };

  const mapRow = (row) => {
    // Try to map common CSV column names to our schema
    return {
      owner_name: row.owner_name || row.name || row.owner || row.full_name || row.contact_name || '',
      property_address: row.property_address || row.address || row.street_address || row.site_address || '',
      city: row.city || row.site_city || '',
      county: row.county || 'Unknown',
      phone1: row.phone1 || row.phone || row.phone_1 || row.mobile || row.cell || row.telephone || '',
      phone2: row.phone2 || row.phone_2 || row.alt_phone || '',
      phone3: row.phone3 || row.phone_3 || '',
      email1: row.email1 || row.email || row.email_address || '',
      email2: row.email2 || row.email_2 || '',
      permit_number: row.permit_number || row.permit_no || row.permit || '',
      permit_type: row.permit_type || row.description || row.work_description || 'Impact Window/Door',
      permit_date: row.permit_date || row.issue_date || row.date || row.filed_date || '',
      job_value: row.job_value || row.value || row.estimated_value || row.contract_value || '',
      contractor: row.contractor || row.contractor_name || '',
      status: 'New',
      date_scraped: new Date().toISOString(),
    };
  };

  const handleCSVUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setImporting(true);
    setImportResult(null);

    const text = await file.text();
    const rows = parseCSV(text);

    if (rows.length === 0) {
      setImportResult({ error: 'No data found in CSV file' });
      setImporting(false);
      return;
    }

    const mapped = rows.map(mapRow).filter(r => r.owner_name || r.property_address);
    let saved = 0;
    let failed = 0;

    // Import in batches of 50
    const batchSize = 50;
    for (let i = 0; i < mapped.length; i += batchSize) {
      const batch = mapped.slice(i, i + batchSize);
      const { error } = await supabase.from('leads').insert(batch);
      if (error) {
        failed += batch.length;
      } else {
        saved += batch.length;
      }
    }

    setImportResult({ saved, failed, total: rows.length });
    setImporting(false);
    fetchLeads();
    if (fileRef.current) fileRef.current.value = '';
  };

  const filtered = leads.filter(l =>
    search === '' ||
    l.owner_name?.toLowerCase().includes(search.toLowerCase()) ||
    l.property_address?.toLowerCase().includes(search.toLowerCase()) ||
    l.phone1?.includes(search)
  );

  const logout = () => {
    localStorage.removeItem('lg_auth');
    router.push('/');
  };

  const fields = [
    {label:'Owner Name',key:'owner_name',placeholder:'John Smith'},
    {label:'Property Address',key:'property_address',placeholder:'123 Main St'},
    {label:'City',key:'city',placeholder:'Miami'},
    {label:'Phone 1',key:'phone1',placeholder:'(305) 555-0000'},
    {label:'Phone 2',key:'phone2',placeholder:'(305) 555-0001'},
    {label:'Email',key:'email1',placeholder:'owner@email.com'},
    {label:'Permit Number',key:'permit_number',placeholder:'BLD-2026-00123'},
    {label:'Job Value',key:'job_value',placeholder:'$25,000'},
    {label:'Permit Date',key:'permit_date',placeholder:'2026-06-18'},
    {label:'Contractor',key:'contractor',placeholder:'ABC Windows LLC'},
  ];

  return (
    <div style={{minHeight:'100vh',background:'#0F172A'}}>
      {/* NAV */}
      <div style={{background:'#1E293B',borderBottom:'1px solid #334155',padding:'0 24px',display:'flex',alignItems:'center',justifyContent:'space-between',height:'64px'}}>
        <div style={{display:'flex',alignItems:'center',gap:'12px'}}>
          <span style={{fontSize:'24px'}}>🛡️</span>
          <div>
            <div style={{fontSize:'16px',fontWeight:'700',color:'#fff'}}>LifeGuard Leads</div>
            <div style={{fontSize:'11px',color:'#64748B'}}>Florida Impact Window Lead Machine</div>
          </div>
        </div>
        <div style={{display:'flex',alignItems:'center',gap:'12px'}}>
          <div style={{fontSize:'13px',color:'#64748B'}}>{new Date().toLocaleDateString('en-US',{weekday:'long',year:'numeric',month:'long',day:'numeric'})}</div>
          <button onClick={() => setShowCSV(true)} style={{background:'#7C3AED',color:'#fff',border:'none',borderRadius:'6px',padding:'8px 16px',fontSize:'13px',fontWeight:'600',cursor:'pointer'}}>📂 Import CSV</button>
          <button onClick={() => setShowAddForm(true)} style={{background:'#22C55E',color:'#fff',border:'none',borderRadius:'6px',padding:'8px 16px',fontSize:'13px',fontWeight:'600',cursor:'pointer'}}>+ Add Lead</button>
          <button onClick={logout} style={{background:'#334155',color:'#94A3B8',border:'none',borderRadius:'6px',padding:'8px 16px',fontSize:'13px',cursor:'pointer'}}>Logout</button>
        </div>
      </div>

      <div style={{padding:'24px'}}>
        {/* STATS */}
        <div style={{display:'grid',gridTemplateColumns:'repeat(5,1fr)',gap:'16px',marginBottom:'24px'}}>
          {[
            {label:'Total Leads',value:stats.total,color:'#0EA5E9',icon:'📋'},
            {label:'New Today',value:stats.new,color:'#0EA5E9',icon:'🔥'},
            {label:'Called',value:stats.called,color:'#F59E0B',icon:'📞'},
            {label:'Interested',value:stats.interested,color:'#8B5CF6',icon:'⭐'},
            {label:'Closed',value:stats.closed,color:'#22C55E',icon:'✅'},
          ].map(stat => (
            <div key={stat.label} style={{background:'#1E293B',border:'1px solid #334155',borderTop:'3px solid '+stat.color,borderRadius:'8px',padding:'20px'}}>
              <div style={{fontSize:'24px',marginBottom:'8px'}}>{stat.icon}</div>
              <div style={{fontSize:'28px',fontWeight:'700',color:stat.color}}>{stat.value}</div>
              <div style={{fontSize:'12px',color:'#64748B',marginTop:'4px'}}>{stat.label}</div>
            </div>
          ))}
        </div>

        {/* FILTERS */}
        <div style={{background:'#1E293B',border:'1px solid #334155',borderRadius:'8px',padding:'16px',marginBottom:'16px',display:'flex',gap:'12px',flexWrap:'wrap',alignItems:'center'}}>
          <input placeholder="Search name, address, phone..." value={search} onChange={e => setSearch(e.target.value)}
            style={{flex:1,minWidth:'200px',padding:'10px 14px',background:'#0F172A',border:'1px solid #334155',borderRadius:'6px',fontSize:'13px',color:'#fff',outline:'none'}}/>
          <select value={county} onChange={e => setCounty(e.target.value)}
            style={{padding:'10px 14px',background:'#0F172A',border:'1px solid #334155',borderRadius:'6px',fontSize:'13px',color:'#fff',outline:'none'}}>
            {COUNTIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <select value={status} onChange={e => setStatus(e.target.value)}
            style={{padding:'10px 14px',background:'#0F172A',border:'1px solid #334155',borderRadius:'6px',fontSize:'13px',color:'#fff',outline:'none'}}>
            {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <button onClick={fetchLeads} style={{background:'#0EA5E9',color:'#fff',border:'none',borderRadius:'6px',padding:'10px 20px',fontSize:'13px',fontWeight:'600',cursor:'pointer'}}>Refresh</button>
        </div>

        <div style={{display:'grid',gridTemplateColumns:selectedLead ? '1fr 380px' : '1fr',gap:'16px'}}>
          {/* TABLE */}
          <div style={{background:'#1E293B',border:'1px solid #334155',borderRadius:'8px',overflow:'hidden'}}>
            <div style={{padding:'16px 20px',borderBottom:'1px solid #334155',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
              <div style={{fontSize:'15px',fontWeight:'600',color:'#fff'}}>{filtered.length} Leads</div>
              <div style={{fontSize:'12px',color:'#64748B'}}>Click a lead to view details</div>
            </div>
            <div style={{overflowX:'auto'}}>
              <table style={{width:'100%',borderCollapse:'collapse'}}>
                <thead>
                  <tr style={{background:'#0F172A'}}>
                    {['Owner Name','Address','County','Phone','Permit Date','Job Value','Status','Actions'].map(h => (
                      <th key={h} style={{padding:'10px 16px',fontSize:'11px',fontWeight:'600',color:'#64748B',textTransform:'uppercase',letterSpacing:'1px',textAlign:'left',whiteSpace:'nowrap'}}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan={8} style={{padding:'40px',textAlign:'center',color:'#64748B'}}>Loading leads...</td></tr>
                  ) : filtered.length === 0 ? (
                    <tr><td colSpan={8} style={{padding:'40px',textAlign:'center',color:'#64748B'}}>No leads yet. Click Import CSV or + Add Lead to get started.</td></tr>
                  ) : filtered.map((lead, i) => (
                    <tr key={lead.id} onClick={() => { setSelectedLead(lead); setNotes(lead.notes || ''); }}
                      style={{borderBottom:'1px solid #1E293B',cursor:'pointer',background:selectedLead?.id===lead.id?'#1E3A5F':i%2===0?'#1E293B':'#162032'}}>
                      <td style={{padding:'12px 16px',fontSize:'13px',color:'#fff',fontWeight:'500',whiteSpace:'nowrap'}}>{lead.owner_name || '—'}</td>
                      <td style={{padding:'12px 16px',fontSize:'12px',color:'#94A3B8',maxWidth:'200px',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{lead.property_address || '—'}</td>
                      <td style={{padding:'12px 16px',fontSize:'12px',color:'#64748B',whiteSpace:'nowrap'}}>{lead.county || '—'}</td>
                      <td style={{padding:'12px 16px',fontSize:'13px',color:'#22C55E',fontWeight:'600',whiteSpace:'nowrap'}}>{lead.phone1 || '—'}</td>
                      <td style={{padding:'12px 16px',fontSize:'12px',color:'#64748B',whiteSpace:'nowrap'}}>{lead.permit_date || '—'}</td>
                      <td style={{padding:'12px 16px',fontSize:'12px',color:'#F59E0B',fontWeight:'600',whiteSpace:'nowrap'}}>{lead.job_value || '—'}</td>
                      <td style={{padding:'12px 16px'}}>
                        <span style={{background:(statusColor[lead.status]||'#0EA5E9')+'22',color:statusColor[lead.status]||'#0EA5E9',fontSize:'11px',fontWeight:'600',padding:'3px 10px',borderRadius:'12px'}}>{lead.status}</span>
                      </td>
                      <td style={{padding:'12px 16px'}}>
                        <div style={{display:'flex',gap:'4px'}} onClick={e => e.stopPropagation()}>
                          <button onClick={() => updateStatus(lead.id,'Called')} style={{background:'#F59E0B22',color:'#F59E0B',border:'none',borderRadius:'4px',padding:'4px 8px',fontSize:'11px',cursor:'pointer',fontWeight:'600'}}>Called</button>
                          <button onClick={() => updateStatus(lead.id,'Interested')} style={{background:'#8B5CF622',color:'#8B5CF6',border:'none',borderRadius:'4px',padding:'4px 8px',fontSize:'11px',cursor:'pointer',fontWeight:'600'}}>Hot</button>
                          <button onClick={() => updateStatus(lead.id,'Closed')} style={{background:'#22C55E22',color:'#22C55E',border:'none',borderRadius:'4px',padding:'4px 8px',fontSize:'11px',cursor:'pointer',fontWeight:'600'}}>Won</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* DETAIL PANEL */}
          {selectedLead && (
            <div style={{background:'#1E293B',border:'1px solid #334155',borderRadius:'8px',padding:'20px',height:'fit-content',position:'sticky',top:'24px'}}>
              <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'20px'}}>
                <div style={{fontSize:'15px',fontWeight:'700',color:'#fff'}}>Lead Details</div>
                <button onClick={() => setSelectedLead(null)} style={{background:'none',border:'none',color:'#64748B',fontSize:'18px',cursor:'pointer'}}>✕</button>
              </div>
              <div style={{marginBottom:'20px',padding:'16px',background:'#0F172A',borderRadius:'8px',border:'1px solid #334155'}}>
                <div style={{fontSize:'16px',fontWeight:'700',color:'#fff',marginBottom:'4px'}}>{selectedLead.owner_name || 'Unknown Owner'}</div>
                <div style={{fontSize:'13px',color:'#94A3B8',marginBottom:'2px'}}>{selectedLead.property_address}</div>
                <div style={{fontSize:'12px',color:'#64748B'}}>{selectedLead.city}, FL · {selectedLead.county} County</div>
              </div>
              <div style={{marginBottom:'20px'}}>
                <div style={{fontSize:'11px',fontWeight:'600',color:'#64748B',textTransform:'uppercase',letterSpacing:'1px',marginBottom:'12px'}}>Contact Info</div>
                {[selectedLead.phone1, selectedLead.phone2, selectedLead.phone3].filter(Boolean).map((phone, i) => (
                  <a key={i} href={'tel:'+phone} style={{display:'flex',alignItems:'center',gap:'10px',padding:'10px 12px',background:'#0F172A',borderRadius:'6px',marginBottom:'6px',textDecoration:'none',border:'1px solid #22C55E33'}}>
                    <span style={{fontSize:'16px'}}>📞</span>
                    <span style={{fontSize:'14px',color:'#22C55E',fontWeight:'600'}}>{phone}</span>
                  </a>
                ))}
                {[selectedLead.email1, selectedLead.email2, selectedLead.email3].filter(Boolean).map((email, i) => (
                  <a key={i} href={'mailto:'+email} style={{display:'flex',alignItems:'center',gap:'10px',padding:'10px 12px',background:'#0F172A',borderRadius:'6px',marginBottom:'6px',textDecoration:'none',border:'1px solid #0EA5E933'}}>
                    <span style={{fontSize:'16px'}}>📧</span>
                    <span style={{fontSize:'13px',color:'#0EA5E9'}}>{email}</span>
                  </a>
                ))}
              </div>
              <div style={{marginBottom:'20px'}}>
                <div style={{fontSize:'11px',fontWeight:'600',color:'#64748B',textTransform:'uppercase',letterSpacing:'1px',marginBottom:'12px'}}>Permit Info</div>
                {[
                  {label:'Permit #', value:selectedLead.permit_number},
                  {label:'Type', value:selectedLead.permit_type},
                  {label:'Date Filed', value:selectedLead.permit_date},
                  {label:'Job Value', value:selectedLead.job_value},
                  {label:'Contractor', value:selectedLead.contractor},
                ].filter(item => item.value).map(item => (
                  <div key={item.label} style={{display:'flex',justifyContent:'space-between',padding:'8px 0',borderBottom:'1px solid #1E293B'}}>
                    <span style={{fontSize:'12px',color:'#64748B'}}>{item.label}</span>
                    <span style={{fontSize:'12px',color:'#fff',fontWeight:'500'}}>{item.value}</span>
                  </div>
                ))}
              </div>
              <div style={{marginBottom:'20px'}}>
                <div style={{fontSize:'11px',fontWeight:'600',color:'#64748B',textTransform:'uppercase',letterSpacing:'1px',marginBottom:'8px'}}>Update Status</div>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'6px'}}>
                  {['New','Called','Interested','Closed','Dead'].map(s => (
                    <button key={s} onClick={() => updateStatus(selectedLead.id, s)}
                      style={{padding:'8px',background:selectedLead.status===s?statusColor[s]:'#0F172A',color:selectedLead.status===s?'#fff':statusColor[s],border:'1px solid '+(statusColor[s]||'#0EA5E9')+'44',borderRadius:'6px',fontSize:'12px',fontWeight:'600',cursor:'pointer'}}>
                      {s}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <div style={{fontSize:'11px',fontWeight:'600',color:'#64748B',textTransform:'uppercase',letterSpacing:'1px',marginBottom:'8px'}}>Notes</div>
                <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Add notes about this lead..." rows={4}
                  style={{width:'100%',padding:'10px 12px',background:'#0F172A',border:'1px solid #334155',borderRadius:'6px',fontSize:'13px',color:'#fff',outline:'none',resize:'vertical',marginBottom:'8px'}}/>
                <button onClick={saveNotes} style={{width:'100%',background:'#0EA5E9',color:'#fff',border:'none',borderRadius:'6px',padding:'10px',fontSize:'13px',fontWeight:'600',cursor:'pointer'}}>Save Notes</button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* CSV IMPORT MODAL */}
      {showCSV && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.7)',zIndex:100,display:'flex',alignItems:'center',justifyContent:'center',padding:'20px'}}>
          <div style={{background:'#1E293B',borderRadius:'12px',padding:'32px',maxWidth:'560px',width:'100%',border:'1px solid #334155'}}>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'24px'}}>
              <h2 style={{fontSize:'20px',fontWeight:'700',color:'#fff'}}>📂 Import CSV Leads</h2>
              <button onClick={() => { setShowCSV(false); setImportResult(null); }} style={{background:'none',border:'none',color:'#64748B',fontSize:'20px',cursor:'pointer'}}>✕</button>
            </div>

            <div style={{background:'#0F172A',borderRadius:'8px',padding:'20px',marginBottom:'24px',border:'1px solid #334155'}}>
              <div style={{fontSize:'13px',fontWeight:'600',color:'#0EA5E9',marginBottom:'12px'}}>📋 Accepted CSV Column Names:</div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'6px'}}>
                {[
                  'owner_name / name / owner',
                  'property_address / address',
                  'city',
                  'county',
                  'phone1 / phone / mobile',
                  'phone2 / alt_phone',
                  'email1 / email',
                  'permit_number / permit_no',
                  'permit_date / issue_date / date',
                  'job_value / value',
                  'permit_type / description',
                  'contractor / contractor_name',
                ].map(col => (
                  <div key={col} style={{fontSize:'11px',color:'#64748B',padding:'4px 8px',background:'#1E293B',borderRadius:'4px'}}>{col}</div>
                ))}
              </div>
              <div style={{fontSize:'11px',color:'#475569',marginTop:'12px'}}>Your CSV can have any of these column names. Works with Tracerfy exports, Shovels exports, and custom spreadsheets.</div>
            </div>

            <div
              style={{border:'2px dashed #334155',borderRadius:'8px',padding:'40px',textAlign:'center',cursor:'pointer',marginBottom:'20px'}}
              onClick={() => fileRef.current?.click()}
            >
              <div style={{fontSize:'40px',marginBottom:'12px'}}>📁</div>
              <div style={{fontSize:'15px',fontWeight:'600',color:'#fff',marginBottom:'4px'}}>Click to select your CSV file</div>
              <div style={{fontSize:'13px',color:'#64748B'}}>or drag and drop here</div>
              <input ref={fileRef} type="file" accept=".csv" onChange={handleCSVUpload} style={{display:'none'}}/>
            </div>

            {importing && (
              <div style={{textAlign:'center',padding:'20px'}}>
                <div style={{fontSize:'24px',marginBottom:'8px'}}>⏳</div>
                <div style={{fontSize:'14px',color:'#0EA5E9',fontWeight:'600'}}>Importing leads...</div>
              </div>
            )}

            {importResult && !importResult.error && (
              <div style={{background:'#22C55E22',border:'1px solid #22C55E44',borderRadius:'8px',padding:'20px',textAlign:'center'}}>
                <div style={{fontSize:'32px',marginBottom:'8px'}}>✅</div>
                <div style={{fontSize:'18px',fontWeight:'700',color:'#22C55E',marginBottom:'4px'}}>{importResult.saved} Leads Imported!</div>
                <div style={{fontSize:'13px',color:'#64748B'}}>{importResult.failed > 0 ? importResult.failed+' failed · ' : ''}{importResult.total} total rows in file</div>
                <button onClick={() => { setShowCSV(false); setImportResult(null); }}
                  style={{marginTop:'16px',background:'#22C55E',color:'#fff',border:'none',borderRadius:'6px',padding:'10px 24px',fontSize:'14px',fontWeight:'600',cursor:'pointer'}}>
                  View Leads →
                </button>
              </div>
            )}

            {importResult?.error && (
              <div style={{background:'#EF444422',border:'1px solid #EF444444',borderRadius:'8px',padding:'16px',textAlign:'center'}}>
                <div style={{fontSize:'14px',color:'#EF4444'}}>{importResult.error}</div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ADD LEAD MODAL */}
      {showAddForm && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.7)',zIndex:100,display:'flex',alignItems:'center',justifyContent:'center',padding:'20px'}}>
          <div style={{background:'#1E293B',borderRadius:'12px',padding:'32px',maxWidth:'560px',width:'100%',maxHeight:'90vh',overflowY:'auto',border:'1px solid #334155'}}>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'24px'}}>
              <h2 style={{fontSize:'20px',fontWeight:'700',color:'#fff'}}>Add New Lead</h2>
              <button onClick={() => setShowAddForm(false)} style={{background:'none',border:'none',color:'#64748B',fontSize:'20px',cursor:'pointer'}}>✕</button>
            </div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'16px'}}>
              {fields.map(field => (
                <div key={field.key}>
                  <label style={{display:'block',fontSize:'12px',fontWeight:'500',color:'#94A3B8',marginBottom:'6px'}}>{field.label}</label>
                  <input placeholder={field.placeholder} value={newLead[field.key]}
                    onChange={e => setNewLead({...newLead,[field.key]:e.target.value})}
                    style={{width:'100%',padding:'10px 12px',background:'#0F172A',border:'1px solid #334155',borderRadius:'6px',fontSize:'13px',color:'#fff',outline:'none',boxSizing:'border-box'}}/>
                </div>
              ))}
              <div>
                <label style={{display:'block',fontSize:'12px',fontWeight:'500',color:'#94A3B8',marginBottom:'6px'}}>County</label>
                <select value={newLead.county} onChange={e => setNewLead({...newLead,county:e.target.value})}
                  style={{width:'100%',padding:'10px 12px',background:'#0F172A',border:'1px solid #334155',borderRadius:'6px',fontSize:'13px',color:'#fff',outline:'none'}}>
                  {COUNTIES.filter(c => c !== 'All Counties').map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label style={{display:'block',fontSize:'12px',fontWeight:'500',color:'#94A3B8',marginBottom:'6px'}}>Permit Type</label>
                <select value={newLead.permit_type} onChange={e => setNewLead({...newLead,permit_type:e.target.value})}
                  style={{width:'100%',padding:'10px 12px',background:'#0F172A',border:'1px solid #334155',borderRadius:'6px',fontSize:'13px',color:'#fff',outline:'none'}}>
                  <option>Impact Window/Door</option>
                  <option>Impact Window</option>
                  <option>Impact Door</option>
                  <option>Window Replacement</option>
                  <option>Door Replacement</option>
                </select>
              </div>
            </div>
            <div style={{display:'flex',gap:'12px',marginTop:'24px'}}>
              <button onClick={saveNewLead} disabled={saving}
                style={{flex:1,background:'#22C55E',color:'#fff',border:'none',borderRadius:'8px',padding:'14px',fontSize:'15px',fontWeight:'600',cursor:'pointer'}}>
                {saving ? 'Saving...' : 'Save Lead ✓'}
              </button>
              <button onClick={() => setShowAddForm(false)}
                style={{background:'#334155',color:'#94A3B8',border:'none',borderRadius:'8px',padding:'14px 24px',fontSize:'15px',cursor:'pointer'}}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
