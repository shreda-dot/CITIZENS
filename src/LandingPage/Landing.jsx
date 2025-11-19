 import React from "react";
import { Link } from "react-router-dom";


 const LandingPage = () => {
   return (
     <div className="min-h-screen flex flex-col items-center justify-center bg-gray-900">       
         <h1 className="text-4xl font-bold text-white mb-4">Welcome to Our App</h1>
            <p className="text-lg text-gray-300 mb-8">Your gateway to awesome features</p>
            <Link
                to="/login"
                className="px-6 py-3 bg-blue-600 text-white rounded hover:bg-blue-700 transition"
            >
                Get Started
            </Link>   
            

            </div>

  
   );
 }
 export default LandingPage;