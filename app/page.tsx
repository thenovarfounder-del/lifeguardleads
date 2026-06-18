'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleLogin = async () => {
    setLoading(true);
    setError('');
    if (password === 'LifeGuard2026!') {
      localStorage.setItem('lg_auth', 'true');
      router.push('/dashboard');
    } else {
      setError('Incorrect password. Try again.');
    }
    setLoading(false);
  };

  return (
    <div style={{minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',background:'linear-gradient(135deg, #0F172A 0%, #1E3A5F 100%)'}}>
      <div style={{background:'#1E293B',borderRadius:'16px',padding:'48px',maxWidth:'420px',width:'100%',boxShadow:'0 25px 50px rgba(0,0,0,0.5)',border:'1px solid #334155'}}>
        <div style={{textAlign:'center',marginBottom:'40px'}}>
          <div style={{fontSize:'48px',marginBottom:'16px'}}>🛡️</div>
          <h1 style={{fontSize:'28px',fontWeight:'700',color:'#fff',marginBottom:'8px'}}>LifeGuard Leads</h1>
          <p style={{fontSize:'14px',color:'#64748B'}}>Florida Impact Window Lead Machine</p>
        </div>
        <div style={{marginBottom:'16px'}}>
          <label style={{display:'block',fontSize:'13px',fontWeight:'500',color:'#94A3B8',marginBottom:'8px'}}>Password</label>
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleLogin()}
            placeholder="Enter password..."
            style={{width:'100%',padding:'12px 16px',background:'#0F172A',border:'1px solid #334155',borderRadius:'8px',fontSize:'14px',color:'#fff',outline:'none'}}
          />
        </div>
        {error && <div style={{color:'#EF4444',fontSize:'13px',marginBottom:'16px'}}>{error}</div>}
        <button onClick={handleLogin} disabled={loading} style={{width:'100%',padding:'14px',background:'#0EA5E9',color:'#fff',border:'none',borderRadius:'8px',fontSize:'15px',fontWeight:'600',cursor:'pointer'}}>
          {loading ? 'Logging in...' : 'Access Dashboard →'}
        </button>
        <div style={{marginTop:'24px',padding:'16px',background:'#0F172A',borderRadius:'8px',border:'1px solid #1E3A5F'}}>
          <div style={{fontSize:'12px',color:'#475569',textAlign:'center'}}>🔒 Private & Secure · LifeGuard Leads 2026</div>
        </div>
      </div>
    </div>
  );
}
