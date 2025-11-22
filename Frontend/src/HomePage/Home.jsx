import React, { useState, useEffect, useRef } from "react";

const BASE_URL = "https://citizens-2-syq6.onrender.com";;

function Home() {
  const [user, setUser] = useState(null);
  const [incidents, setIncidents] = useState([]);
  const [form, setForm] = useState({
    type: "Accident",
    title: "",
    description: "",
    location: "",
    latitude: "",
    longitude: "",
  });
  const [files, setFiles] = useState([]);
  const [previews, setPreviews] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [toast, setToast] = useState(null);
  const [filterCategory, setFilterCategory] = useState("All");
  const [showMine, setShowMine] = useState(false);
  const eventSourceRef = useRef(null);

  // --- Fetch user on mount ---
  useEffect(() => {
    const fetchUser = async () => {
      try {
        const res = await fetch(`${BASE_URL}/auth/me`, {
          credentials: "include",
        });
        if (!res.ok) throw new Error("Not logged in");
        const data = await res.json();
        setUser(data);
      } catch {
        setUser(null);
      }
    };
    fetchUser();
  }, []);

  // --- Generate file previews ---
  useEffect(() => {
    const urls = files.map((f) => URL.createObjectURL(f));
    setPreviews(urls);
    return () => urls.forEach((u) => URL.revokeObjectURL(u));
  }, [files]);

  // --- Load incidents & setup SSE ---
  useEffect(() => {
    loadIncidents();

    try {
      const es = new EventSource(`${BASE_URL}/api/incidents/stream`);
      eventSourceRef.current = es;

      es.onmessage = (ev) => {
        try {
          const data = JSON.parse(ev.data);
          setIncidents((prev) => [data, ...prev]);
          setToast("New incident: " + (data.title || data.type));

          if (
            window.Notification &&
            Notification.permission === "granted" &&
            (!user || data.userId !== user.id)
          ) {
            new Notification("New incident", {
              body: (data.title || data.type) + " — " + (data.location || ""),
            });
          }
        } catch (err) {
          console.error("SSE parse error:", err);
        }
      };

      es.onerror = () => setMessage("Realtime connection lost. Updates may be delayed.");

      return () => es.close();
    } catch (err) {
      console.error("SSE connection error:", err);
    }
  }, [user]);

  // --- Load incidents from backend ---
  const loadIncidents = async () => {
    setLoading(true);
    setMessage("");
    try {
      const res = await fetch(`${BASE_URL}/api/incidents`);
      if (!res.ok) throw new Error(await res.text() || res.statusText);
      const data = await res.json();
      setIncidents(Array.isArray(data) ? data : []);
    } catch (err) {
      setMessage("Failed to load incidents: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  // --- Form change ---
  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const captureGeolocation = () => {
    if (!navigator.geolocation) {
      setMessage("Geolocation not supported");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        setForm((prev) => ({
          ...prev,
          latitude: String(pos.coords.latitude),
          longitude: String(pos.coords.longitude),
        })),
      (err) => setMessage("Geolocation error: " + err.message),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const handleFileChange = (e) => {
    const list = Array.from(e.target.files || []);
    setFiles(list.slice(0, 5));
  };

  // --- Submit incident ---
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.title && !form.description) {
      setMessage("Provide a title or description");
      return;
    }

    setLoading(true);
    setMessage("");

    try {
      let res;
      if (files.length > 0) {
        const fd = new FormData();
        Object.entries(form).forEach(([k, v]) => fd.append(k, v));
        if (user?.id) fd.append("userId", user.id);
        files.forEach((f) => fd.append("images", f, f.name));

        res = await fetch(`${BASE_URL}/api/incidents`, { method: "POST", body: fd });
      } else {
        const payload = { ...form };
        if (user?.id) payload.userId = user.id;
        res = await fetch(`${BASE_URL}/api/incidents`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      }

      if (!res.ok) throw new Error(await res.text() || res.statusText);
      const saved = await res.json();

      setIncidents((prev) => [saved, ...prev]);
      setForm({ type: "Accident", title: "", description: "", location: "", latitude: "", longitude: "" });
      setFiles([]);
      setMessage("Incident submitted");
      setToast("Submitted: " + (saved.title || saved.type));
    } catch (err) {
      setMessage("Submit failed: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await fetch(`${BASE_URL}/auth/logout`, { method: "POST", credentials: "include" });
    } catch {}
    setUser(null);
  };

  const filtered = incidents.filter((inc) => {
    if (filterCategory !== "All" && inc.type !== filterCategory) return false;
    if (showMine && user) return inc.userId === user.id;
    if (showMine && !user) return false;
    return true;
  });

  const formatDate = (d) => {
    try {
      if (!d) return "";
      const dt = new Date(d);
      return isNaN(dt) ? String(d) : dt.toLocaleString();
    } catch {
      return String(d);
    }
  };

  // --- Spinner ---
  const Spinner = ({ className = "w-4 h-4" }) => (
    <svg className={`${className} animate-spin`} viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path>
    </svg>
  );

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
                <div className="text-right">Signed in as <strong>{user.email || user.username}</strong></div>
                <button onClick={handleLogout} className="px-3 py-1 rounded-md bg-white border border-gray-200 text-slate-700 hover:bg-gray-50">
                  Logout
                </button>
                <button onClick={() => setShowMine((s) => !s)} className={`px-3 py-1 rounded-md ${showMine ? "bg-indigo-600 text-white" : "bg-white border"}`}>
                  {showMine ? "Showing: Mine" : "Show Mine"}
                </button>
              </div>
            </div>
          ) : (
            <div className="text-sm text-slate-700 font-bold">Welcome back, citizen</div>
          )}
        </div>
      </header>

      <form onSubmit={handleSubmit} className="mb-6 bg-white border border-gray-100 rounded-lg p-4 sm:p-5 shadow-sm">
        {/* Form fields (type, title, description, location, images) */}
        {/* ... keep same as previous code ... */}
        {/* Buttons */}
        <div className="mt-4 flex flex-col sm:flex-row items-center gap-3">
          <button type="submit" disabled={loading} className={`inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-medium text-white shadow ${loading ? 'bg-indigo-300 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700'}`}>
            {loading && <Spinner className="w-4 h-4 text-white" />}
            <span className="ml-2">{loading ? "Submitting..." : "Submit Incident"}</span>
          </button>
          <button type="button" onClick={loadIncidents} disabled={loading} className={`inline-flex items-center justify-center rounded-md px-3 py-2 text-sm font-medium ${loading ? "bg-gray-100 text-gray-400 cursor-not-allowed" : "bg-white border border-gray-200 text-slate-700 hover:bg-gray-50"}`}>
            {loading && <Spinner className="w-4 h-4 text-slate-500" />}
            <span className="ml-2">{loading ? "Loading…" : "Load Incidents"}</span>
          </button>
          <span className="ml-auto text-sm text-slate-500">{incidents.length} loaded</span>
        </div>
      </form>

      {/* Toast & messages */}
      {message && <div className="mb-4 text-sm text-rose-600">{message}</div>}
      {toast && <div className="mb-4 text-sm text-indigo-600">{toast}</div>}

      {/* Incident list */}
      <section>
        <h2 className="text-lg font-medium text-slate-800">Submitted Incidents ({filtered.length})</h2>
        <ul className="grid gap-3 mt-3 grid-cols-1 sm:grid-cols-2">
          {filtered.map((inc, i) => (
            <li key={inc.id ?? i} className="bg-white border border-gray-100 rounded-lg p-4 shadow-sm hover:shadow-md flex flex-col">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="text-slate-900 font-semibold">{inc.title || inc.type}</div>
                  <div className="text-xs text-slate-500 mt-1">{inc.type} • {inc.location || "Unknown location"}</div>
                  {(inc.latitude || inc.longitude) && <div className="text-xs text-slate-400 mt-1">Lat: {inc.latitude} • Lon: {inc.longitude}</div>}
                  {inc.description && <p className="mt-3 text-sm text-slate-700 line-clamp-4">{inc.description}</p>}
                  {Array.isArray(inc.images) && inc.images.length > 0 && (
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      {inc.images.map((src, idx) => (
                        <img key={idx} src={`${BASE_URL}${src}`} alt={`incident ${idx + 1}`} className="w-full h-28 object-cover rounded border" />
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
}

export default Home;
