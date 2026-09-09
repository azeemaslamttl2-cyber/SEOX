import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

const BulkAnalysisToggle = () => {
    const navigate = useNavigate();
    const { pathname } = useLocation();

    const current = pathname.includes('/bing-bulk-analysis')
        ? 'bing'
        : pathname.includes('/yandex-bulk-analysis')
            ? 'yandex'
            : 'google';

    const options = [
        { id: 'google', label: 'Google', path: '/gsc/bulk-analysis' },
        { id: 'bing', label: 'Bing', path: '/gsc/bing-bulk-analysis' },
        { id: 'yandex', label: 'Yandex', path: '/gsc/yandex-bulk-analysis' }
    ];

    const GoogleIcon = () => (
        <svg className="w-4 h-4" viewBox="0 0 48 48" aria-hidden="true">
            <path fill="#EA4335" d="M24 20.4v7.6h10.8c-1.4 4.4-5.6 7.6-10.8 7.6-6.6 0-12-5.4-12-12s5.4-12 12-12c3.2 0 6.1 1.2 8.3 3.2l5.2-5.2C34.2 6.3 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20c10.5 0 19-7.6 19-20 0-1.3-.1-2.6-.4-3.6H24z" />
            <path fill="#34A853" d="M6.8 14.7l6.3 4.6C14.8 15.3 19 12.4 24 12.4c3.2 0 6.1 1.2 8.3 3.2l5.2-5.2C34.2 6.3 29.3 4 24 4 16.3 4 9.6 8.3 6.8 14.7z" />
            <path fill="#FBBC05" d="M24 44c5.1 0 9.9-1.7 13.3-4.7l-6.1-5c-1.7 1.2-3.9 1.9-7.2 1.9-5.1 0-9.3-3.2-10.8-7.6l-6.4 4.9C9.6 39.7 16.3 44 24 44z" />
            <path fill="#4285F4" d="M43.6 20.4H24v7.6h10.8c-.7 2.3-2.1 4.2-4 5.5l6.1 5C40.6 35.2 43 30.2 43 24c0-1.3-.1-2.6-.4-3.6z" />
        </svg>
    );

    const BingIcon = () => (
        <svg className="w-4 h-4" viewBox="0 0 234 343" fill="none" aria-hidden="true">
            <path d="M0 0v259l85 51 100-50v-49l-100-47V0L0 28zm85 221v-43l49 23-49 20z" fill="#008373" />
            <path d="M85 0v164l100 46v50l49-25V121L85 0z" fill="#00A68E" />
        </svg>
    );

    const YandexIcon = () => (
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2zm1.5 15h-2v-5.5h-.25l-2 5.5H8l2-5.5H9v-2h5v2h-1l-.5 1.5V17z" fill="#FF0000" />
        </svg>
    );

    const iconFor = (id) => {
        if (id === 'bing') return <BingIcon />;
        if (id === 'yandex') return <YandexIcon />;
        return <GoogleIcon />;
    };

    return (
        <div className="bulk-engine-switch">
            {options.map((opt) => {
                const isActive = current === opt.id;
                return (
                    <button
                        key={opt.id}
                        onClick={() => navigate(opt.path)}
                        className={`bulk-engine-btn ${isActive ? 'active' : ''}`}
                        aria-pressed={isActive}
                        aria-label={`${opt.label} Bulk Analysis`}
                    >
                        {iconFor(opt.id)}
                        <span className="hidden sm:inline">{opt.label}</span>
                    </button>
                );
            })}
        </div>
    );
};

export default BulkAnalysisToggle;
