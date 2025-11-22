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
  const [serverError, setServerError] = useState("");

  // Live validation
  useEffect(() => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    const emailError =
      userdata.email.length === 0
        ? "Email is required"
        : !emailRegex.test(userdata.email)
        ? "Invalid email format"
        : "";

    const passwordError =
      userdata.password.length === 0
        ? "Password is required"
        : userdata.password.length < 6
        ? "Password must be at least 6 characters"
        : "";

    setErrors({ email: emailError, password: passwordError });
    setIsFormValid(emailError === "" && passwordError === "");
  }, [userdata]);

  useEffect(() => {
    return () => timerRef.current && clearTimeout(timerRef.current);
  }, []);

  const handleChange = (e) => {
    setUserData({ ...userdata, [e.target.name]: e.target.value });
    setServerError(""); // reset backend error when typing
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!isFormValid || isSubmitting) return;

    setIsSubmitting(true);

    try {
      const res = await api.post("/auth/register", userdata);

      setSuccessMessage("Signup successful! Redirecting...");
      timerRef.current = setTimeout(() => {
        navigate("/login");
      }, 2000);
    } catch (err) {
      const status = err?.response?.status;
      const msg = err?.response?.data?.message || "Signup failed";

      if (status === 409) {
        setServerError("Email already exists!");
      } else {
        setServerError(msg);
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
        <p className="text-sm text-emerald-700 bg-emerald-100 p-2 rounded text-center">
          {successMessage}
        </p>
      )}

      {serverError && (
        <p className="text-sm text-red-600 bg-red-100 p-2 rounded text-center">
          {serverError}
        </p>
      )}

      <div>
        <input
          type="text"
          name="email"
          placeholder="Email"
          value={userdata.email}
          disabled={!!successMessage}
          onChange={handleChange}
          className="px-4 py-2 border border-gray-300 rounded w-full focus:outline-none focus:ring-2 focus:ring-emerald-500"
        />
        {errors.email && <p className="text-xs text-red-500">{errors.email}</p>}
      </div>

      <div>
        <input
          type="password"
          name="password"
          placeholder="Password"
          value={userdata.password}
          disabled={!!successMessage}
          onChange={handleChange}
          className="px-4 py-2 border border-gray-300 rounded w-full focus:outline-none focus:ring-2 focus:ring-emerald-500"
        />
        {errors.password && (
          <p className="text-xs text-red-500">{errors.password}</p>
        )}
      </div>

      <button
        type="submit"
        disabled={!isFormValid || isSubmitting || !!successMessage}
        className={`py-2 rounded px-10 text-white transition-colors ${
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
