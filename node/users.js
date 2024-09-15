const querystring = require('querystring');
const https = require( 'https' );
const http = require( 'http' );
const url = require( "url" );
const fs = require( 'fs' );

const crypto = require( 'crypto' );
const bcrypt = require( 'bcrypt' );
const saltRounds = 10;

const jwt = require( 'jsonwebtoken' );
const jwtExpiresIn = 7 * 24 * 60 * 60 // seconds
const jwtSecretLength = 64 // bytes

const util = require( "./util.js" );

const dbLib = require( "./db.js" );


var DB_NAMES;
try { DB_NAMES = JSON.parse( fs.readFileSync( "db_names.json" ) ); }
catch( e ) { console.error( `Unable to read from DB names config file.\n${e}` ); }


const RESPONSE_CODES = require( './response_codes.js' ).RESPONSE_CODES;


const ACTION_HANDLERS = {
    // Values must be an async function that take a response, request, and 
    // (optional) object containing data.
    login:          login,
    new:            createNewAccount,
    validateToken:  checkIfLoggedIn,
}


module.exports = {
    ACTION_HANDLERS: ACTION_HANDLERS,
};


/**
 * @brief Generate a secure login token (cookie) for a user and add it to the
 * database.
 * 
 * @param username  Username to create a token for.
 * @param ip        Originating IP address of request.
 * 
 * @return 0: success, 1: database error
**/
async function createLoginToken( username, ip )
{
    // Create a login token (cookie) to be stored on user's system and
    // server for authentication.
    let expiresAt = new Date();
    expiresAt.setSeconds( expiresAt.getSeconds() + jwtExpiresIn );
    let secret = crypto.randomBytes( jwtSecretLength ).toString( 'hex' )
    let loginToken = await jwt.sign( { username: username, ip: ip }, 
        secret, { expiresIn: jwtExpiresIn } );
    let token = {
        "username"  : username,
        "expiresAt" : expiresAt,
        "createdAt" : new Date(),
        "ip"        : ip,
        "secret"    : secret,
        "token"     : loginToken,
    };

    result = await dbLib.createNewItem( DB_NAMES.dbName, DB_NAMES.loginTokensCollectionName, token );


    if( !result.acknowledged )
    {
        return null;
    }

    return loginToken;
}


async function checkIfLoggedIn( res, req )
{
    let result = await util.validateToken( req );
    res.setHeader( "Content-Type", "application/json" );
    if( result.result == 0 )
    {
        console.log( "    User already logged in." );

        let user = {}
        user.displayName = result.user.displayName;
        user.username = result.user.username;
        user.email = result.user.email;
        user.name = result.user.name;
        user.roles = result.user.roles;

        res.statusCode = 200;
        res.end( JSON.stringify( { 
            "response" : RESPONSE_CODES.AlreadyLoggedIn, 
            "data" : user
         } ) );
        return;
    }
    else if( result.result == 1 )
    {
        console.log( "    Error accessing database." );

        res.statusCode = 500;
        res.end( JSON.stringify( { "response" : RESPONSE_CODES.DatabaseError } ) );
        return;
    }
    else
    {
        console.log( `    User not logged in ${result.result}.` );

        res.statusCode = 200;
        res.end( JSON.stringify( { "response" : RESPONSE_CODES.InvalidToken } ) );
        return;
    }
}


