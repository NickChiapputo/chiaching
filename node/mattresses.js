const fs = require( "fs" );
const dbLib = require( "./db.js" );
const util = require( "./util.js" );
const resolveAction = require( "./util.js" ).resolveAction;
const RESPONSE_CODES = require( './response_codes.js' ).RESPONSE_CODES;

var DB_NAMES;
try
{
    DB_NAMES = JSON.parse( fs.readFileSync( "db_names.json" ) );
}
catch( e ) { console.error( `Unable to read from DB names config file.\n${e}` ); }

const ACTION_HANDLERS = {
    get: getMattress,
    getNames: getMattressNames,
    create: createMattress,
    // setAmount: setAmount,
    // setMaxAmount: setMaxAmount,
};

module.exports = {
    ACTION_HANDLERS: ACTION_HANDLERS,
    incrementMattressAmount: incrementAmount,
    getMattress: getMattressByName,
};

/**
 * Create a new mattress for the signed-in user.
 * Must be a POST request and the body data must include the following 
 * mattress information:
 * - name
 * - maximum amount
 * - initial amount
 * 
 * @param {Object} res   HTTP response object
 * @param {Object} req   HTTP request object
 * @param {Object} data  Request body data
 */
async function createMattress( res, req, data )
{
    if( req.method !== "POST" )
    {
        util.resolveAction( res, 405, { response: RESPONSE_CODES.BadMethodPOST } );
        return;
    }

    // Verify user
    let user = await util.checkLoggedIn( res, req );
    if( user === 1 ) return;

    // Verify request data
    if( !util.validateNonEmptyString( data.name, true, res ) )          return;
    if( !util.validateNonNegativeFloat( data.maxAmount, true, res ) )   return;
    if( !util.validateNonNegativeFloat( data.amount, true, res ) )      return;
    
    // Create a new mattress and add it to the database.
    let newMattress = {
        username: user.username,
        name: util.parseStringTrim( data.name ),
        maxAmount: util.parseStringFloat( data.maxAmount ),
        amount: util.parseStringFloat( data.amount )
    };

    console.log( 
        `  Creating new mattress for ${newMattress.username}:\n` +
        `    Name:           ${newMattress.name}\n` +
        `    Maximum:        ${newMattress.maxAmount}\n` +
        `    Initial Amount: ${newMattress.amount}`
    );
    let result = await dbLib.createNewItem(
        DB_NAMES.dbName, DB_NAMES.mattressesCollectionName,
        newMattress
    );

    if( result.keyPattern )
    {
        // There is a mattress already in the collection
        // that has the same unique key. Check the indexes
        // for what the key is.
        console.log( `  Mattress already exists.` );
        util.resolveAction( 
            res, 400, { 
                response: RESPONSE_CODES.ItemExists, 
                exists: result.keyPattern 
            } 
        );
        return;
    }
    else if( !result.acknowledged )
    {
        // There was no response from MongoDB when
        // trying to insert the document. 
        console.log( `  Unknown money account creation error. Could be a database error!` );
        util.resolveAction(
            res, 502, { 
                response: RESPONSE_CODES.DatabaseError 
            } 
        );
        return;
    }

    util.resolveAction( 
        res, 200, 
        { "response" : RESPONSE_CODES.OK } 
    );
    return;
}

/**
 * Respond to an API request to retrieve a user's named mattress. Data
 * must contain a field `name` with the case-insensitive mattress name.
 * @param {Object} res   HTTP response object
 * @param {Object} req   HTTP request object
 * @param {Object} data  Request body data
 */
async function getMattress( res, req, data )
{
    if( req.method !== "POST" )
    {
        util.resolveAction( res, 405, { response: RESPONSE_CODES.BadMethodPOST } );
        return;
    }

    // Verify user
    let user = await util.checkLoggedIn( res, req );
    if( user === 1 ) return;

    // Verify request data
    if( !data )
    {
        util.resolveAction( res, 400, { response: RESPONSE_CODES.MissingData } );
        return;
    }

    if( !util.validateNonEmptyString( data.name ) )
    {
        util.resolveAction( res, 400, { response: RESPONSE_CODES.MissingData } );
        return;
    }

    let result = await getMattressByName( 
        user.username, util.parseStringTrim( data.name ) 
    );
    
    if( !result )
        util.resolveAction( res, 500, { "response": RESPONSE_CODES.DatabaseError } );
    else
        util.resolveAction( res, 200, { 
            response: RESPONSE_CODES.OK, 
            mattress: result 
        } );
    return;
}

/**
 * Check database for mattress specified by
 * owning user and the name of the mattress.
 * @param {String} username 
 * @param {String} name 
 * @returns Mattress object from database.
 */
async function getMattressByName( username, name )
{
    let result, query, options;
    query = {
        username: username,
        name: name,
    };

    options = {
        projection: {
            "_id": 0
        }
    };


    result = await dbLib.getItem( 
        DB_NAMES.dbName, DB_NAMES.mattressesCollectionName, 
        query, options 
    );

    return result;
}

/**
 * Respond to an API request to retrieve the names of all of a user's named
 * mattresses. No data is required but the user must be logged in. The response
 * will contain a `names` field with a list of the string mattress names.
 * @param {Object} res   HTTP response object
 * @param {Object} req   HTTP request object
 */
async function getMattressNames( res, req )
{
    if( req.method !== "GET" )
    {
        util.resolveAction( res, 405, { response: RESPONSE_CODES.BadMethodGET } );
        return;
    }


    // Verify user
    let user = await util.checkLoggedIn( res, req );
    if( user === 1 ) return;

    console.log( `  Getting mattress names for ${user.username}.` );

    let query = { username: user.username };
    let options = {
        projection: { "_id": 0, "name": 1 },
    };
    let result = await dbLib.getItems( 
        DB_NAMES.dbName, DB_NAMES.mattressesCollectionName, 
        query, options 
    );

    if( !result )
    {
        util.resolveAction( res, 502, { response: RESPONSE_CODES.DatabaseError } );
        return;
    }

    let names = [];
    result.forEach( (mattress) => {
        names.push( mattress.name );
    } );

    result = {
        names: names
    }

    util.resolveAction( res, 200, result );
    return;
}

async function incrementAmount( username, mattressName, amount )
{
    let query = {
        username: username,
        name: mattressName,
    };

    let update = { "$inc" : { "amount" : amount } };
    let options = {};

    console.log( `  Incrementing ${username}'s mattress ${mattressName} by ${amount}.` );
    let result = await dbLib.updateItem( 
        DB_NAMES.dbName, DB_NAMES.mattressesCollectionName, 
        query, update, options );
    console.log( `    Result: ${JSON.stringify(result)}` );
        
    if( !result || result.lastErrorObject.n == 0 )
        return null;
    else
        return result;
}
