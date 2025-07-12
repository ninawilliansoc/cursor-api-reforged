module.exports = {
    port: process.env.PORT || 3010,
    proxy:{
        enabled: false,
        url: 'http://127.0.0.1:7890',
    },
    auth: {
        cookies: process.env.AUTH_COOKIE ? process.env.AUTH_COOKIE.split(',').map(cookie => cookie.trim()) : [],
        currentCookieIndex: 0
    },
    admin: {
        ownerUser: process.env.OWNER_USER || 'admin',
        ownerPassword: process.env.OWNER_PASSWORD || 'admin'
    },
    //chatMode: 1 // 1 for ask, 2 for agent, 3 for edit
};
