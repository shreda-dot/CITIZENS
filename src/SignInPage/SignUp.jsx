import api from "@/utils/axios";
import { useState, useEffect, useRef } from "react";
import { useNavigate, Link } from "react-router-dom";

const SignupPage = () => {
  const navigate = useNavigate();
  const timerRef = useRef(null);

  const [userdata, setUserData] = useState({ email: "", password: "" });
  const [errors, setErrors] = useState({ email: "", password: "" });
  const [isFormValid, setIsFormValid] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");

  // Helper to read/write registered emails in localStorage (client-side guard)
  const getRegisteredEmails = () => {
    try {
      return JSON.parse(localStorage.getItem("registeredEmails") || "[]");
    } catch {
      return [];
    }
  };
  const saveRegisteredEmail = (email) => {
    const list = getRegisteredEmails();
    const normalized = email.toLowerCase();
    if (!list.includes(normalized)) {
      list.push(normalized);
      localStorage.setItem("registeredEmails", JSON.stringify(list));
    }
  };

  // Live validation + client-side check for existing email
  useEffect(() => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const registered = getRegisteredEmails();
    const emailLower = userdata.email.trim().toLowerCase();

    const emailError =
      userdata.email.length === 0
        ? "Email is required"
        : !emailRegex.test(userdata.email)
        ? "Invalid email format"
        : registered.includes(emailLower)
        ? "Email already exists!"
        : "";

    const passwordError =
      userdata.password.length === 0
        ? "Password is required"
        : userdata.password.length < 6
        ? "Password must be at least 6 characters"
        : "";

    setErrors((prev) => ({ ...prev, email: emailError, password: passwordError }));
    setIsFormValid(emailError === "" && passwordError === "");
  }, [userdata]);

  useEffect(() => {
    // cleanup timer on unmount
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const handleChange = (e) => {
    setUserData({ ...userdata, [e.target.name]: e.target.value });
    // clear server-side email error when user edits email
    if (e.target.name === "email") setErrors((prev) => ({ ...prev, email: "" }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    // Prevent submitting if already submitting or invalid
    if (!isFormValid || isSubmitting) return;

    // Client-side check: if email exists locally, do not hit backend
    const registered = getRegisteredEmails();
    const emailLower = userdata.email.trim().toLowerCase();
    if (registered.includes(emailLower)) {
      setErrors((prev) => ({ ...prev, email: "Email already exists!" }));
      return;
    }

    setIsSubmitting(true);

    try {
      const res = await api.post("/auth/register", userdata);
      // optionally store token if backend returns one:
      if (res?.data?.token) localStorage.setItem("token", res.data.token);

      // Save this email locally so future attempts won't hit backend
      saveRegisteredEmail(userdata.email);

      // show success message and then redirect to login
      setSuccessMessage("You have completed signup. Redirecting to login...");
      timerRef.current = setTimeout(() => {
        navigate("/login");
      }, 2000);
    } catch (err) {
      console.log("Signup error:", err?.response?.data);

      const status = err?.response?.status;
      const msg = err?.response?.data?.message || "Signup failed";

      // If backend indicates email already exists (commonly 409) or message mentions email, show inline error
      if (status === 409 || /email/i.test(msg)) {
        // Also save locally to avoid future unnecessary backend calls for the same email
        saveRegisteredEmail(userdata.email);
        setErrors((prev) => ({ ...prev, email: "Email already exists!" }));
      } else {
        // fallback: show generic error
        alert(msg);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-4 max-w-sm mx-auto mt-8 p-6 bg-white rounded shadow text-black"
    >
      <h1 className="text-2xl font-bold text-center">Sign Up</h1>

      {successMessage && (
        <div className="text-sm text-emerald-700 bg-emerald-100 p-2 rounded text-center">
          {successMessage}
        </div>
      )}

      <div>
        <input
          type="text"
          name="email"
          placeholder="Email"
          value={userdata.email}
          onChange={handleChange}
          className="px-4 py-2 border border-gray-300 rounded w-full focus:outline-none focus:ring-2 focus:ring-emerald-500"
          disabled={!!successMessage}
        />
        {errors.email && <p className="text-xs text-red-500">{errors.email}</p>}
      </div>

      <div>
        <input
          type="password"
          name="password"
          placeholder="Password"
          value={userdata.password}
          onChange={handleChange}
          className="px-4 py-2 border border-gray-300 rounded w-full focus:outline-none focus:ring-2 focus:ring-emerald-500"
          disabled={!!successMessage}
        />
        {errors.password && (
          <p className="text-xs text-red-500">{errors.password}</p>
        )}
      </div>
      
      <button
        type="submit"
        disabled={!isFormValid || isSubmitting || !!successMessage}
        className={`py-2 rounded p-10 text-white transition-colors ${
          isFormValid && !isSubmitting && !successMessage
            ? "bg-emerald-600 hover:bg-emerald-700"
            : "bg-gray-400 cursor-not-allowed"
        }`}
      >
        {isSubmitting ? "Submitting..." : "Sign Up"}
      </button>

      <p className="text-sm text-center mt-2">
        Already have an account?{" "}
        <Link to="/login" className="text-emerald-600 hover:underline font-medium">
          Login
        </Link>
      </p>
    </form>
  );
};

export default SignupPage;
