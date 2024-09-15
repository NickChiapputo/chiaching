const fs = require( "fs" );
const dbLib = require( "./db.js" );
const util = require( "./util.js" );
const RESPONSE_CODES = require( './response_codes.js' ).RESPONSE_CODES;

var DB_NAMES;
try
{
    DB_NAMES = JSON.parse( fs.readFileSync( "db_names.json" ) );
}
catch( e ) { console.error( `Unable to read from DB names config file.\n${e}` ); }

// Ensure these are all lower case.
const INVALID_ACCOUNT_NAMES = [
    "outside",
];
const INVALID_ISNTITUTION_NAMES = [
    "outside",
];


const VALID_ACCOUNT_TYPES = [
    "Checking", "Savings", "Credit", "Investment", "Loan"
];

const ACTION_HANDLERS = {
    new: createNewAccount,
    get: getAllAccounts,
    // editBalance: updateAccountBalance,
    // edit: updateAccountInformation,
};

module.exports = {
    ACTION_HANDLERS: ACTION_HANDLERS,

    getAccount: getAccount,
    incrementAccountBalance: incrementAccountBalance,
};


async function createNewAccount( res, req, data )
{
    // Verify user
    let user = await util.checkLoggedIn( res, req );
    if( user === 1 ) return;


    // Start with a blank document so that we only pass exactly what we need
    // to the database. Don't want someone to throw random other data in there.
    let doc = {
        username: user.username
    };
    let result, query, options, update;


    // Validate account name exists after removing whitespace.
    if( data.accountName && data.accountName.trim() && !INVALID_ACCOUNT_NAMES.includes( data.accountName.trim().toLowerCase() ) )
    {
        doc.name = data.accountName.trim();
    }
    else
    {
        console.log( `  Invalid account name '${data.accountName}'.` );
        util.resolveAction( res, 400, { "response" : RESPONSE_CODES.InvalidFormData } );
        return;
    }

    // Validate institution exists after removing whitespace.
    // Not a required field.
    if( data.institution && data.institution.trim() && !INVALID_ISNTITUTION_NAMES.includes( data.institution.trim().toLowerCase() ) )
    {
        doc.institution = data.institution.trim();
    }
    else
    {
        console.log( `  Invalid account institution '${data.institution}'.` );
        util.resolveAction( res, 400, { "response" : RESPONSE_CODES.InvalidFormData } );
        return;
    }

    // Validate starting balance exists.
    if( data.startingBalance && data.startingBalance.trim() && !isNaN(parseFloat( data.startingBalance )) )
    {
        doc.balance = parseFloat( data.startingBalance.trim() );
    }
    else
    {
        console.log( `  Invalid account balance '${data.startingBalance}'.` );
        util.resolveAction( res, 400, { "response" : RESPONSE_CODES.InvalidFormData } );
        return;
    }


    // Validate account type is in acceptable list.
    if( data.type && VALID_ACCOUNT_TYPES.includes( data.type ) )
    {
        doc.type = data.type;
    }
    else
    {
        console.log( `  Invalid account type '${data.type}'.` );
        util.resolveAction( res, 400, { "response" : RESPONSE_CODES.InvalidFormData } );
        return;
    }



    console.log( `  Creating new account for ${doc.username}:\n` +
                 `    Account Name:     ${doc.name}\n` +
                 `    Institution:      ${doc.institution}\n` +
                 `    Starting Balance: \$${doc.balance}` );

    result = await dbLib.createNewItem( DB_NAMES.dbName, DB_NAMES.accountsCollectionName, doc );
    if( result.keyPattern )
    {
        console.log( `  Account already exists!` );
        util.resolveAction( res, 400, { repsonse: RESPONSE_CODES.ItemExists, exists: result.keyPattern } );
        return;
    }
    else if( !result.acknowledged )
    {
        console.log( `  Unknown money account creation error. Could be a database error!` );
        util.resolveAction( res, 502, { response: RESPONSE_CODES.DatabaseError } );
        return;
    }


    util.resolveAction( res, 200, { "response" : RESPONSE_CODES.OK } );
    return;
}


async function getAllAccounts( res, req, data )
{
    if( req.method !== "GET" )
    {
        util.resolveAction( res, 405, { response: RESPONSE_CODES.BadMethodGET } );
        return;
    }

    // Verify user
    let user = await util.checkLoggedIn( res, req );
    if( user === 1 ) return;

    let result, query, options;
    query = { username: user.username };
    options = {
        projection: { "_id": 0 },
    };

    result = await dbLib.getAllItems( query, options, DB_NAMES.dbName, DB_NAMES.accountsCollectionName );

    util.resolveAction( res, 200, { accounts: result } );
    return;
}


async function getAccount( username, accountName, institution )
{
    let result, query, options;
    query = {
        username: username,
        name: accountName,
        institution: institution
    };

    options = {

    };


    result = await dbLib.getItem( 
        DB_NAMES.dbName, DB_NAMES.accountsCollectionName, 
        query, options );
    return result;
}


async function incrementAccountBalance( username, accountName, institution, incrementAmount )
{
    let query = {
        username: username,
        name: accountName,
        institution: institution
    };

    let update = { "$inc" : { "balance" : incrementAmount } };
    let options = {};

    let result = await dbLib.updateItem( 
        DB_NAMES.dbName, DB_NAMES.accountsCollectionName, 
        query, update, options );
    return result;
}
