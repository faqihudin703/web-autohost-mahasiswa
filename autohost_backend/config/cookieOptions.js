// backend/config/cookieOptions.js

const COOKIE_OPTIONS = {
    httpOnly: true,
    secure: true,
    sameSite: 'none',
    path: '/',
    domain: 'DOMAIN-YANG-DIPAKAI'
};

module.exports = COOKIE_OPTIONS;
