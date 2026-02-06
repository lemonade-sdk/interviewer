import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Upload, FileText, ArrowRight, Citrus } from 'lucide-react';

const Landing: React.FC = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState<'initial' | 'selection'>('initial');

  const handleBeginClick = () => {
    setStep('selection');
  };

  const handleDashboardClick = () => {
    navigate('/dashboard');
  };

  const handleSelection = (type: 'single' | 'multi') => {
    console.log(`Selected: ${type}`);
    // navigate(`/setup?type=${type}`);
  };

  return (
    <div className="flex h-screen w-full bg-lemonade-bg text-lemonade-fg overflow-hidden font-sans">
      {/* Left Side - Resume Upload */}
      <div className="w-1/4 h-full border-r-2 border-dashed border-gray-300 flex flex-col items-center justify-center p-8 bg-white/50 transition-all duration-500 hover:bg-white/80">
        <div className="w-full h-full border-2 border-dashed border-gray-400 rounded-2xl flex flex-col items-center justify-center cursor-pointer hover:border-lemonade-accent-hover hover:bg-lemonade-accent/10 transition-colors group">
          <Upload className="w-12 h-12 text-gray-400 mb-4 group-hover:text-lemonade-accent-hover transition-colors" />
          <h3 className="text-xl font-bold text-gray-700 mb-2 group-hover:text-black">Upload Resume</h3>
          <p className="text-sm text-gray-500 text-center px-4">
            Drag & drop or click to upload PDF/Word
          </p>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 relative flex flex-col items-center justify-center">
        
        {/* Header - Always visible */}
        <div className="absolute top-12 left-0 right-0 flex flex-col items-center justify-center">
          <div className="flex items-center gap-3 mb-2">
            <Citrus className="w-10 h-10 text-lemonade-accent-hover" />
            <h1 className="text-4xl font-extrabold tracking-widest uppercase">Interviewer</h1>
          </div>
          
          {/* Subtitle - Appears in selection step */}
          <div 
            className={`mt-4 transition-all duration-700 transform ${
              step === 'selection' 
                ? 'opacity-100 translate-y-0' 
                : 'opacity-0 -translate-y-4'
            }`}
          >
            <p className="text-lg font-medium text-gray-600">Select your interview process</p>
          </div>
        </div>

        {/* Center Interaction Area */}
        <div className="relative flex flex-col items-center justify-center w-full max-w-4xl">
          
          {/* Initial Buttons Container */}
          <div className="flex items-center gap-8 transition-all duration-700 transform">
            
            {/* BEGIN Button */}
            <button
              onClick={handleBeginClick}
              className={`
                px-12 py-4 rounded-full font-bold text-xl shadow-lg transition-all duration-700
                bg-lemonade-accent hover:bg-lemonade-accent-hover hover:scale-105 active:scale-95
                text-black
                ${step === 'selection' ? '-translate-y-32 scale-110' : 'translate-y-0'}
              `}
            >
              Begin
            </button>

            {/* DASHBOARD Button */}
            <button
              onClick={handleDashboardClick}
              className={`
                px-12 py-4 rounded-full font-bold text-xl shadow-lg transition-all duration-500
                bg-white border-2 border-lemonade-accent hover:bg-gray-50 hover:scale-105 active:scale-95
                text-black
                ${step === 'selection' ? 'opacity-0 translate-x-12 pointer-events-none' : 'opacity-100 translate-x-0'}
              `}
            >
              Dashboard
            </button>
          </div>

          {/* Selection Buttons - Appear after BEGIN is clicked */}
          <div 
            className={`
              absolute top-24 w-full flex justify-center gap-8 transition-all duration-700 delay-300
              ${step === 'selection' ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-12 pointer-events-none'}
            `}
          >
            {/* One Stage Interview */}
            <button
              onClick={() => handleSelection('single')}
              className="group flex flex-col items-center justify-center w-64 h-40 bg-white rounded-2xl shadow-md border-2 border-transparent hover:border-lemonade-accent hover:shadow-xl transition-all duration-300"
            >
              <div className="w-12 h-12 rounded-full bg-lemonade-bg flex items-center justify-center mb-3 group-hover:bg-lemonade-accent transition-colors">
                <FileText className="w-6 h-6 text-black" />
              </div>
              <span className="font-bold text-lg text-black">One Stage</span>
              <span className="text-xs text-gray-500 mt-1">Quick Interview</span>
            </button>

            {/* Multi Stage Interview */}
            <button
              onClick={() => handleSelection('multi')}
              className="group flex flex-col items-center justify-center w-64 h-40 bg-white rounded-2xl shadow-md border-2 border-transparent hover:border-lemonade-accent hover:shadow-xl transition-all duration-300"
            >
              <div className="w-12 h-12 rounded-full bg-lemonade-bg flex items-center justify-center mb-3 group-hover:bg-lemonade-accent transition-colors">
                <ArrowRight className="w-6 h-6 text-black" />
              </div>
              <span className="font-bold text-lg text-black">Multi Stage</span>
              <span className="text-xs text-gray-500 mt-1">Full Process</span>
            </button>
          </div>

        </div>
      </div>
    </div>
  );
};

export default Landing;
