
import { useState, useEffect, useRef } from 'react';
import react from 'react';

const BASE_URL = "https://citizens-2-syq6.onrender.com";

function Home() {
  const [incidents, setIncidents] = useState([]);
  const [form, setForm] = useState({
    type: 'Accident',
    title: '',
    description: '',
    location: '',
    latitude: '',
    longitude: ''
  });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem('user')) || null } catch { return null }
  });
  const [filterCategory, setFilterCategory] = useState('All');
  const [showMine, setShowMine] = useState(false);
  const [files, setFiles] = useState([]);
  const [previews, setPreviews] = useState([]);
  const [toast, setToast] = useState(null);
  const eventSourceRef = useRef(null);

  // Spinner component
  const Spinner = ({ className = 'w-4 h-4' }) => (
    <svg className={`${className} animate-spin`} viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path>
    </svg>
  );

  // File previews
  useEffect(() => {
    const urls = files.map(f => URL.createObjectURL(f));
    setPreviews(urls);
    return () => urls.forEach(u => URL.revokeObjectURL(u));
  }, [files]);

  // SSE for real-time incidents
  useEffect(() => {
    loadIncidents();
    try {
      const es = new EventSource(`${BASE_URL}/api/incidents/stream`);
      eventSourceRef.current = es;
      es.onmessage = (ev) => {
        try {
          const data = JSON.parse(ev.data);
          setIncidents(prev => [data, ...prev]);
          setToast('New incident added: ' + (data.title || data.type));
        } catch (err) {
          console.error("SSE parse error:", err);
        }
      };
      es.onerror = () => setMessage('Realtime connection lost. Updates may be delayed.');
      return () => es.close();
    } catch (err) {
      console.error("SSE connection error:", err);
    }
  }, [user]);

  const loadIncidents = async () => {
    setLoading(true);
    setMessage('');
    try {
      const res = await fetch(`${BASE_URL}/api/incidents`);
      if (!res.ok) throw new Error(await res.text() || res.statusText);
      const data = await res.json();
      setIncidents(Array.isArray(data) ? data : []);
    } catch (err) {
      setMessage('Load failed: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
  };

  const captureGeolocation = () => {
    if (!navigator.geolocation) return setMessage('Geolocation not supported.');
    navigator.geolocation.getCurrentPosition(
      pos => setForm(prev => ({ ...prev, latitude: String(pos.coords.latitude), longitude: String(pos.coords.longitude) })),
      err => setMessage('Geolocation error: ' + err.message),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const handleFileChange = (e) => {
    const list = Array.from(e.target.files || []);
    setFiles(list.slice(0, 5));
  };

  // ✅ Corrected handleSubmit: sends token in Authorization header
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.title && !form.description) {
      setMessage('Please provide a title or description.');
      return;
    }
    setLoading(true);
    setMessage('');

    try {
      const token = user?.token;
      let headers = {};
      let body;

      if (files.length > 0) {
        const fd = new FormData();
        fd.append('type', form.type);
        fd.append('title', form.title);
        fd.append('description', form.description);
        fd.append('location', form.location);
        if (form.latitude) fd.append('latitude', form.latitude);
        if (form.longitude) fd.append('longitude', form.longitude);
        files.forEach((f) => fd.append('images', f, f.name));
        body = fd;
      } else {
        body = JSON.stringify(form);
        headers['Content-Type'] = 'application/json';
      }

      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch(`${BASE_URL}/api/incidents`, {
        method: 'POST',
        headers,
        body
      });

      if (!res.ok) throw new Error(await res.text() || res.statusText);
      const saved = await res.json();

      // Update incidents state (SSE may also do this)
      setIncidents(prev => [saved, ...prev]);
      setForm({ type: 'Accident', title: '', description: '', location: '', latitude: '', longitude: '' });
      setFiles([]);
      setMessage('Incident submitted.');
      setToast('Submitted: ' + (saved.title || saved.type));
    } catch (err) {
      setMessage('Submit failed: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Login
  const handleLogin = async (e) => {
    e.preventDefault();
    const uname = e.target.username?.value;
    const pw = e.target.password?.value;
    if (!uname || !pw) return setMessage('Provide username & password.');
    setLoading(true);
    setMessage('');
    try {
      const res = await fetch(`${BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: uname, password: pw })
      });
      if (!res.ok) throw new Error(await res.text() || res.statusText);
      const data = await res.json();
      setUser({ email: uname, token: data.token });
      localStorage.setItem('user', JSON.stringify({ email: uname, token: data.token }));
      setMessage('Logged in.');
    } catch (err) {
      setMessage('Login failed: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    setUser(null);
    localStorage.removeItem('user');
    setShowMine(false);
  };

  // Filtered incidents
  const filtered = incidents.filter(inc => {
    if (filterCategory !== 'All' && inc.type !== filterCategory) return false;
    if (showMine && user) return inc.userId === user.id;
    if (showMine && !user) return false;
    return true;
  });

  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-6 bg-gradient-to-br from-slate-50 to-white rounded-xl shadow-md mt-6">
      <header className="mb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="w-full sm:w-auto">
          <h1 className="text-2xl sm:text-3xl font-semibold text-slate-800">Citizens Reporting</h1>
          <p className="text-sm text-slate-500 mt-1">Report incidents quickly. Add photos, location and category.</p>
        </div>
        <div className="w-full sm:w-auto text-right">
          {user ? (
            <div className="text-sm text-slate-700">
              <div className="flex items-center justify-end gap-3">
                <div>Signed in as <strong>{user.email}</strong></div>
                <button onClick={handleLogout} className="px-3 py-1 rounded-md bg-white border border-gray-200 text-slate-700 hover:bg-gray-50">
                  Logout
                </button>
              </div>
            </div>
          ) : (
            <div className="text-sm text-slate-700 font-bold">Welcome back, citizen</div>
          )}
        </div>
      </header>

      <form onSubmit={handleSubmit} className="mb-6 bg-white border border-gray-100 rounded-lg p-4 sm:p-5 shadow-sm">
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2">
          <label>
            Type
            <select name="type" value={form.type} onChange={handleChange}>
              <option>Accident</option>
              <option>Fighting</option>
              <option>Rioting</option>
              <option>Fire</option>
              <option>Other</option>
            </select>
          </label>

          <label>
            Title
            <input name="title" value={form.title} onChange={handleChange} placeholder="Short descriptive title" />
          </label>

          <label>
            Location
            <input name="location" value={form.location} onChange={handleChange} placeholder="Street, intersection or landmark" />
            <button type="button" onClick={captureGeolocation}>Use My Location</button>
          </label>

          <label>
            Description
            <textarea name="description" value={form.description} onChange={handleChange} rows={4} placeholder="Details"></textarea>
          </label>

          <label>
            Pictures (optional, up to 5)
            <input type="file" accept="image/*" multiple onChange={handleFileChange} />
            <div className="grid grid-cols-3 gap-2 mt-2">
              {previews.map((p, i) => <img key={i} src={p} className="w-full h-20 object-cover rounded border" alt={`preview ${i}`} />)}
            </div>
          </label>
        </div>

        <button type="submit" disabled={loading}>{loading ? 'Submitting...' : 'Submit Incident'}</button>
      </form>

      <div>{message}</div>
      <ul>
        {filtered.map(inc => (
          <li key={inc.id}>
            {inc.title || inc.type} - {inc.location || 'Unknown'}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default Home;
