// Details for the database stored on localhost called spotify_database
// Limits the connection to 2, uses the login details for user Cmurray

const env = process.env;

const config = {
    db: {
        host: env.DB_HOST || 'db',
        user: env.DB_USER || 'cmurray',
        password: env.DB_PASSWORD || 'Pokemon11',
        database: env.DB_NAME || 'spotify_database',
        waitForConnections: true,
        connectionLimit: env.DB_CONN_LIMIT || 2,
        queueLimit: 0,
        debug: env.DB_DEBUG || false,
        port: 3306 
    }
};

module.exports = config;
