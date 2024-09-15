// Set up parameters for proxy server to listen on.
const hostname = '127.0.0.1';
const port = 3002;

const timeZone = "America/Denver"

const serverLib = require( './server.js' );
const server = serverLib.createServer( hostname, port, timeZone );


// Start-up code.
server.listen( port, hostname, async () => {
	// Display start debugging
	let date = new Date( new Date().toLocaleString( "en-US", { timeZone: timeZone } ) );
	let timeStr = date.toTimeString().substring( 0, 8 );
	let dateStr = date.toDateString();
	console.log( `========================================\n` +
				 `[${timeStr} ${dateStr}] Server starting.\n ` );
});

