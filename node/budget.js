const fs = require( "fs" );
const dbLib = require( "./db.js" );
const util = require( "./util.js" );
const transactionsLib = require( "./transactions.js" )
const RESPONSE_CODES = require( './response_codes.js' ).RESPONSE_CODES;


var DB_NAMES;
try{ DB_NAMES = JSON.parse( fs.readFileSync( "db_names.json" ) ); }
catch( e ) { console.error( `Unable to read from DB names config file.\n${e}` ); }


const ACTION_HANDLERS = {
    new: createNewBudgetTemplate,
    get: getBudget,
    getNames: getBudgetNames,
    // editRecurrence: 
};


const VALID_RECURRENCE = [ "monthly" ];


// Validation function must take:
//      value
//      respond (bool)
//      res (HTTP response object)
// If key.benefit = true, excess counts towards employer contribution.
// Excess is calculated as the difference between the gross earnings and the sum
// of the taxes (negative) and the benefits (positive).
const BUDGET_TEMPLATE_KEYS =[
    {
        key:                "budgetName",
        required:           true,
        type:               "string",
        validationFunc:     util.validateNonEmptyString,
        validationRespond:  true,
        parseFunc:          util.parseStringTrim,
    },
    {
        key:                "recurrence",
        required:           true,
        type:               "string",
        validationFunc:     validateRecurrence,
        validationRespond:  true,
        parseFunc:          util.parseStringTrim,
    },
    {
        key:                "lineItems",
        required:           true,
        type:               "array",
        validationFunc:     validateLineItems,
        validationRespond:  true,
        parseFunc:          parseLineItems,
    }
];


/**
 * Budgets are created as templates containing:
 *  Name
 *  Recurrence period
 *  Start of period
 *  End of period
 *  List of tags:amounts for budget categories
 * 
 * A user requests a budget with a specific date. The API will find the period
 * in which the date exists and return the budget line items and all 
 * relevant transactions (those with a tag matching a budget line) for that 
 * period. If a budget instances is not found for that period, a new instance
 * is created. This instancing allows the user to adjust the line items for each
 * period while having a template to automatically create budgets for.
**/
module.exports = {
    ACTION_HANDLERS: ACTION_HANDLERS,
};


async function createNewBudgetTemplate( res, req, data )
{
    if( req.method !== "POST" )
    {
        util.resolveAction( res, 405, { response: RESPONSE_CODES.BadMethodPOST } );
        return;
    }


    // Verify user
    let user = await util.checkLoggedIn( res, req );
    if( user === 1 ) return;

    console.log( `Creating new budget template.` );


    // Start with a blank document so that we only pass exactly what we need
    // to the database. Don't want someone to throw random other data in there.
    let doc = {
        username: user.username
    };
    let result, query, options, update;


    for( let i = 0; i < BUDGET_TEMPLATE_KEYS.length; i++ )
    {
        let k = BUDGET_TEMPLATE_KEYS[ i ];
        if( k.validationFunc( data[ k.key ], k.validationRespond, res ) )
        {
            doc[ k.key ] = k.parseFunc( data[ k.key ] );
        }
        else
        {
            console.log( `  Budget template key ${k.key} failed parsing for input ${k.key}: '${data[ k.key ]}'.` );
            if( k.validationRespond == false )
                util.resolveAction( res, 400, { "response" : RESPONSE_CODES.InvalidFormData } );
            return;
        }
    }


    console.log( `  Inserting new budget template for ${doc.username}:\n` +
                 `    Budget Name: ${doc.budgetName}\n` +
                 `    Recurrence:  ${doc.recurrence}\n` +
                 `    Line Items: ` );
    doc.lineItems.forEach( (lineItem) => {
        console.log( `    ${lineItem.tag}:         ${lineItem.amount}` );
    } );


    // TODO: Insert document into budget templates collection.
    result = await dbLib.createNewItem( DB_NAMES.dbName, DB_NAMES.budgetTemplatesCollectionName, doc );
    if( result.keyPattern )
    {
        console.log( `  Budget already exists!` );
        util.resolveAction( res, 400, { response: RESPONSE_CODES.ItemExists, exists: result.keyPattern } );
        return;
    }
    else if( !result.acknowledged )
    {
        console.log( `  Unknown budget template creation error. Could be a database error!` );
        util.resolveAction( res, 502, { response: RESPONSE_CODES.DatabaseError } );
        return;
    }


    util.resolveAction( res, 200, { "response" : RESPONSE_CODES.OK } );
    return;
}


