import api from "@/utils/axios";
import { AxiosError } from "axios";
import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";

const Login = () => {
  const navigate = useNavigate();

  const [userdata, setUserData] = useState({ email: "", password: "" });
  const [errors, setErrors] = useState({ email: "", password: "" });
  const [isFormValid, setIsFormValid] = useState(false);
  const [loginMessage, setLoginMessage] = useState("");
  const [loginError, setLoginError] = useState("");

  // Live validation
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
    setLoginError("");
    setLoginMessage("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!isFormValid) return;

    try {
      await api.post("/auth/login", userdata); // cookie is sent automatically
      setLoginError("");
      setLoginMessage("Welcome back!");

      setTimeout(() => {
        navigate("/home");
      }, 500);
    } catch (err) {
      if (err instanceof AxiosError) {
        setLoginMessage("");
        setLoginError(err.response?.data?.message || "Login failed");
      } else {
        setLoginError("An unexpected error occurred.");
      }
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-4 max-w-sm mx-auto mt-8 p-6 bg-white rounded shadow text-black"
    >
      <h1 className="text-2xl font-bold text-center">Login Page</h1>

      {loginMessage && <p className="text-xs text-green-600 text-center">{loginMessage}</p>}
      {loginError && <p className="text-xs text-red-600 text-center">{loginError}</p>}

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

      <Link to="/forgot" className="text-xs text-emerald-500 hover:underline">Forgotten Password?</Link>

      <button
        type="submit"
        disabled={!isFormValid}
        className={`py-2 rounded text-white transition-colors ${
          isFormValid ? "bg-emerald-600 hover:bg-emerald-700" : "bg-gray-400 cursor-not-allowed"
        }`}
      >
        Login
      </button>

      <p className="text-sm text-center mt-2">
        Don't have an account?{" "}
        <Link to="/signup" className="text-emerald-600 hover:underline font-medium">
          Sign up
        </Link>
      </p>
    </form>
  );
};

export default Login;
