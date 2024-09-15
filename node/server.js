const http = require( 'http' );         // Server library.
const url = require( 'url' );           // Used to parse URL parameters.
const fs = require( 'fs' );

const budget         = require( "./budget.js" );
const dbLib          = require( "./db.js" );
const accounts       = require( "./accounts.js" );
const mattresses     = require( "./mattresses.js" );
const transactions   = require( "./transactions.js" );
const user           = require( "./users.js" );
const util           = require( "./util.js" );
const RESPONSE_CODES = require( './response_codes.js' ).RESPONSE_CODES;


// Define access restricted locations.
const accessRestriction = [
    {
        // The paths with restricted access.
        // Will be checked using pathname.startsWith( startPath ).
        startPath : "/api/admin",

        // User roles allowed to access the content.
        // If empty, all roles are allowed, but must be logged in.
        rolesAllowed : [ "admin" ]
    }
];


/**
 * @brief API endpoint handlers. Handler name must match the API endpoint topic
 * which is the second part of the API endpoint matching the format 
 * /api/<topic>/<actionRequest>
 * 
 * Each handler is expected to take the following parameters:
 *  res     HTTP response object
 *  req     HTTP request object
 *  obj     Data passed to the endpoint
**/
const ACTION_HANDLERS = {
    transactions: transactions.ACTION_HANDLERS,
    mattresses: mattresses.ACTION_HANDLERS,
    accounts: accounts.ACTION_HANDLERS,
    budget: budget.ACTION_HANDLERS,
    user: user.ACTION_HANDLERS,
}

let TIME_ZONE = "America/Chicago"


module.exports = {
    createServer: function( hostname, port, timeZone )
    {
        TIME_ZONE = timeZone;
        return http.createServer( serverAction );
    },
}

var serverAction = async function ( req, res )
{
    // Display date and action for debugging
    let date = new Date( new Date().toLocaleString( "en-US", { timeZone: TIME_ZONE } ) );
	let timeStr = date.toTimeString().substring( 0, 8 );
	let dateStr = date.toDateString();


    // Get the path information.
    let url_parts = url.parse( req.url, true );
    let pathname = url_parts.pathname;


    console.log( " " ); // New line
    console.log( `[${timeStr} ${dateStr}] ${req.method} ${pathname}` );


    // This should be taken care of with appropriate reverse proxy handling.
    // E.g., nginx rules
    if( !pathname.startsWith( "/api" ) )
    {
        res.writeHead( 400 );
        return;
    }


    // Expected format begins with /api/<topic>/<actionRequest>
    let topic = pathname.split( "/" )[ 2 ];
    let actionRequest = pathname.split( "/" )[ 3 ];
    if( await handleRequest( res, req, pathname, topic, actionRequest ) == 0 )
        return;


    switch( topic )
    {
        case "test":
            util.resolveAction( res, 200, { "response" : "working" } );
            break;
        default:
            util.resolveAction( res, 400, { "response" : RESPONSE_CODES.BadAPICommand } );
    }

    return;




    // If we haven't found the path yet, then we need to look through access
    // restricted locations. If it isn't found there, then it is a bad 
    // request.

    let accessIndex = -1;
    for( let i = 0; i < accessRestriction.length; i++ )
    {
        if( pathname.startsWith( accessRestriction[ i ].startPath ) )
        {
            accessIndex = i;
            break;
        }
    }

    if( accessIndex == -1 )
    {
        badRequest( res );
    }
    else
    {
        console.log( `  Requesting restricted access: ${accessIndex}.\n` );

        // util.resolveAction( res, 200, { 'result' : 'restricted access' } );
        await handleRestrictedAccess( res, req, pathname, url_parts );
    }

    return;
}


async function handleRequest( res, req, pathname, topic, actionRequest )
{
    const TOPIC_ACTION_HANDLERS = ACTION_HANDLERS[ topic ];
    if( !TOPIC_ACTION_HANDLERS ) return 1;

    // Verify that the requested action exists before parsing anything.
    if( !TOPIC_ACTION_HANDLERS[ actionRequest ] )
    {
        util.resolveAction( res, 400, { "response" : RESPONSE_CODES.BadAPICommand } );
        return 0;
    }

    if( req.method === "POST" )
    {
        let body = '';

        req.on( 'data', (data) => {
            body += data;
        });

        req.on( 'end', async () => {
            let obj = {};
            try
            {
                obj = JSON.parse( body );
            }
            catch( e )
            {
                console.log( "ERROR: Unable to parse POST body." );
                console.log( body );
                util.resolveAction( res, 400, { "response" : RESPONSE_CODES.MissingData } );
                return 0;
            }

            TOPIC_ACTION_HANDLERS[ actionRequest ]( res, req, obj );
        });

        return 0;
    }
    else if( req.method == "GET" )
    {
        TOPIC_ACTION_HANDLERS[ actionRequest ]( res, req );
    }
    else
    {
        console.log( `  Received invalid request.` );
        res.statusCode = 400;
        res.end();
        return 0;
    }

    return 0;
}