async function login( res, req, data )
{
    res.setHeader( 'Content-Type', 'application/json' );

    console.log( `  Attempting login for ${data.username} from ${req.headers[ 'x-forwarded-for' ]}.` );


    // Check that the data we need is here.
    if( data.username == undefined || data.pass == undefined )
    {
        console.log( `    Username or password not found in request. Aborting login attempt.` );
        res.statusCode = 400;
        res.end( JSON.stringify( { "response" : RESPONSE_CODES.OK } ) );
        return;
    }


    // Store usernames as lowercase only.
    data.username = data.username.toLowerCase();


    console.log( `    Validating token.` );
    let result = await util.validateToken( req );
    let user = undefined;
    if( result.result == 0 )
    {
        console.log( "    User already logged in." );

        res.statusCode = 200;
        res.end( JSON.stringify( { "response" : RESPONSE_CODES.AlreadyLoggedIn } ) );
        return;
    }
    else if( result.result == 1 )
    {
        console.log( "    Error accessing database." );

        res.statusCode = 500;
        res.end( JSON.stringify( { "response" : RESPONSE_CODES.DatabaseError } ) );
        return;
    }
    else if( result.result == 2 )
    {
        console.log( `    User doesn't exist.` );

        // No need to error out for this case.
        // If user from cookie doesn't exist, user could have deleted
        // a previous account and is switching logins.

        // Get information for attempted sign-in user.
        let query = { "username" : data.username };
        let options = {};

        // Search for the user in the database.
        let users = await dbLib.getItems( DB_NAMES.dbName, DB_NAMES.usersCollectionName, query, options );
        if( !users )
        {
            // error accessing database
            result.result = 1;
            res.statusCode = 502;
            res.end( JSON.stringify( { "response" : RESPONSE_CODES.DatabaseError } ) );
            return result;
        }

        if( users.length == 0 )
        {
            console.log( `    User doesn't exist.` );

            res.statusCode = 401;
            res.end( JSON.stringify( { "response" : RESPONSE_CODES.UserDoesNotExist } ) );
            return;
        }

        user = users[ 0 ];
    }
    else if( result.result == 3 )
    {
        console.log( "WARNING: Attempted sign-in blocked.\nCorrect login token but incorrect username." );
        res.statusCode = 401;
        res.end( JSON.stringify( { "response" : RESPONSE_CODES.BadSignIn } ) );
        return;
    }
    else if( result.result == 4 )
    {
        console.log( `    No matching token found.` );
    }
    else if( result.result == 5 )
    {
        console.log( `    No cookie found.` );

        if( !result.user )
        {
            // If no user cookie was found, we still need to acquire the
            // user information from the database.
            let query = { "username" : data.username };
            let options = {};

            // Search for the user in the database.
            let users = await dbLib.getItems( DB_NAMES.dbName, DB_NAMES.usersCollectionName, query, options );
            if( !users )
            {
                // error accessing database
                result.result = 1;
                res.statusCode = 500;
                res.end( JSON.stringify( { "response" : RESPONSE_CODES.DatabaseError } ) );
                return result;
            }

            if( users.length == 0 )
            {
                console.log( `    User doesn't exist.` );

                res.statusCode = 401;
                res.end( JSON.stringify( { "response" : RESPONSE_CODES.UserDoesNotExist } ) );
                return;
            }

            user = users[ 0 ];
        }
    }


    console.log( `  Checking password.` );
    if( !user )
        user = result.user
    const match = await bcrypt.compare( data.pass, user.hash );
    if( match == true )
    {
        console.log( "    Password check successful." );

        let loginToken = await createLoginToken( user.username, req.headers[ "x-forwarded-for" ] );
        if( !loginToken )
        {
            console.log( `  Unknown login token creation error.` );
            util.resolveAction( res, 502, { response: RESPONSE_CODES.DatabaseError } );
            return;
        }

        res.statusCode = 200;
        res.setHeader( 'Content-Type', 'application/json' );
        res.setHeader( 'Set-Cookie', 
            [ 
                `login_token=${loginToken}; ` + 
                    `Max-Age=${jwtExpiresIn}; ` +
                    `Secure=true; ` +
                    `HttpOnly=true; ` + 
                    `SameSite="None"; ` + 
                    `Path=/`,
                `username=${user.username}; ` + 
                    `Max-Age=${jwtExpiresIn}; ` +
                    `Secure=true; ` +
                    `HttpOnly=true; ` + 
                    `SameSite="None"; ` + 
                    `Path=/`
            ]
        )
        res.end( JSON.stringify( { 
            "response" : RESPONSE_CODES.SuccessfulLogIn, 
            'data' : { 'username' : user.username } 
        } ) );
    }
    else
    {
        console.log( "    Password check not successful." );

        res.statusCode = 401;
        res.setHeader( 'Content-Type', 'application/json' );
        res.end( JSON.stringify( { "response" : RESPONSE_CODES.BadSignIn } ) );
        return;
    }
}

