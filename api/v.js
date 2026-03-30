
const SUPABASE_URL = 'https://xqvvwejwkmqdmsorqdzp.supabase.co';
const SUPABASE_KEY = 'sb_publishable_WLR6XzQijI3h1-oWa6T-mg_FeolGe9z';

export default async function handler(req, res) {
    const { v, u } = req.query;

    let title = "CemAbyss - Share & Discover";
    let description = "Watch amazing videos on CemAbyss.";
    let image = "https://cemabyss.vercel.app/og-default.png";
    let redirectPath = "/";

    try {
        if (v) {
            // Video Embed via Supabase REST API
            const r = await fetch(`${SUPABASE_URL}/rest/v1/videos?video_id=eq.${v}&select=*`, {
                headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
            });
            const data = await r.json();
            const video = data[0];
            if (video) {
                // Fetch uploader info for display name
                const upR = await fetch(`${SUPABASE_URL}/rest/v1/profiles?username=eq.${video.uploader}&select=display_name`, {
                    headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
                });
                const upData = await upR.json();
                const uploader = upData[0];
                const displayName = uploader ? (uploader.display_name || video.uploader) : video.uploader;

                title = `${video.title} - @${video.uploader}`;
                description = `Watch this video by ${displayName} (@${video.uploader}) on CemAbyss.`;
                image = video.thumb;
                redirectPath = `/v/${v}`;
            }
        } else if (u) {
            // Profile Embed via Supabase REST API
            const r = await fetch(`${SUPABASE_URL}/rest/v1/profiles?username=eq.${u}&select=*`, {
                headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
            });
            const data = await r.json();
            const profile = data[0];
            if (profile) {
                const nameStr = profile.display_name ? `${profile.display_name} (@${u})` : `@${u}`;
                title = `${nameStr} - CemAbyss`;
                description = profile.bio || `Check out ${u}'s profile on CemAbyss.`;
                image = profile.avatar_url || image;
                redirectPath = `/@${u}`;
            }
        }
    } catch (e) {
        console.error("Meta Proxy Error:", e);
    }

    res.setHeader('Content-Type', 'text/html');
    res.status(200).send(`
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>${title}</title>
    
    <!-- Open Graph / Facebook -->
    <meta property="og:type" content="website">
    <meta property="og:site_name" content="CemAbyss">
    <meta property="og:title" content="${title}">
    <meta property="og:description" content="${description}">
    <meta property="og:image" content="${image}">

    <!-- Twitter -->
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="${title}">
    <meta name="twitter:description" content="${description}">
    <meta name="twitter:image" content="${image}">

    <script>
        window.location.href = "${redirectPath}";
    </script>
</head>
<body style="background: #000; color: #fff; font-family: sans-serif; display: flex; align-items:center; justify-content:center; height: 100vh; margin: 0;">
    <div style="text-align: center;">
        <h2>Entering CemAbyss...</h2>
        <p>Loading ${title}...</p>
    </div>
</body>
</html>
    `);
}
