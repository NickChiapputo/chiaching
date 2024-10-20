const fs = require( "fs" );
const dbLib = require( "./db.js" );
const jwt = require( "jsonwebtoken" );
const RESPONSE_CODES = require( './response_codes.js' ).RESPONSE_CODES;


var DB_NAMES;
try
{
    DB_NAMES = JSON.parse( fs.readFileSync( "db_names.json" ) );
}
catch( e ) { console.error( `Unable to read from DB names config file.\n${e}` ); }

module.exports = {
    resolveAction: resolveAction,

    parseCookies: parseCookies,
    validateToken: validateToken,
    checkLoggedIn: checkLoggedIn,

    dateToUTCDate: dateToUTCDate,


    // Form validation and parsing.
    validateNonEmptyString: validateNonEmptyString,
    validateDateString: validateDateString,
    validateNonNegativeFloat: validateNonNegativeFloat,

    parseStringFloat: (str) => { return parseFloat( str.trim() ); },
    parseStringTrim: (str) => { return str.trim(); },

    isFloat: function( n ) { return Number(n) === n && n % 1 !== 0; }
};

function parseCookies(request) {
    const list = {};
    const cookieHeader = request.headers?.cookie;
    if (!cookieHeader) return list;

    cookieHeader.split(`;`).forEach(function(cookie) {
        let [ name, ...rest] = cookie.split(`=`);
        name = name?.trim();
        if (!name) return;
        const value = rest.join(`=`).trim();
        if (!value) return;
        list[name] = decodeURIComponent(value);
    });

    return list;
}


function resolveAction( res, statusCode, response )
{
    res.writeHead( statusCode, { "Content-Type" : "application/json" } );
    res.end( JSON.stringify( response ) );
    return;
}


function dateToUTCDate( date )
{
    return new Date(
        Date.UTC(
            date.getUTCFullYear(),
            date.getUTCMonth(),
            date.getUTCDate(),
        )
    );
}


/**
 * @brief Validate the str is non-empty. If response is true, send a response
 * if str is empty using res.
 *
 * @param str                   String to validate
 * @param response (optional)   Flag set to true if response is required for
 *                              invalid string.
 * @param res (optional)        Response object used if response is true.
 *
 * @return True if valid, false otherwise.
**/
function validateNonEmptyString( str, respond, res )
{
    if( str && str.trim() )
        return true;

    if( respond )
    {
        resolveAction( res, 400, { "response" : RESPONSE_CODES.InvalidFormData } );
    }

    return false;
}


/**
 * Validate the str is non-empty. Input format for valid date string is
 * expected to match yyyy-mm-dd. If response is true, send a response
 * if str is empty using res.
 *
 * @param str                   String to validate
 * @param response (optional)   Flag set to true if response is required for
 *                              invalid string.
 * @param res (optional)        Response object used if response is true.
 *
 * @return True if valid, false otherwise.
**/
function validateDateString( str, respond, res )
{
    let split = str.split('-');
    if( split.length == 3 )
    {
        let d = new Date( str );
        let strYear = parseInt( split[0] );
        let strMonth = parseInt( split[1] ) - 1;
        let strDay = parseInt( split[2] );

        // Check with UTC dates because we won't get timezone information from
        // the transaction (and we don't want to, that'll annoy users).
        // UTC dates will ensure that the value return from getUTC<val> will
        // match if the date string is properly formatted.
        if( d.getUTCFullYear() === strYear && d.getUTCMonth() === strMonth && d.getUTCDate() )
            return true;
    }

    if( respond )
    {
        resolveAction( res, 400, { "response" : RESPONSE_CODES.InvalidFormData } );
    }

    return false;
}


/**
 * Validate the string number is a float that is non-negative (>= 0) and
 * has at most 2 decimal places.
 *
 * @param str                   String to validate
 * @param response (optional)   Flag set to true if response is required for
 *                              invalid string.
 * @param res (optional)        Response object used if response is true.
 *
 * @return True if valid, false otherwise.
**/
function validateNonNegativeFloat( str, respond, res )
{
    let isValid = str &&
        str.trim() &&
        /^\d+(?:\.{0,1}\d{0,2})$/.test( str ) &&
        !isNaN( +str ) &&
        parseFloat( str ) >= 0;
    if( isValid )
    {
        return true;
    }

    if( respond )
    {
        resolveAction( res, 400, { "response" : RESPONSE_CODES.InvalidFormData } );
    }

    return false;
}


/****
    * @brief Check that a user is logged in. Respond with a 401 if they are not.
    *
    * @param req    Client request object.
    *
    * @return       1 if not logged in and a response was sent.
    *               If user is logged in, return user document.
****/
async function checkLoggedIn( res, req )
{
    let result = await validateToken( req );
    if( result.result != 0 )
    {
        if( result.result == 1 )
        {
            console.log( "  Failed due to database error." );
            resolveAction( res, 502, { "response" : RESPONSE_CODES.DatabaseError } );
        }
        else
        {
            console.log( "  User is not authenticated." );
            resolveAction( res, 401, { "response" : RESPONSE_CODES.InvalidToken } );
        }

        return 1;
    }

    return result.user;
}


/****
    *   @brief Validate a login token given a username. Assume login_token and username
    *   cookies exist in client request header.
    *
    *   @param req          Client request object.
    *
    *   @return             JSON object with keys result and user.
    *                       Result is a status code and user is the JSON object
    *                       for the user from the database.
    *
    *                       Status code of result.
    *                       0 - success
    *                       1 - error accessing database
    *                       2 - no matching username found
    *                       3 - blocked attempted sign-in not matching username
    *                       4 - no matching token found
    *                       5 - no cookie found (username or login_token)
****/
async function validateToken( req ) {
    let result = {}

    // Get the cookies sent from the client.
    let veganCookies = parseCookies( req );
    if( !veganCookies.username || !veganCookies.login_token )
    {
        // no cookie found
        result.result = 5;
        return result;
    }


    // Search for the username specified in the cookies.
    let query = { "username" : veganCookies.username };
    let options = {};

    // Search for the user in the database.
    let users = await dbLib.getItems( DB_NAMES.dbName, DB_NAMES.usersCollectionName, query, options );
    if( !users )
    {
        // error accessing database
        result.result = 1;
        return result;
    }


    if( users.length == 0 )
    {
        // no matching username found
        result.result = 2;
        return result;
    }

    result.user = users[ 0 ];


    // User exists, search for tokens.
    let tokens = await dbLib.getItems( DB_NAMES.dbName, DB_NAMES.loginTokensCollectionName, query, options );


    // Iterate through the user's tokens (if any).
    if( tokens && tokens.length )
    {
        // Iterate through each of the tokens for the user.
        const currDate = new Date();
        for( let i = 0; i < tokens.length; i++ )
        {
            // We don't need to check the date here because MongoDB is set up
            // to take care of that with a TTL index on the login tokens
            // collection.

            // Attempt to verify the user's provided login token with the
            // current one from the database.
            try
            {
                let decoded = jwt.verify( veganCookies.login_token, tokens[ i ].secret );

                if( decoded.username == veganCookies.username )
                {
                    // success
                    result.result = 0;
                    return result;
                }
                else
                {
                    // blocked attempted sign-in not matching username
                    result.result = 3;
                    return result;
                }
            }
            catch( e )
            {
                // An error will be thrown if verify fails.
                // Don't need to do anything, this just tells us that the
                // token does not match.
            }
        }


        // no matching token found
        result.result = 4;
        return result;
    }

    // no cookie found
    result.result = 5;
    return result;
}
