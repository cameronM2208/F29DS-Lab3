//creates a web socket assigned to local host port 3000
const ws = new WebSocket('ws://localhost:3000');

//displays a message when connection to the server is established 
ws.onopen = () => {
    console.log('Connected to server');
};

//When an event is triggered depending on the input the corresponding function is called 
ws.onmessage = (event) => {
    const data = JSON.parse(event.data);

    if (data.type === 'topTracks') {
        displayTopTracks(data.artist, data.topTracks, data.country);
    } else if (data.type === 'error') {
        displayError(data.message);
    } else if (data.type === 'chatMessage') {
        displayMsg(data.message);
    }
};

//This function will control the search bars 
function search() {
    const artistName = document.getElementById('searchBar').value.trim();
    const country = document.getElementById('countryInput').value.trim();

    if (artistName) {
        ws.send(JSON.stringify({ type: 'searchArtist', artistName, country }));
    }
}

//Function used to control the sending of chats through the send button
function sendMsg() {
    const message = document.getElementById('chatWind').value.trim();
    if (message) {
        ws.send(JSON.stringify({ type: 'chatMessage', message }));
        document.getElementById('chatWind').value = ''; 
    }
}

//This is used to display the top 10 tracks of an artist by the specified country
function displayTopTracks(artist, tracks, country) {
    const resultsDiv = document.getElementById('results');
    resultsDiv.innerHTML = `<h2>Top Tracks for ${artist.name} in ${country}</h2>`;

    //for each track the following information will be displayed (trackName, albumName, trackDuration, linkToTrack)
    tracks.forEach(track => {
        const trackDiv = document.createElement('div');
        trackDiv.classList.add('track');

        const trackName = document.createElement('p');
        trackName.textContent = `Track: ${track.name}`;
        trackDiv.appendChild(trackName);

        const albumName = document.createElement('p');
        albumName.textContent = `Album: ${track.album}`;
        trackDiv.appendChild(albumName);

        const trackDuration = document.createElement('p');
        trackDuration.textContent = `Duration: ${formatDuration(track.duration)}`;
        trackDiv.appendChild(trackDuration);

        const trackLink = document.createElement('a');
        trackLink.href = track.url;
        trackLink.target = '_blank';
        trackLink.textContent = 'Listen on Spotify';
        trackDiv.appendChild(trackLink);

        resultsDiv.appendChild(trackDiv);
    });
}

//This will display any errors which may occur
function displayError(message) {
    const resultsDiv = document.getElementById('results');
    resultsDiv.innerHTML = `<p class="error">${message}</p>`;
}

//Function to control Chat Messages 
function displayMsg(message) {
    const chatDiv = document.getElementById('chat');
    const messageElement = document.createElement('p');
    messageElement.textContent = message;
    chatDiv.appendChild(messageElement);
    chatDiv.scrollTop = chatDiv.scrollHeight;
}

//This function is used to format the duration of each track
function formatDuration(durationMs) {
    const minutes = Math.floor(durationMs / 60000);
    const seconds = ((durationMs % 60000) / 1000).toFixed(0);
    return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
}