async function getBudget( res, req, data )
{
    // Must be POST because we need to receive data.
    if( req.method !== "POST" )
    {
        util.resolveAction( res, 405, { response: RESPONSE_CODES.BadMethodPOST } );
        return;
    }


    // Verify user
    let user = await util.checkLoggedIn( res, req );
    if( user === 1 ) return;

    console.log( `  Getting budget instance for ${user.username}.` );

    let doc = { username: user.username };

    // Validate budgetName and date exist in request data.
    if( util.validateNonEmptyString( data.budgetName, true, res ) ) doc.budgetName = data.budgetName;
    else
    {
        console.log( `  Invalid budget name '${data.budgetName}'.` );
        return;
    }

    let date = undefined;
    if( util.validateDateString( data.date, true, res ) )
    {
        date = new Date( data.date.trim() );
        date = new Date( Date.UTC( date.getFullYear(), date.getMonth(), date.getDate() ) );
    }
    else
    {
        console.log( `  Invalid date '${data.date}'.` );
        return;
    }


    // Search for existing budget instance.
    let query = {
        username: doc.username,
        budgetName: doc.budgetName,
        startDate: { "$lte" : date },
        endDate: { "$gte" : date }
    };
    let options = {};

    let result = await dbLib.getItem( DB_NAMES.dbName, DB_NAMES.budgetsCollectionName, query, options );

    // console.log( `  Budget containing ${date.toUTCString()}:\n` + 
    //     `${JSON.stringify( result, null, 2 )}` );

    if( result )
    {
        let startDate;
        let endDate;
        if( result.recurrence == "monthly" )
        {
            startDate = new Date( Date.UTC( date.getFullYear(), date.getMonth(), 1 ) );     // First day of month
            endDate   = new Date( Date.UTC( date.getFullYear(), date.getMonth() + 1, 0 ) ); // Last day of month
        }
        else if( result.recurrence == "yearly" )
        {
            startDate = new Date( Date.UTC( date.getFullYear(), 0, 1 ) );
            endDate   = new Date( Date.UTC( date.getFullYear(), 12, 0 ) );
        }

        let budget = result;

        // Get all transactions within this range.
        let transactions = await transactionsLib.getTransactionsWithinDateRange( doc.username, startDate, endDate );

        // Filter out transactions that are not from outside or to outside.
        // This way internal transfers do not count towards the budget

        util.resolveAction( res, 200, { response: RESPONSE_CODES.OK, budget: budget, transactions: transactions } );
        return;
    }

    // No budget instance found, create a new instance.
    // Get the budget template
    query = {
        username: doc.username,
        budgetName: doc.budgetName,
    }
    options = {
        projection: { "_id": 0, "lineItems": 1, "recurrence": 1 },
    }
    result = await dbLib.getItem( DB_NAMES.dbName, DB_NAMES.budgetTemplatesCollectionName, query, options );

    if( !result )
    {
        console.log( `  Budget name '${doc.budgetName}' does not exist.` );
        util.resolveAction( res, 400, { reponse: RESPONSE_CODES.BudgetDoesNotExist } );
        return;
    }


    // Create new budget instance.
    let startDate;
    let endDate;
    if( result.recurrence == "monthly" )
    {
        startDate = new Date( Date.UTC( date.getFullYear(), date.getMonth(), 1 ) );     // First day of month
        endDate   = new Date( Date.UTC( date.getFullYear(), date.getMonth() + 1, 0 ) ); // Last day of month
    }
    else if( result.recurrence == "yearly" )
    {
        startDate = new Date( Date.UTC( date.getFullYear(), 0, 1 ) );
        endDate   = new Date( Date.UTC( date.getFullYear(), 12, 0 ) );
    }

    let newBudgetInstance = {
        username: doc.username,
        budgetName: doc.budgetName,
        recurrence: result.recurrence,
        startDate: startDate,
        endDate: endDate,
        lineItems: result.lineItems,
    }

    console.log( `  Creating new budget instance:\n${JSON.stringify( newBudgetInstance, null, 2 )}` );

    result = await dbLib.createNewItem( DB_NAMES.dbName, DB_NAMES.budgetsCollectionName, newBudgetInstance );
    if( result.keyPattern )
    {
        console.log( `  Budget instance exists, but it shouldn't! This is a server issue!` );
        console.log( JSON.stringify( result, null, 2 ) );
        util.resolveAction( res, 502, { repsonse: RESPONSE_CODES.DatabaseError } );
        return;
    }
    else if( !result.acknowledged )
    {
        console.log( `  Unknown budget instance creation error. Could be a database error!` );
        console.log( JSON.stringify( result, null, 2 ) );
        util.resolveAction( res, 502, { repsonse: RESPONSE_CODES.DatabaseError } );
        return;
    }


    // Get all relevant transactions.
    let transactions = await transactionsLib.getTransactionsWithinDateRange( doc.username, startDate, endDate );
    util.resolveAction( res, 200, { response: RESPONSE_CODES.OK, budget: newBudgetInstance, transactions: transactions } );
    return;
}


