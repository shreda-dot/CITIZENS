import { useState } from 'react'
import react from 'react'
import { Routes, Route } from "react-router-dom";
// --- API Configuration ---
// In a real application, this would be set via environment variables.
// Since the Express backend is running on port 3000, we set the base URL here.
const BASE_URL = "https://citizens-2-syq6.onrender.com";

// --- End API Configuration ---

function Home() {
    const [count, setCount] = useState(0)

    return (
        <>

            {(() => {
                const IncidentApp = () => {
                    // React hooks: useState imported, other hooks via react.*
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
                    const [files, setFiles] = useState([]); // File objects for upload
                    const [previews, setPreviews] = useState([]); // preview URLs
                    const [toast, setToast] = useState(null);
                    const eventSourceRef = react.useRef(null);

                    // small, reusable spinner for buttons and loaders
                    const Spinner = ({ className = 'w-4 h-4' }) => (
                        <svg className={`${className} animate-spin`} viewBox="0 0 24 24" fill="none" aria-hidden>
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path>
                        </svg>
                    );

                    // Request notification permission once
                    react.useEffect(() => {
                        if ('Notification' in window && Notification.permission === 'default') {
                            Notification.requestPermission().catch(() => {});
                        }
                    }, []);

                    // Create previews for selected files
                    react.useEffect(() => {
                        const urls = files.map(f => URL.createObjectURL(f));
                        setPreviews(urls);
                        return () => {
                            urls.forEach(u => URL.revokeObjectURL(u));
                        };
                    }, [files]);

                    // Load incidents once and set up SSE
                    react.useEffect(() => {
                        loadIncidents();
                        // subscribe to server-sent-events for real-time updates
                        try {
                            // Connect to the BASE_URL stream endpoint
                           const es = new EventSource(`${BASE_URL}/api/incidents/stream`);
                            eventSourceRef.current = es;
                            es.onmessage = (ev) => {
                                try {
                                    const data = JSON.parse(ev.data);
                                    setIncidents(prev => [data, ...prev]);
                                    setToast('New incident added: ' + (data.title || data.type));
                                    // browser notification if allowed and not by current user
                                    if (window.Notification && Notification.permission === 'granted' && (!user || data.userId !== user.id)) {
                                        new Notification('New incident', { body: (data.title || data.type) + ' — ' + (data.location || '') });
                                    }
                                    setCount(c => c + 1);
                                } catch (err) {
                                    console.error("SSE parse error:", err);
                                }
                            };
                            es.onerror = () => {
                                setMessage('Realtime connection lost. Updates may be delayed.');
                            };
                            return () => {
                                es.close();
                            };
                        } catch (err) {
                            console.error("SSE connection error:", err);
                        }
                        // eslint-disable-next-line react-hooks/exhaustive-deps
                    }, [user]); // Re-run effect if user changes (for notification check)

                    const loadIncidents = async () => {
                        setLoading(true);
                        setMessage('');
                        try {
                            // Use BASE_URL
                            const res = await fetch(`${BASE_URL}/api/incidents`);
                            if (!res.ok) throw new Error(await res.text() || res.statusText);
                            const data = await res.json();
                            setIncidents(Array.isArray(data) ? data : []);
                        } catch (err) {
                            // setMessage('Load failed: ' + err.message);
                        } finally {
                            setLoading(false);
                        }
                    };

                    const handleChange = (e) => {
                        const { name, value } = e.target;
                        setForm(prev => ({ ...prev, [name]: value }));
                    };

                    const captureGeolocation = () => {
                        if (!navigator.geolocation) {
                            setMessage('Geolocation not supported by your browser.');
                            return;
                        }
                        navigator.geolocation.getCurrentPosition(
                            (pos) => {
                                setForm(prev => ({
                                    ...prev,
                                    latitude: String(pos.coords.latitude),
                                    longitude: String(pos.coords.longitude)
                                }));
                                setMessage('Location captured.');
                            },
                            (err) => setMessage('Geolocation error: ' + err.message),
                            { enableHighAccuracy: true, timeout: 10000 }
                        );
                    };

                    const handleFileChange = (e) => {
                        const list = Array.from(e.target.files || []);
                        setFiles(list.slice(0, 5)); // limit to 5 files
                    };

                    const handleSubmit = async (e) => {
                        e.preventDefault();
                        if (!form.title && !form.description) {
                            setMessage('Please provide a title or description.');
                            return;
                        }
                        setLoading(true);
                        setMessage('');
                        try {
                            let res;
                            // If there are files, use FormData
                            if (files.length > 0) {
                                const fd = new FormData();
                                fd.append('type', form.type);
                                fd.append('title', form.title);
                                fd.append('description', form.description);
                                fd.append('location', form.location);
                                if (form.latitude) fd.append('latitude', form.latitude);
                                if (form.longitude) fd.append('longitude', form.longitude);
                                if (user?.id) fd.append('userId', user.id);
                                files.forEach((f, i) => fd.append('images', f, f.name));
                                res = await fetch(`${BASE_URL}/api/incidents`, { // Use BASE_URL
                                    method: 'POST',
                                    body: fd
                                });
                            } else {
                                const payload = { ...form };
                                if (user?.id) payload.userId = user.id;
                                res = await fetch(`${BASE_URL}/api/incidents`, { // Use BASE_URL
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify(payload)
                                });
                            }

                            if (!res.ok) throw new Error(await res.text() || res.statusText);
                            const saved = await res.json();
                            // Note: We don't need to manually update incidents here because the SSE stream
                            // on the server will send the new incident back to us, updating the state via es.onmessage.
                            // We'll keep the update here as a fallback in case SSE fails or is slow.
                            setIncidents(prev => [saved, ...prev]);
                            
                            setForm({ type: 'Accident', title: '', description: '', location: '', latitude: '', longitude: '' });
                            setFiles([]);
                            setMessage('Incident submitted.');
                            setToast('Submitted: ' + (saved.title || saved.type));
                            setCount(c => c + 1);
                        } catch (err) {
                            setMessage('Submit failed: ' + err.message);
                        } finally {
                            setLoading(false);
                        }
                    };

                    const handleLogin = async (e) => {
                        e.preventDefault();
                        const uname = e.target.username?.value;
                        const pw = e.target.password?.value;
                        if (!uname || !pw) return setMessage('Provide username & password.');
                        setLoading(true);
                        setMessage('');
                        try {
                            const res = await fetch(`${BASE_URL}/api/login`, { // Use BASE_URL
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ username: uname, password: pw })
                            });
                            if (!res.ok) throw new Error(await res.text() || res.statusText);
                            const data = await res.json();
                            setUser(data);
                            localStorage.setItem('user', JSON.stringify(data));
                            setMessage('Logged in.');
                        } catch (err) {
                            setMessage('Login failed: ' + err.message);
                        } finally {
                            setLoading(false);
                        }
                    };

                    const handleLogout = async () => {
                        try {
                            await fetch(`${BASE_URL}/api/logout`, { method: 'POST' }); // Use BASE_URL
                        } catch {}
                        setUser(null);
                        localStorage.removeItem('user');
                        // If the user logs out, reset the 'show mine' filter
                        setShowMine(false); 
                    };

                    // Filtered view
                    const filtered = incidents.filter(inc => {
                        if (filterCategory !== 'All' && inc.type !== filterCategory) return false;
                        // Filter by user ID if 'Show Mine' is checked
                        if (showMine && user) return inc.userId === user.id;
                        if (showMine && !user) return false;
                        return true;
                    });

                    const formatDate = (d) => {
                        try {
                            if (!d) return '';
                            const dt = new Date(d);
                            if (isNaN(dt)) return String(d);
                            return dt.toLocaleString();
                        } catch {
                            return String(d);
                        }
                    };

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
                                                <div className="text-right">
                                                    <div>Signed in as <strong className="font-medium">{user.username}</strong></div>
                                                </div>
                                                <div className="flex gap-2">
                                                    <button onClick={handleLogout} className="px-3 py-1 rounded-md bg-white border border-gray-200 text-slate-700 hover:bg-gray-50">
                                                        Logout
                                                    </button>
                                                    <button onClick={() => { setShowMine(s => !s) }} aria-pressed={showMine} className={`px-3 py-1 rounded-md ${showMine ? 'bg-indigo-600 text-white' : 'bg-white border'}`}>
                                                        {showMine ? 'Showing: Mine' : 'Show Mine'}
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="text-sm text-slate-700 font-bold">Welcome back, citizen</div>
                                    )}
                                </div>
                            </header>

                            <form onSubmit={handleSubmit} className="mb-6 bg-white border border-gray-100 rounded-lg p-4 sm:p-5 shadow-sm" role="form" aria-label="Report incident form">
                                <div className="grid gap-4 grid-cols-1 sm:grid-cols-2">
                                    <label className="block">
                                        <span className="text-sm text-slate-700">Type</span>
                                        <select
                                            name="type"
                                            value={form.type}
                                            onChange={handleChange}
                                            className="mt-1 block w-full rounded-md border border-gray-300 bg-white py-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200"
                                            aria-label="incident type"
                                        >
                                            <option>Accident</option>
                                            <option>Fighting</option>
                                            <option>Rioting</option>
                                            <option>Fire</option>
                                            <option>Other</option>
                                        </select>
                                    </label>

                                    <label className="block">
                                        <span className="text-sm text-slate-700">Title</span>
                                        <input
                                            name="title"
                                            value={form.title}
                                            onChange={handleChange}
                                            placeholder="Short descriptive title"
                                            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200"
                                            aria-label="title"
                                        />
                                    </label>

                                    <label className="block sm:col-span-2">
                                        <span className="text-sm text-slate-700">Location</span>
                                        <div className="mt-1 flex flex-col sm:flex-row gap-2">
                                            <input
                                                name="location"
                                                value={form.location}
                                                onChange={handleChange}
                                                placeholder="Street, intersection or landmark"
                                                className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200"
                                                aria-label="location"
                                            />
                                            <div className="flex gap-2">
                                                <button type="button" onClick={captureGeolocation} className="px-3 py-2 rounded-md bg-white border border-gray-200 text-slate-700 hover:bg-gray-50">
                                                    Use My Location
                                                </button>
                                                <button type="button" onClick={() => setForm(prev => ({ ...prev, latitude: '', longitude: '' }))} className="px-3 py-2 rounded-md bg-white border border-gray-200 text-slate-700 hover:bg-gray-50">
                                                    Clear Coordinates
                                                </button>
                                            </div>
                                        </div>
                                        {(form.latitude || form.longitude) && (
                                            <div className="text-xs text-slate-500 mt-1">Lat: {form.latitude} • Lon: {form.longitude}</div>
                                        )}
                                    </label>

                                    <label className="block sm:col-span-2">
                                        <span className="text-sm text-slate-700">Description</span>
                                        <textarea
                                            name="description"
                                            value={form.description}
                                            onChange={handleChange}
                                            rows={5}
                                            placeholder="What happened? Add any useful details."
                                            className="mt-2 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm resize-y focus:outline-none focus:ring-2 focus:ring-indigo-200"
                                            aria-label="description"
                                        />
                                    </label>

                                    <label className="block sm:col-span-2">
                                        <span className="text-sm text-slate-700">Pictures (optional, up to 5)</span>
                                        <input type="file" accept="image/*" multiple onChange={handleFileChange} className="mt-1 block w-full" aria-label="images" />
                                        <div className="mt-2 grid grid-cols-3 sm:grid-cols-5 gap-2">
                                            {previews.map((p, i) => (
                                                <div key={i} className="w-full h-20 overflow-hidden rounded border bg-gray-50 flex items-center justify-center">
                                                    <img 
                                                        loading="lazy" 
                                                        // When fetching images, ensure BASE_URL is prepended if the image source is a relative path 
                                                        // (which it will be for uploads: /uploads/filename.jpg)
                                                        src={p} 
                                                        alt={`preview ${i + 1}`} 
                                                        className="object-cover w-full h-full" 
                                                    />
                                                </div>
                                            ))}
                                            {previews.length === 0 && <div className="text-xs text-slate-400 col-span-3 sm:col-span-5">No images selected.</div>}
                                        </div>
                                        <div className="text-xs text-slate-500 mt-1">Selected: {files.length}/5</div>
                                    </label>
                                </div>

                                <div className="mt-4 flex flex-col sm:flex-row items-center gap-3">
                                    <button
                                        type="submit"
                                        disabled={loading}
                                        className={`inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-medium text-white shadow ${
                                            loading ? 'bg-indigo-300 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700'
                                        } focus:outline-none focus:ring-2 focus:ring-indigo-300`}
                                        aria-disabled={loading}
                                    >
                                        {loading ? <Spinner className="w-4 h-4 text-white" /> : null}
                                        <span className="ml-2">{loading ? 'Submitting...' : 'Submit Incident'}</span>
                                    </button>

                                    <button
                                        type="button"
                                        onClick={loadIncidents}
                                        disabled={loading}
                                        className={`inline-flex items-center justify-center rounded-md px-3 py-2 text-sm font-medium ${
                                            loading ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-white border border-gray-200 text-slate-700 hover:bg-gray-50'
                                        }`}
                                    >
                                        {loading ? <Spinner className="w-4 h-4 text-slate-500" /> : null}
                                        <span className="ml-2">{loading ? 'Loading…' : 'Load Incidents'}</span>
                                    </button>

                                    <span className="ml-auto text-sm text-slate-500">{incidents.length} loaded</span>
                                </div>
                            </form>

                            <div role="status" aria-live="polite" className="min-h-[1.25rem]">
                                {message && <div className="mb-4 text-sm text-rose-600">{message}</div>}
                                {toast && <div className="mb-4 text-sm text-indigo-600">{toast}</div>}
                            </div>

                            <section className="mb-6">
                                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-3 gap-3">
                                    <h2 className="text-lg font-medium text-slate-800">Submitted Incidents ({filtered.length})</h2>
                                    <div className="flex items-center gap-2 w-full sm:w-auto">
                                        <select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)} className="rounded-md border px-2 py-1 text-sm" aria-label="filter category">
                                            <option>All</option>
                                            <option>Accident</option>
                                            <option>Fighting</option>
                                            <option>Rioting</option>
                                            <option>Fire</option>
                                            <option>Other</option>
                                        </select>
                                        <button onClick={() => { setFilterCategory('All'); setShowMine(false); }} className="px-2 py-1 rounded-md bg-white border text-sm">Reset</button>
                                    </div>
                                </div>

                                {loading && <div className="text-sm text-slate-500 mb-3 flex items-center gap-2"><Spinner className="w-4 h-4 text-slate-500" /> Loading...</div>}
                                {!loading && filtered.length === 0 && (
                                    <div className="text-sm text-slate-500 flex items-center gap-3">
                                        <div>No incidents. Try loading or change filters.</div>
                                        <button onClick={loadIncidents} className="px-2 py-1 rounded bg-white border">Refresh</button>
                                    </div>
                                )}

                                <ul className="grid gap-3 mt-3 grid-cols-1 sm:grid-cols-2">
                                    {filtered.map((inc, i) => (
                                        <li
                                            key={inc.id ?? i}
                                            className="bg-white border border-gray-100 rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow flex flex-col"
                                        >
                                            <div className="flex items-start justify-between gap-4">
                                                <div className="flex-1">
                                                    <div className="text-slate-900 font-semibold">{inc.title || inc.type}</div>
                                                    <div className="text-xs text-slate-500 mt-1">{inc.type} • {inc.location || 'Unknown location'}</div>
                                                    {(inc.latitude || inc.longitude) && <div className="text-xs text-slate-400 mt-1">Lat: {inc.latitude} • Lon: {inc.longitude}</div>}
                                                    {inc.description && <p className="mt-3 text-sm text-slate-700 line-clamp-4">{inc.description}</p>}
                                                    {Array.isArray(inc.images) && inc.images.length > 0 && (
                                                        <div className="mt-3 grid grid-cols-2 gap-2">
                                                            {inc.images.map((src, idx) => (
                                                                <img 
                                                                    key={idx} 
                                                                    loading="lazy" 
                                                                    // Prepend BASE_URL to image sources fetched from the backend
                                                                    src={`${BASE_URL}${src}`} 
                                                                    alt={`incident ${idx + 1}`} 
                                                                    className="w-full h-28 object-cover rounded border" 
                                                                />
                                                            ))}
                                                        </div>
                                                    )}
                                                    {inc.userId && <div className="text-xs text-slate-400 mt-2">Submitted by: {inc.userName || inc.userId}</div>}
                                                </div>
                                                <div className="text-xs text-slate-400 whitespace-nowrap ml-3">{formatDate(inc.timestamp || inc.createdAt)}</div>
                                            </div>
                                        </li>
                                    ))}
                                </ul>
                            </section>
                        </div>
                    );
                };

                return <IncidentApp />;
            })()}
        </>
    )
}

export default Home
