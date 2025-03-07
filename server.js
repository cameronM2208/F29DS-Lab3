const axios = require('axios');
const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');
const { db } = require('./config');
const mysql = require('mysql2/promise');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

//Spotify API credentials
const APIKEY = 'd004568c68254dcd81027ecff0405e74';
const clientSecret = '7d11a8458d554aca972613127d683e39';
let accessToken = '';

//Creates connection to DB
let connection;
async function connectDB() {
    try {
        connection = await mysql.createConnection(db);
        console.log('Connected to MySQL database');
    } catch (err) {
        console.error('Error connecting to MySQL:', err);
    }
}

connectDB();

//Function to get user's location from ipinfo.io API
async function getUserCountry() {
    try {
        const response = await axios.get('https://ipinfo.io', {
            headers: {
                'Authorization': `Bearer bac34b12261f92`
            }
        });
        return response.data.country;
    } catch (error) {
        throw new Error('There has been an error when getting location');
    }
}

//Function to get country code from country name using "restcountries API"
async function getCountryCode(countryName) {
    try {
        const response = await axios.get(`https://restcountries.com/v2/name/${countryName}`);
        return response.data[0].alpha2Code;
    } catch (error) {
        throw new Error('Please enter valid country name E.g "United Kingdom"');
    }
}

//Function to get access token from Spotify
async function getAccessToken() {
    const tokenUrl = 'https://accounts.spotify.com/api/token';
    try {
        const response = await axios.post(tokenUrl, new URLSearchParams({
            grant_type: 'client_credentials'
        }), {
            auth: {
                username: APIKEY,
                password: clientSecret
            },
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        });
        accessToken = response.data.access_token;
        console.log('Access token refreshed:', accessToken);
    } catch (error) {
        console.error('Error fetching access token:', error.message);
        throw new Error('Error fetching access token');
    }
}

//Calls function used to get access token
getAccessToken();

// Refresh access token every hour
setInterval(getAccessToken, 3600 * 1000);

//This function will count the number of tracks made available by the artist in a specific country
async function getTracksByRegion(accessToken, artistId, country) {
    const headers = {
        'Authorization': `Bearer ${accessToken}`
    };

    const albumsUrl = `https://api.spotify.com/v1/artists/${artistId}/albums`;
    const params = {
        market: country,
        include_groups: 'album,single',
        limit: 50
    };

    try {
        const response = await axios.get(albumsUrl, { headers, params });
        const albums = response.data.items;
        let number_of_tracks = 0;

        for (const album of albums) {
            const albumUrl = `https://api.spotify.com/v1/albums/${album.id}/tracks?market=${country}`;
            const albumResponse = await axios.get(albumUrl, { headers });
            number_of_tracks += albumResponse.data.items.length;
        }

        return number_of_tracks;
    } catch (error) {
        console.error('Error getting artist albums:', error);
        throw error;
    }
}

//Function to get top tracks of an artist
async function getArtistTopTracks(artistId, country) {
    const endpoint = `https://api.spotify.com/v1/artists/${artistId}/top-tracks?market=${country}`;
    try {
        const response = await axios.get(endpoint, {
            headers: {
                'Authorization': `Bearer ${accessToken}`
            }
        });
        return response.data.tracks.map(track => ({
            name: track.name,
            album: track.album.name,
            duration: track.duration_ms,
            url: track.external_urls.spotify
        }));
    } catch (error) {
        throw new Error('Failed to fetch top tracks');
    }
}

//Function to store top tracks data in the database
async function storeTopTracks(artist, country, number_of_tracks) {
    const artistName = artist.name;

    try {
        await connection.query(
            'INSERT INTO searches (artist, country, number_of_tracks) VALUES (?, ?, ?)',
            [artistName, country, number_of_tracks]
        );
    } catch (error) {
        console.error('Failed to insert search data:', error);
    }
}

//WebSocket connection handling
wss.on('connection', async (ws, req) => {
    console.log('A user has connected');

    try {
        const userCountry = await getUserCountry();
        ws.userCountry = userCountry;
    } catch (error) {
        console.error('Error getting user country:', error);
        ws.userCountry = 'Unknown';
    }

    ws.on('close', () => {
        console.log('A user has disconnected');
    });

    ws.on('message', async (message) => {
        const data = JSON.parse(message);

        if (data.type === 'searchArtist') {
            const artistName = data.artistName;
            let country = data.country || ws.userCountry;

            try {
                if (country) {
                    country = await getCountryCode(country);
                }

                const searchUrl = `https://api.spotify.com/v1/search?q=${encodeURIComponent(artistName)}&type=artist`;
                const response = await axios.get(searchUrl, {
                    headers: {
                        'Authorization': `Bearer ${accessToken}`
                    }
                });

                const artists = response.data.artists.items;

                if (artists.length === 0) {
                    ws.send(JSON.stringify({ type: 'error', message: 'Artist Not Found' }));
                    return;
                }

                const artist = artists[0];
                const number_of_tracks = await getTracksByRegion(accessToken, artist.id, country);
                await storeTopTracks(artist, country, number_of_tracks);
                const topTracks = await getArtistTopTracks(artist.id, country);
                ws.send(JSON.stringify({ type: 'topTracks', artist, topTracks, country }));
            } catch (error) {
                ws.send(JSON.stringify({ type: 'error', message: error.message }));
            }
        } else if (data.type === 'chatMessage') {
            console.log('Received chat message:', data.message);
            //send chat message to all clients
            wss.clients.forEach(client => {
                if (client.readyState === WebSocket.OPEN) {
                    client.send(JSON.stringify({ type: 'chatMessage', message: data.message }));
                }
            });
        }
    });
});

//Provides access to the file in the current directory
app.use(express.static(path.join(__dirname)));

//Provides path to homepage
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'homepage.html'));
});

//New endpoint used to return last 20 db entries (for web service)
app.get('/api/latest-searches', async (req, res) => {
    try {
        const [rows] = await connection.query(
            'SELECT artist, country, number_of_tracks FROM searches ORDER BY id DESC LIMIT 20'
        );
        res.json(rows);
    } catch (error) {
        console.error('Failed to retrieve latest searches:', error);
        res.status(500).send('Internal Server Error');
    }
});

//Error handling in case there is an issue with a request
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).send('Something broke!');
});

//Start the server and provide terminal message
server.listen(3000, () => {
    console.log('Listening on port 3000');
});