async function getBudgetNames( res, req )
{
    if( req.method !== "GET" )
    {
        util.resolveAction( res, 405, { response: RESPONSE_CODES.BadMethodGET } );
        return;
    }


    // Verify user
    let user = await util.checkLoggedIn( res, req );
    if( user === 1 ) return;

    console.log( `  Getting budget names for ${user.username}.` );

    let query = { username: user.username };
    let options = {
        projection: { "_id": 0, "budgetName": 1 },
    };
    let result = await dbLib.getItems( DB_NAMES.dbName, DB_NAMES.budgetTemplatesCollectionName, query, options );

    if( !result )
    {
        util.resolveAction( res, 502, { response: RESPONSE_CODES.DatabaseError } );
        return;
    }

    let budgetNames = [];
    result.forEach( (budget) => {
        budgetNames.push( budget.budgetName );
    } );

    result = {
        budgetNames: budgetNames
    }

    util.resolveAction( res, 200, result );
    return;
}


function validateRecurrence( recurrence, respond, res )
{
    if( VALID_RECURRENCE.includes( recurrence.trim() ) ) return true;

    if( respond )
    {
        util.resolveAction( res, 400, { "response" : RESPONSE_CODES.InvalidFormData } );
    }

    return false;
}


function validateLineItems( lineItems, respond, res )
{
    let success = true;
    for( let i = 0; i < lineItems.length; i++ )
    {
        let item = lineItems[ i ];
        if( !util.validateNonEmptyString( item.tag ) || !util.validateNonNegativeFloat( item.amount ) )
        {
            console.log( `      Invalid line item: (${item.tag}, ${item.amount}).` );
            success = false;
            break;
        }
    }

    if( success ) return true;

    if( respond )
    {
        util.resolveAction( res, 400, { "response" : RESPONSE_CODES.InvalidFormData } );
    }

    return false;
}


function parseLineItems( inLineItems )
{
    let outLineItems = [];
    inLineItems.forEach( (lineItem) => {
        outLineItems.push({
            tag: lineItem.tag.trim(),
            amount: util.parseStringFloat( lineItem.amount ),
        });
    } );

    return outLineItems;
}