async function handleRestrictedAccess( res, req, pathname, url_parts )
{
    // If no dot in final part of path and doesn't end with /,
    // append slash and redirect. Because of how authenticated content 
    // serving works, it will look for the (e.g.) index.js and index.css
    // files in the previous directory.
    let pathnameParts = pathname.split( "/" );
    if( !pathnameParts[ pathnameParts.length - 1 ].includes( "." ) && 
        pathname.slice( -1 ) !== "/" )
    {
        res.writeHead( 302, {
            'Location': `${pathname}/`
        });
        res.end();
        return;
    }

    console.log( `  Validating Token...` );
    console.log( `    Pathname: ${pathname}`);
    let result = await users.validateToken( req );
    res.statusCode = 200;
    if( result.result == 0 )
    {
        console.log( `  User validated.` );

        // Verify that user is part of admin group.
        if( !result.user.roles.includes( "admin" ) )
        {
            // Non-admin users are forbidden.
            console.log( `  User not part of admin group.` );
            res.statusCode = 403;
            res.setHeader( 'Content-Type', 'text/plain' );
            res.end( "Access Forbidden." );

            return;
        }

        // If POST request, handle request. Otherwise, serve content.
        if( req.method === "POST" )
        {
            await admin.handleResponse( res, req, pathname, url_parts );
            return;
        }


        // Check if user needs NickFlix redirection.
        if( pathname.match( /\/nickflix\/(series|movie|collection)\/[A-Za-z0-9]+/ ) )
        {
            console.log( `  Matched NickFlix series/movie/collection display.` );

            try
            {
                let fileStat = await fs.statSync( `../html/nickflix/index.html` );
                if(fileStat.isFile() )
                {
                    let path = `../html/nickflix/index.html`;
                    fs.readFile( path, (err, data) => {
                        if( err )
                        {
                            console.log( `  Error reading file.` );
                            res.statusCode = 404;
                            res.setHeader( 'Content-Type', 'text/plain' );
                            res.end( "404" );

                            return;
                        }
                        else
                        {
                            res.setHeader( 'Content-Type', 'text/html' );
                            res.write( data );
                            res.end();

                            return;
                        }
                    } );
                    
                    return;
                }
            }
            catch( e )
            {
                console.log( `  Couldn't find NickFlix home page.` );
                console.log( e );
                res.statusCode = 404;
                res.setHeader( 'Content-Type', 'text/plain' )
                res.end( "404" );
            }
        }

        // Check if requested file exists. If not, check various versions of
        // the requested content path to try to find the file. If none are 
        // found, return 404 message.
        let appends = [ '', '.html', '/index.html' ];
        let path = `../html${pathname.replace( /%20/g, ' ' )}`;
        for( let i = 0; i < appends.length; i++ )
        {
            try
            {
                // Attempt to load the requested resource from the system.
                // Replace all '%20' occurrences with a space.
                console.log( `  Path: ${path}` );
                let fileStat = await fs.statSync( `${path}${appends[ i ]}` );

                if( fileStat.isFile() )
                {
                    path = `${path}${appends[ i ]}`;
                    fs.readFile( path, (err, data) => {
                        if( err )
                        {
                            res.statusCode = 404;
                            res.setHeader( 'Content-Type', 'text/plain' )
                            res.end( "404" );
                        }
                        else
                        {
                            if( path.endsWith( '.html' ) ) 
                                res.setHeader( 'Content-Type', 'text/html' );
                            else if( path.endsWith( '.css' ) ) 
                                res.setHeader( 'Content-Type', 'text/css' );
                            else if( path.endsWith( '.js' ) ) 
                                res.setHeader( 'Content-Type', 'text/javascript' );
                            res.write( data );
                            res.end();
                        }
                    } );

                    break;
                }
                else if( i == appends.length - 1 )
                {
                    res.statusCode = 404;
                    res.setHeader( 'Content-Type', 'text/plain' )
                    res.end( "404" );
                }
            }
            catch( e )
            {
                // Path doesn't exist.
                if( i == appends.length - 1 )
                {
                    res.statusCode = 404;
                    res.setHeader( 'Content-Type', 'text/plain' )
                    res.end( "404" );
                }
            }
        }
    }
    else if( result.result == 1 )
    {
        console.log( `  error accessing database` );
    }
    else if( result.result == 2 )
    {
        console.log( `  no matching username found` );
    }
    else if( result.result == 3 )
    {
        console.log( `  blocked attempted sign-in not matching username or ip address` );
    }
    else if( result.result == 4 )
    {
        console.log( `  no matching token found` );
    }
    else if( result.result == 5 )
    {
        console.log( `  no cookie found (username or login_token)` );
    }

    if( result.result !== 0 )
    {
        // Redirect to the login page if we failed the token check.
        res.writeHead( 302, {
            'Location': `/account/login?redir_url=${req.url}`
        });
        res.end();
    }
}


function badRequest( res )
{
    res.statusCode = 400;
    res.end();
    return;
}



