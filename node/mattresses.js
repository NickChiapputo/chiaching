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
    edit: edit,
    transfer: transfer,
    delete: deleteMattress,
};

module.exports = {
    ACTION_HANDLERS: ACTION_HANDLERS,
    incrementMattressAmount: incrementAmount,
    getMattress: getMattressByName,
};

const INVALID_MATTRESS_NAMES = [
    "unallocated",
];

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
    if( !util.validateNonEmptyString( data.name, true, res ) &&
        !INVALID_MATTRESS_NAMES.includes( data.name.trim().toLowerCase() ) )
    {
        return;
    }
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

    options = {};


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

/**
 * Increment the amount in `username`'s mattress `mattressName` by `amount`.
 * @param {*} username      User who owns 'mattressName'.
 * @param {*} mattressName  Mattress to update.
 * @param {*} amount        Amount to update mattress's `amount` field by.
 * @returns MongoDB update item result (containing original item) on success
 *          or null on failure.
 */
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

/**
 * Edit an existing mattress for the signed-in user.
 * Must be a POST request and the body data must include at least `_id` and one
 * or more of:
 * - name
 * - maxAmount
 *
 * @param {Object} res   HTTP response object
 * @param {Object} req   HTTP request object
 * @param {Object} data  Request body data
 */
async function edit( res, req, data ) {
    if( req.method !== "POST" )
    {
        util.resolveAction( res, 405, { response: RESPONSE_CODES.BadMethodPOST } );
        return;
    }

    // Verify user
    let user = await util.checkLoggedIn( res, req );
    if( user === 1 ) return;

    // Verify the original mattress exists.
    if( !util.validateNonEmptyString( data._id, true, res ) ) return;
    let query = {
        "_id": dbLib.createObjectID( data._id ),
        "username": user.username
    };
    let original_mattress = await dbLib.getItem(
        DB_NAMES.dbName, DB_NAMES.mattressesCollectionName,
        query, {}
    );

    if( !original_mattress ) {
        util.resolveAction( res, 400, { response: RESPONSE_CODES.InvalidFormData } );
        return;
    }

    // Validate fields if they exist.
    let fields_to_update = {};
    if( util.validateNonEmptyString( data.name, false ) )
        fields_to_update.name = data.name.trim();
    if( util.validateNonNegativeFloat( data.maxAmount, false ) )
        fields_to_update.maxAmount = util.parseStringFloat( data.maxAmount );

    // Update the mattress.
    let update = { "$set": fields_to_update };
    let result = await dbLib.updateItem( DB_NAMES.dbName,
        DB_NAMES.mattressesCollectionName, query, update, {} );

    if( !result || result.lastErrorObject.n == 0 )
    {
        console.log( `  Update mattress failed with: ${JSON.stringify( result, null, 2 )}` );
        util.resolveAction( res, 502, { "response" : RESPONSE_CODES.DatabaseError } );
        return;
    }

    util.resolveAction( res, 200, { "response" : RESPONSE_CODES.OK } );
    return;
}

/**
 * API endpoint for `transferAmount`. Provide data in POST must include:
 * - `source`       -- Source mattress
 * - `destination`  -- Destination mattress
 * - `amount`       -- Amount to subtract from source and add to destination.
 *
 * @param {Object} res   HTTP response object
 * @param {Object} req   HTTP request object
 * @param {Object} data  Request body data
 */
async function transfer( res, req, data ) {
    if( req.method !== "POST" )
    {
        util.resolveAction( res, 405, { response: RESPONSE_CODES.BadMethodPOST } );
        return;
    }

    // Verify user
    let user = await util.checkLoggedIn( res, req );
    if( user === 1 ) return;

    // Verify required data exists
    if( !util.validateNonEmptyString( data.source, true, res ) ) return;
    if( !util.validateNonEmptyString( data.destination, true, res ) ) return;
    if( !util.validateNonNegativeFloat( data.amount, true, res ) ) return;

    let result = await transferAmount(
        user.username,
        data.source,
        data.destination,
        util.parseStringFloat( data.amount )
    );

    if( result ) {
        if( result != 3 ) {
            util.resolveAction( res, 400,
                { response: RESPONSE_CODES.InvalidFormData } );
        } else {
            util.resolveAction( res, 502,
                { response: RESPONSE_CODES.DatabaseError } );
        }
        return;
    }

    util.resolveAction( res, 200, { "response" : RESPONSE_CODES.OK } );
    return;
}


