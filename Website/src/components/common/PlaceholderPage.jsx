// src/components/common/PlaceholderPage.jsx
import React from 'react';

const PlaceholderPage = ({ title }) => (
    <div className="container mx-auto p-4 sm:p-8 min-h-screen">
        {/* PERMANENT DARK THEME CLASSES */}
        <div className="bg-gray-800 p-8 rounded-xl shadow-lg shadow-gray-950/50">
            <h1 className="text-3xl font-bold text-white mb-4">{title}</h1>
            <p className="text-gray-400">This page is under construction. The site is running in a permanent dark theme.</p>
        </div>
    </div>
);

export default PlaceholderPage;