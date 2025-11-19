import React from 'react'
import { Routes, Route } from "react-router-dom";
import LoginPage from './LoginPage/Login.jsx';
import Home from './HomePage/Home.jsx';
import LandingPage from './LandingPage/Landing.jsx';
import SignupPage from './SignInPage/SignUp.jsx';
const App = () => {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/Home" element={<Home />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/signup" element={<SignupPage />} />
    </Routes>
    
  )
}

export default App