async function createNewAccount( res, req, data )
{
    // Start with a blank document so that we only pass exactly what we need
    // to the database. Don't want someone to throw random other data in there.
    let doc = {};
    let result, query, options, update;


    // Validate username exists after removing whitespace.
    if( data.username && data.username.trim() )
    {
        // Store username as lower case for easier checking.
        // We will use a displayname field to store the version that
        // the user wants to provide.
        doc.username = data.username.trim().toLowerCase();
        console.log( `  Username: ${doc.username.toLowerCase()}` );
    }
    else
    {
        console.log( `  Invalid username '${data.username}'.` );

        res.statusCode = 400;
        res.setHeader( 'Content-Type', 'application/json' );
        res.end( JSON.stringify( { "response" : RESPONSE_CODES.InvalidFormData } ) );
        return;
    }


    if( data.first && data.first.trim() )
    {
        doc.first = data.first.trim();
    }
    else
    {
        console.log( `  Invalid first name '${data.first}'.` );

        res.statusCode = 400;
        res.setHeader( 'Content-Type', 'application/json' );
        res.end( JSON.stringify( { "response" : RESPONSE_CODES.InvalidFormData } ) );
        return;
    }


    if( data.last && data.last.trim() )
    {
        doc.last = data.last.trim();
    }
    else
    {
        // Last name not required.
        doc.last = "";
    }


    if( data.email && data.email.trim() )
    {
        doc.email = data.email.trim().toLowerCase();
    }
    else
    {
        console.log( `  Invalid email '${data.email}'.` );

        res.statusCode = 400;
        res.setHeader( 'Content-Type', 'application/json' );
        res.end( JSON.stringify( { "response" : RESPONSE_CODES.InvalidFormData } ) );
        return;
    }

    doc.roles = [];


    console.log( `  Creating account for ${doc.first} ${doc.last}:` );
    console.log( `    Username: ${doc.username}` );
    console.log( `    Name: ${doc.first} ${doc.last}` );
    console.log( `    Email: ${doc.email}` );


    bcrypt.hash( data.pass, saltRounds, async (err, hash) => {
        if( err )
        {
            console.log( "  Error hashing password." );
            console.log( `    ${err}` );

            res.statusCode = 500;
            res.end();
            return;
        }

        doc.hash = hash;

        result = await dbLib.createNewItem( DB_NAMES.dbName, DB_NAMES.usersCollectionName, doc );
        if( result.keyPattern && (result.keyPattern.email || result.keyPattern.username || result.keyPattern.displayName) )
        {
            let exists = {
                email: result.keyPattern.email ? 1 : 0,
                username: result.keyPattern.username ? 1 : 0,
                displayName: result.keyPattern.displayName ? 1 : 0,
            }
            util.resolveAction( res, 400, { response: RESPONSE_CODES.ItemExists, exists: exists } );
            return;
        }
        else if( !result.acknowledged )
        {
            console.log( `  Unknown account creation error.` );
            util.resolveAction( res, 502, { response: RESPONSE_CODES.DatabaseError } );
            return;
        }


        // Create a login token (cookie) to be stored on user's system and
        // server for authentication.
        loginToken = await createLoginToken( doc.username, req.headers[ "x-forwarded-for" ] );
        if( !loginToken )
        {
            console.log( `  Unknown login token creation error.` );
            util.resolveAction( res, 502, { response: RESPONSE_CODES.DatabaseError } );
            return;
        }


        res.statusCode = 200;
        res.setHeader( 'Content-Type', 'application/json' );
        res.setHeader( 'Set-Cookie', 
            [ 
                `login_token=${loginToken}; ` + 
                    `Max-Age=${jwtExpiresIn}; ` +
                    `Secure=true; ` +
                    `HttpOnly=true; ` + 
                    `SameSite="None"; ` + 
                    `Path=/`,
                `username=${doc.username}; ` + 
                    `Max-Age=${jwtExpiresIn}; ` +
                    `Secure=true; ` +
                    `HttpOnly=true; ` + 
                    `SameSite="None"; ` + 
                    `Path=/`
            ]
        )
        res.end( JSON.stringify( { "response" : RESPONSE_CODES.AccountCreated } ) );

        return;
    });

    return;
}

