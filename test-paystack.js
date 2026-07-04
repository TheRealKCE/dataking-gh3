const fetch = require('node-fetch');
async function run() {
    const res = await fetch('http://localhost:3000/api/classifieds/boost/initialize', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            listing_id: 'test-id',
            tier: '7d'
        })
    });
    const text = await res.text();
    console.log(res.status, text);
}
run();