/**
 * Transfer `amount` from `srcMattress` to `dstMattress` owned by `username`.
 * @param {*} username      User who owns the mattresses
 * @param {*} srcMattress   Source mattress `_id`
 * @param {*} dstMattress   Destination mattress `_id`
 * @param {*} amount        Amount to subtract from `srcMattress`
 *                          and add to `dstMattress`.
 * @returns Codes:
 *          - 0: success
 *          - 1: user does not have `srcMattress`
 *          - 2: user does not have `dstMattress`
 *          - 3: Failure updating amounts
 */
async function transferAmount( username, srcMattress, dstMattress, amount )
{
    // Validate mattresses exist.
    source_is_unallocated = srcMattress.trim().toLowerCase() == "unallocated";
    destination_is_unallocated = dstMattress.trim().toLowerCase() == "unallocated";

    let source_query = undefined;
    let source = undefined;
    if( !source_is_unallocated ) {
        source_query = {
            "_id": dbLib.createObjectID( srcMattress ),
            "username": username
        };
        source = await dbLib.getItem(
            DB_NAMES.dbName, DB_NAMES.mattressesCollectionName, source_query, {}
        );
        if( !source ) return 1;
    }

    let destination_query = undefined;
    let destination = undefined;
    if( !destination_is_unallocated ) {
        destination_query = {
            "_id": dbLib.createObjectID( dstMattress ),
            "username": username
        };
        destination = await dbLib.getItem(
            DB_NAMES.dbName, DB_NAMES.mattressesCollectionName,
            destination_query, {}
        );
        if( !destination ) return 2;
    }

    // Update amounts.
    let update = {};
    let result = undefined;
    if( !source_is_unallocated ) {
        update = { "$inc": { "amount": -amount } };
        result = await dbLib.updateItem( DB_NAMES.dbName,
            DB_NAMES.mattressesCollectionName, source_query, update, {} );

        if( !result || result.lastErrorObject.n == 0 ) {
            console.log( `  Decrement source mattress ${source.name} amount failed with: ${JSON.stringify( result, null, 2 )}` );
            return 3;
        }
    }

    if( !destination_is_unallocated ) {
        update = { "$inc": { "amount": amount } };
        result = await dbLib.updateItem( DB_NAMES.dbName,
            DB_NAMES.mattressesCollectionName, destination_query, update, {} );

        if( !result || result.lastErrorObject.n == 0 ) {
            console.log( `  Increment destination mattress ${destination.name} amount failed with: ${JSON.stringify( result, null, 2 )}` );
            return 3;
        }
    }

    return 0;
}

/**
 * API endpoint for `delete`. Provide data in POST must include:
 * - `_id`       -- Source mattress object ID
 *
 * @param {Object} res   HTTP response object
 * @param {Object} req   HTTP request object
 * @param {Object} data  Request body data
 */
async function deleteMattress( res, req, data ) {
    // Verify user
    let user = await util.checkLoggedIn( res, req );
    if( user === 1 ) return;

    // Verify _id is present.
    // TODO: Check if _id is a list of ids to delete for bulk actions.
    if( data._id == undefined || typeof(data._id) != "string" )
    {
        console.log( `_id = ${data._id}` );
        util.resolveAction( res, 400, { response: RESPONSE_CODES.MissingData } );
        return;
    }

    console.log( `Deleting mattress ${data._id} for ${user.username}` );

    // Delete the mattress.
    let result = await dbLib.deleteItem(
        DB_NAMES.dbName, DB_NAMES.mattressesCollectionName,
        { "_id": dbLib.createObjectID( data._id ), "username": user.username }
    );

    if( result.deletedCount != undefined && result.deletedCount == 1 ) {
        util.resolveAction( res, 200, { response: RESPONSE_CODES.OK } );
    }
    else {
        util.resolveAction( res, 400, { response: RESPONSE_CODES.MissingData } );
    }

    return;
}
