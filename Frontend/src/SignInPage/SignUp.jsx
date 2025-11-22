import api from "@/utils/axios";
import { AxiosError } from "axios";
import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";

const Signup = () => {
  const navigate = useNavigate();

  const [userdata, setUserData] = useState({ email: "", password: "" });
  const [errors, setErrors] = useState({ email: "", password: "" });
  const [isFormValid, setIsFormValid] = useState(false);
  const [signupMessage, setSignupMessage] = useState("");
  const [signupError, setSignupError] = useState("");

  useEffect(() => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    const emailError =
      userdata.email.trim().length === 0
        ? "Email is required"
        : !emailRegex.test(userdata.email)
        ? "Invalid email format"
        : "";

    const passwordError =
      userdata.password.trim().length === 0
        ? "Password is required"
        : userdata.password.length < 6
        ? "Password must be at least 6 characters"
        : "";

    setErrors({ email: emailError, password: passwordError });
    setIsFormValid(emailError === "" && passwordError === "");
  }, [userdata]);

  const handleChange = (e) => {
    setUserData({ ...userdata, [e.target.name]: e.target.value });
    setSignupError("");
    setSignupMessage("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!isFormValid) return;

    try {
      await api.post("/auth/register", userdata); // cookie-based login optional
      setSignupError("");
      setSignupMessage("Registered successfully!");

      setTimeout(() => navigate("/login"), 1000);
    } catch (err) {
      if (err instanceof AxiosError) {
        setSignupMessage("");
        setSignupError(err.response?.data?.message || "Signup failed");
      } else {
        setSignupError("An unexpected error occurred.");
      }
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-4 max-w-sm mx-auto mt-8 p-6 bg-white rounded shadow text-black"
    >
      <h1 className="text-2xl font-bold text-center">Sign Up</h1>

      {signupMessage && <p className="text-xs text-green-600 text-center">{signupMessage}</p>}
      {signupError && <p className="text-xs text-red-600 text-center">{signupError}</p>}

      <div>
        <input
          type="text"
          name="email"
          placeholder="Email"
          value={userdata.email}
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
          onChange={handleChange}
          className="px-4 py-2 border border-gray-300 rounded w-full focus:outline-none focus:ring-2 focus:ring-emerald-500"
        />
        {errors.password && <p className="text-xs text-red-500">{errors.password}</p>}
      </div>

      <button
        type="submit"
        disabled={!isFormValid}
        className={`py-2 rounded text-white transition-colors ${
          isFormValid ? "bg-emerald-600 hover:bg-emerald-700" : "bg-gray-400 cursor-not-allowed"
        }`}
      >
        Sign Up
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

export default Signup;
