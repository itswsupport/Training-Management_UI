'use client';

import { useState, useEffect } from 'react';

export default function ScrollFooter() {
  const [isVisible, setIsVisible] = useState(true);
  const [lastScrollY, setLastScrollY] = useState(0);

  useEffect(() => {
    const mainContent = document.getElementById('main-content');
    if (!mainContent) return;

    const handleScroll = () => {
      const currentScrollY = mainContent.scrollTop;
      
      // Show footer when scrolling up or at top
      if (currentScrollY < lastScrollY || currentScrollY === 0) {
        setIsVisible(true);
      } 
      // Hide footer when scrolling down (but not immediately)
      else if (currentScrollY > lastScrollY && currentScrollY > 100) {
        setIsVisible(false);
      }
      
      setLastScrollY(currentScrollY);
    };

    mainContent.addEventListener('scroll', handleScroll, { passive: true });
    
    return () => {
      mainContent.removeEventListener('scroll', handleScroll);
    };
  }, [lastScrollY]);

  return (
    <footer
      // Measured by MaterialViewer, which stops short of it so the footer stays
      // visible while a document is open.
      id="app-footer"
      className={`
        absolute bottom-0 left-0 right-0 
        bg-white border-t border-gray-200 
        px-4 py-3 
        transition-transform duration-300 ease-in-out
        ${isVisible ? 'translate-y-0' : 'translate-y-full'}
        shadow-lg
      `}
    >
      <div className="flex justify-between items-center">
        <div className="flex items-center space-x-4">
          <span className="text-sm text-gray-600">Copyright © 2024-2025 Rucha Yantra Pvt. Ltd. All rights reserved.</span>
        </div>
        <div className="flex items-center space-x-4">
          <button className="text-sm text-gray-600 hover:text-[#3482AE] transition-colors">
            Privacy Policy
          </button>
          <button className="text-sm text-gray-600 hover:text-[#3482AE] transition-colors">
            Terms of Service
          </button>
          <button className="text-sm text-gray-600 hover:text-[#3482AE] transition-colors">
            Contact
          </button>
        </div>
      </div>
    </footer>
  );
}