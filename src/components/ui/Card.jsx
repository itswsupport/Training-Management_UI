"use client";
import React from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { createMemoizedComponent } from '@/lib/optimizeComponent';

const DashboardCard = createMemoizedComponent(({ 
  title, 
  icon, 
  onClick,
  variant = 'primary',
  loading = false,
  disabled = false,
  counter = null,
  subtitle = '',
  className = ''
}) => {
  const variants = {
    primary: 'bg-[#3482AE] text-white',
    secondary: 'bg-white text-[#3482AE] border border-[#3482AE]',
    warning: 'bg-[#ffc107] text-white',
    success: 'bg-[#20c997] text-white',
    danger: 'bg-[#dc3545] text-white',
    custom: 'bg-[#3482AE] text-white'
  };

  return (
    <div
      onClick={!disabled && !loading ? onClick : undefined}
      className={`
        ${variants[variant]} 
        p-4 rounded-[5px] 
        ${!disabled && !loading ? 'hover:cursor-pointer hover:brightness-95' : 'opacity-75 cursor-not-allowed'}
        transition-all duration-200
        ${className}
      `}
    >
      <div className="flex flex-col items-center text-center relative">
        {loading ? (
          <div className="w-12 h-12 rounded-full border-4 border-t-transparent animate-spin" />
        ) : (
          <div className="w-12 h-12 bg-opacity-20 rounded-full flex items-center justify-center mb-3 group-hover:bg-opacity-30 transition-all">
            <FontAwesomeIcon icon={icon} style={{ width: "2rem", height: "2rem" }} />
          </div>
        )}
<h3 className="text-[12px] font-normal">{title}</h3>
        {subtitle && <p className="text-sm mt-1 opacity-90">{subtitle}</p>}
        {counter !== null && (
          <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
            {counter}
          </span>
        )}
      </div>
    </div>
  )
});

export default DashboardCard;
