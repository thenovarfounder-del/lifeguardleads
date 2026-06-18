'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const COUNTIES = ['All Counties','Miami-Dade','Broward','Palm Beach','Orange','Osceola','Seminole','Lake','Polk','Hillsborough','Collier','St. Lucie','Martin','Indian River'];
const STATUSES = ['All','New','Called','Interested','Closed','Dead'];

export default function Dashboard() {
  const router = useRouter();
  const [leads, setLeads] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [county, setCounty] = useState('All Counties');
  const [status, setStatus] = useState('All');
  const [search, setSearch] = useState('');
  const [stats, setStats] = useState({ total:0, new:0, called:0, interested:0, closed:0 });
  const [selectedLead, setSelectedLead] = useState<any>(null);
  const [notes, setNotes] = useState('');

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

  const updateStatus = async (id: number, newStatus: string) => {
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

  const statusColor: any = {
    'New': '#0EA5E9',
    'Called': '#F59E0B',
    'Interested': '#8B5CF6',
    'Closed': '#22C55E',
    'Dead': '#EF4444',
  };

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
          <input
            placeholder="Search name, address, phone..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{flex:1,minWidth:'200px',padding:'10px 14px',background:'#0F172A',border:'1px solid #334155',borderRadius:'6px',fontSize:'13px',color:'#fff',outline:'none'}}
          />
          <select value={county} onChange={e => setCounty(e.target.value)}
            style={{padding:'10px 14px',background:'#0F172A',border:'1px solid #334155',borderRadius:'6px',fontSize:'13px',color:'#fff',outline:'none'}}>
            {COUNTIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <select value={status} onChange={e => setStatus(e.target.value)}
            style={{padding:'10px 14px',background:'#0F172A',border:'1px solid #334155',borderRadius:'6px',fontSize:'13px',color:'#fff',outline:'none'}}>
            {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <button onClick={fetchLeads} className="btn">Refresh</button>
        </div>

        <div style={{display:'grid',gridTemplateColumns:selectedLead ? '1fr 380px' : '1fr',gap:'16px'}}>
          {/* LEADS TABLE */}
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
                    <tr><td colSpan={8} style={{padding:'40px',textAlign:'center',color:'#64748B'}}>No leads yet. Run the scraper to get started.</td></tr>
                  ) : filtered.map((lead, i) => (
                    <tr key={lead.id} onClick={() => { setSelectedLead(lead); setNotes(lead.notes || ''); }}
                      style={{borderBottom:'1px solid #1E293B',cursor:'pointer',background:selectedLead?.id===lead.id?'#1E3A5F':i%2===0?'#1E293B':'#162032',transition:'background 0.1s'}}>
                      <td style={{padding:'12px 16px',fontSize:'13px',color:'#fff',fontWeight:'500',whiteSpace:'nowrap'}}>{lead.owner_name || '—'}</td>
                      <td style={{padding:'12px 16px',fontSize:'12px',color:'#94A3B8',maxWidth:'200px',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{lead.property_address || '—'}</td>
                      <td style={{padding:'12px 16px',fontSize:'12px',color:'#64748B',whiteSpace:'nowrap'}}>{lead.county || '—'}</td>
                      <td style={{padding:'12px 16px',fontSize:'13px',color:'#22C55E',fontWeight:'600',whiteSpace:'nowrap'}}>{lead.phone1 || '—'}</td>
                      <td style={{padding:'12px 16px',fontSize:'12px',color:'#64748B',whiteSpace:'nowrap'}}>{lead.permit_date || '—'}</td>
                      <td style={{padding:'12px 16px',fontSize:'12px',color:'#F59E0B',fontWeight:'600',whiteSpace:'nowrap'}}>{lead.job_value || '—'}</td>
                      <td style={{padding:'12px 16px'}}>
                        <span style={{background:statusColor[lead.status]+'22',color:statusColor[lead.status],fontSize:'11px',fontWeight:'600',padding:'3px 10px',borderRadius:'12px'}}>{lead.status}</span>
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

          {/* LEAD DETAIL PANEL */}
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
                ].map(item => item.value && (
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
                      style={{padding:'8px',background:selectedLead.status===s?statusColor[s]:'#0F172A',color:selectedLead.status===s?'#fff':statusColor[s],border:'1px solid '+statusColor[s]+'44',borderRadius:'6px',fontSize:'12px',fontWeight:'600',cursor:'pointer'}}>
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div style={{fontSize:'11px',fontWeight:'600',color:'#64748B',textTransform:'uppercase',letterSpacing:'1px',marginBottom:'8px'}}>Notes</div>
                <textarea
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder="Add notes about this lead..."
                  rows={4}
                  style={{width:'100%',padding:'10px 12px',background:'#0F172A',border:'1px solid #334155',borderRadius:'6px',fontSize:'13px',color:'#fff',outline:'none',resize:'vertical',marginBottom:'8px'}}
                />
                <button onClick={saveNotes} className="btn" style={{width:'100%'}}>Save Notes</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
