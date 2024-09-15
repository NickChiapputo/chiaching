const fs = require( "fs" );
const dbLib = require( "./db.js" );
const util = require( "./util.js" );
const accounts = require( "./accounts.js" );
const RESPONSE_CODES = require( './response_codes.js' ).RESPONSE_CODES;

var DB_NAMES;
try
{
    DB_NAMES = JSON.parse( fs.readFileSync( "db_names.json" ) );
}
catch( e ) { console.error( `Unable to read from DB names config file.\n${e}` ); }

const ACTION_HANDLERS = {
    new: createNewTransaction,
    get: getAllTransactions,
    getWithinDate: getTransactions,
    delete: deleteTransaction,
    getTags: getTags,
    getLocations: getLocations,
};


// Validation function must take:
//      value
//      respond (bool)
//      res (HTTP response object)
// If key.benefit = true, excess counts towards employer contribution.
// Excess is calculated as the difference between the gross earnings and the sum
// of the taxes (negative) and the benefits (positive).
const PAYCHECK_KEYS = [ 
    // Earnings
    { 
        key: "earnings",      
        required: true, 
        type: "float", 
        validationFunc: util.validateNonNegativeFloat, 
        validationRespond: true, 
        parseFunc: util.parseStringFloat,
        benefit: false,
        tax: false,
    },

    // Taxes
    { 
        key: "stateTaxes",    
        required: false, 
        type: "float", 
        validationFunc: util.validateNonNegativeFloat, 
        validationRespond: true, 
        parseFunc: util.parseStringFloat,
        benefit: false,
        tax: true,
    }, 
    { 
        key: "federalTaxes",  
        required: false, 
        type: "float", 
        validationFunc: util.validateNonNegativeFloat, 
        validationRespond: true, 
        parseFunc: util.parseStringFloat,
        benefit: false,
        tax: true,
    }, 

    // Benefits
    { 
        key: "healthcare",    
        required: false, 
        type: "float", 
        validationFunc: util.validateNonNegativeFloat, 
        validationRespond: true, 
        parseFunc: util.parseStringFloat,
        benefit: true,
        tax: false,
    }, 
    { 
        key: "vision",        
        required: false, 
        type: "float", 
        validationFunc: util.validateNonNegativeFloat, 
        validationRespond: true, 
        parseFunc: util.parseStringFloat,
        benefit: true,
        tax: false,
    }, 
    { 
        key: "dental",        
        required: false, 
        type: "float", 
        validationFunc: util.validateNonNegativeFloat, 
        validationRespond: true, 
        parseFunc: util.parseStringFloat,
        benefit: true,
        tax: false,
    }, 
    { 
        key: "401k",          
        required: false, 
        type: "float", 
        validationFunc: util.validateNonNegativeFloat, 
        validationRespond: true, 
        parseFunc: util.parseStringFloat,
        benefit: true,
        tax: false,
    }, 
    { 
        key: "hsa",           
        required: false, 
        type: "float", 
        validationFunc: util.validateNonNegativeFloat, 
        validationRespond: true, 
        parseFunc: util.parseStringFloat,
        benefit: true,
        tax: false,
    }, 
    { 
        key: "rothIRA",       
        required: false, 
        type: "float", 
        validationFunc: util.validateNonNegativeFloat, 
        validationRespond: true, 
        parseFunc: util.parseStringFloat,
        benefit: true,
        tax: false,
    } 
];


module.exports = {
    ACTION_HANDLERS: ACTION_HANDLERS,
    getTransactionsWithinDateRange: getTransactionsWithinDateRange,
};


async function getTransactionsWithinDateRange( username, startDate, endDate )
{
    let query = {
        username: username,
        date: { $gte : startDate, $lte: endDate }
    };

    let options = {};

    let result = await dbLib.getItems( DB_NAMES.dbName, DB_NAMES.transactionsCollectionName, query, options );
    return result;
}


async function getDistinctValues( res, req, key )
{
    // Verify user
    let user = await util.checkLoggedIn( res, req );
    if( user === 1 ) return;

    let query = { username: user.username };
    let options = {};
    let result = await dbLib.getDistinctValuesForField( 
        DB_NAMES.dbName, DB_NAMES.transactionsCollectionName,
        key, query, options   
    );
    
    if( result )
        util.resolveAction( res, 200, { response: RESPONSE_CODES.OK, result: result } );
    else 
        util.resolveAction( res, 502, { response: RESPONSE_CODES.DatabaseError } );
}


async function getTags( res, req )
{
    getDistinctValues( res, req, "tag" );
}


async function getLocations( res, req )
{
    getDistinctValues( res, req, "location" );
}


async function getTransactions( res, req, data )
{
    // Verify user
    let user = await util.checkLoggedIn( res, req );
    if( user === 1 ) return;

    // If POST, user must provide startDate and (optional) endDate.
    // Otherwise, assume GET and get all transactions.
    if( req.method == "POST" )
    {
        if( data.startDate == undefined || data.endDate === undefined )
        {
            util.resolveAction( res, 400, { response: RESPONSE_CODES.MissingData } );
            return;
        }

        if( !util.validateDateString( data.startDate, false ) ||
            !util.validateDateString( data.endDate, false ) )
        {
            console.log( `  Invalid start date '${data.startDate}' or end date '${data.endDate}'.` );
            return;
        }
        
        let startDate = util.dateToUTCDate( new Date( data.startDate.trim() ) );
        let endDate = util.dateToUTCDate( new Date( data.endDate.trim() ) );

        // TODO: Parse startDate and endDate for validity first.
        let result = await getTransactionsWithinDateRange( user.username, startDate, endDate );
        util.resolveAction( res, 200, { response: RESPONSE_CODES.OK, transactions: result } );
        return;
    }

    getAllTransactions( res, req, data );
    return;
}


async function getAllTransactions( res, req, data )
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
        // projection: { "_id": 0, "transactions": 1 },
    };

    result = await dbLib.getItems( DB_NAMES.dbName, DB_NAMES.transactionsCollectionName, query, options );
    if( !result )
    {
        util.resolveAction( res, 502, { response: RESPONSE_CODES.DatabaseError } );
        return;
    }

    util.resolveAction( res, 200, { response: RESPONSE_CODES.OK, transactions: result } );
    return;
}


async function createNewTransaction( res, req, data )
{
    if( req.method !== "POST" )
    {
        util.resolveAction( res, 405, { response: RESPONSE_CODES.BadMethodPOST } );
        return;
    }

    // Verify user
    let user = await util.checkLoggedIn( res, req );
    if( user === 1 ) return;



    // Start with a blank document so that we only pass exactly what we need
    // to the database. Don't want someone to throw random other data in there.
    let doc = {
        username: user.username
    };
    let result, query, options, update;
    let srcAccountIsOutside = false;
    let destAccountIsOutside = false;


    // Validate source account name exists after removing whitespace.
    if( util.validateNonEmptyString( data.location, true, res ) ) doc.location = data.location.trim();
    else
    {
        console.log( `  Invalid location '${data.location}'.` );
        return;
    }

    // Validate source account name exists after removing whitespace.
    if( util.validateNonEmptyString( data.sourceAccount, true, res ) ) doc.sourceAccount = data.sourceAccount.trim();
    else
    {
        console.log( `  Invalid source account '${data.sourceAccount}'.` );
        return;
    }

    if( doc.sourceAccount.toLowerCase() === "outside" )
    {
        srcAccountIsOutside = true;
        doc.sourceInstitution = "Outside";
    }
    else
    {
        // Validate source institution name exists after removing whitespace.
        if( util.validateNonEmptyString( data.sourceInstitution, true, res ) ) doc.sourceInstitution = data.sourceInstitution.trim();
        else
        {
            console.log( `  Invalid source institution '${data.sourceInstitution}'.` );
            return;
        }
    }

    // Validate destination account name exists after removing whitespace.
    if( util.validateNonEmptyString( data.destinationAccount, true, res ) ) doc.destinationAccount = data.destinationAccount.trim();
    else
    {
        console.log( `  Invalid destination account '${data.destinationAccount}'.` );
        return;
    }

    if( doc.destinationAccount.toLowerCase() === "outside" )
    {
        if( srcAccountIsOutside )
        {
            // Can't both be outside!
            console.log( "Destination and source accounts are both 'Outside'." ); 
            util.resolveAction( res, 400, { "response" : RESPONSE_CODES.InvalidFormData } );
            return;
        }

        destAccountIsOutside = true;
        doc.destinationInstitution = "Outside";
    }
    else
    {
        // Validate destination institution name exists after removing whitespace.
        if( util.validateNonEmptyString( data.destinationInstitution, true, res ) ) doc.destinationInstitution = data.destinationInstitution.trim();
        else
        {
            console.log( `  Invalid destination institution '${data.destinationInstitution}'.` );
            return;
        }
    }

    // Validate destination account name exists after removing whitespace.
    if( util.validateNonEmptyString( data.tag, true, res ) ) doc.tag = data.tag.trim();
    else
    {
        console.log( `  Invalid tag '${data.tag}'.` );
        return;
    }

    // Validate destination account name exists after removing whitespace.
    if( util.validateDateString( data.date, true, res ) )
    {
        let date = new Date( data.date.trim() )
        doc.date = new Date( Date.UTC( date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() ) );
        // doc.date = data.date.trim();
    }
    else
    {
        console.log( `  Invalid date '${data.date}'.` );
        return;
    }

    // Validate amount exists, is non-negative, and only has two decimal places.
    if( util.validateNonNegativeFloat( data.amount, true, res ) )
    {
        doc.amount = parseFloat( data.amount.trim() );
    }
    else
    {
        console.log( `  Invalid amount '${data.amount}'. ${/^\d+(?:\.\d{0,2})$/.test( data.amount )}` );
        // util.resolveAction( res, 400, { "response" : RESPONSE_CODES.InvalidFormData } );
        return;
    }

    // Check if user marked this is a paycheck transaction.
    // If so, this will spawn other transactions.
    if( data.isPaycheck && data.isPaycheck == true )
    {
        doc.isPaycheck = true;

        let failedParsing = false;
        let gross = 0.0;
        let taxes = 0.0;
        let benefits = 0.0;
        for( let i = 0; i < PAYCHECK_KEYS.length; i++ )
        {
            let k = PAYCHECK_KEYS[ i ];
            if( k.validationFunc( data[ k.key ], k.validationRespond, res ) )
            {
                doc[ k.key ] = k.parseFunc( data[ k.key ] );

                if( k.benefit == true )
                    benefits += doc[ k.key ];
                else if( k.tax == true )
                    taxes += doc[ k.key ];
                else
                    gross += doc[ k.key ];
            }
            else if( k.required == true )
            {
                // Validation failed and value is required.
                console.log( `  Paycheck key ${k.key} failed parsing for input '${data[ k.key ]}'.` );
                if( k.validationRespond == false )
                    util.resolveAction( res, 400, { "response" : RESPONSE_CODES.InvalidFormData } );
                return;
            }
        }

        /**
         * Employer Contribution:
         *  + Taxes
         *  + Benefits (deductions)
         *  + Take-home Pay
         *  - Gross
        **/
        // Ensure 2-digit resolution.
        doc.employerContribution = +(benefits + taxes + doc.amount - gross).toFixed(2);
    }
    else
    {
        doc.isPaycheck = false;
    }


    // Check if there is a description.
    if( data.description && data.description.length < 200 )
    {
        doc.description = data.description.trim();
    }
    else
    {
        doc.description = "";
    }


    // Look for matching username/name/institution for sourceAccount.
    let sourceAccount;
    if( !srcAccountIsOutside )
    {
        sourceAccount = await accounts.getAccount( doc.username, doc.sourceAccount, doc.sourceInstitution );
        if( !sourceAccount )
        {
            console.log( `  Unkonwn source account: ${doc.sourceInstitution}/${doc.sourceAccount}` );
            util.resolveAction( res, 400, { "response": RESPONSE_CODES.InvalidFormData } );
            return;
        }
    }

    // Look for matching username/name/institution for destinationAccount.
    let destinationAccount;
    if( !destAccountIsOutside ) 
    {
        destinationAccount = await accounts.getAccount( doc.username, doc.destinationAccount, doc.destinationInstitution );
        if( !destinationAccount )
        {
            console.log( `  Unkonwn destination account: ${doc.destinationInstitution}/${doc.destinationAccount}` );
            util.resolveAction( res, 400, { "response": RESPONSE_CODES.InvalidFormData } );
            return;
        }
    }


    console.log( `  Creating new transaction for ${doc.username}:\n` +
                 `    Location:            ${doc.location}\n` +
                 `    Source Account:      ${doc.sourceAccount}\n` +
                 `    Destination Account: ${doc.destinationAccount}\n` +
                 `    Amount:              \$${doc.amount}\n` +
                 `    Date:                ${doc.date}\n` +
                 `    Tag:                 ${doc.tag}\n` +
                 `    Is Paycheck:         ${doc.isPaycheck}\n` );
    if( doc.isPaycheck )
    {
        PAYCHECK_KEYS.forEach((k) => {
            if( doc[ k.key ] )
                console.log( `      ${k.key}: ${doc[ k.key ]}` );
        });
        console.log( `      Employer Contribution: ${doc.employerContribution}` );
    }


    // Insert transaction into user transaction list then sort by date and amount.
    query = { username: user.username };
    update = {
        // "$push" : {
        //     "transactions" : {
        //         "$each" : [ doc ],
        //         "$sort" : { "date" : 1, "amount" : 1 }
        //     }
        // }
    };
    options = {};
    // result = await dbLib.updateItem( DB_NAMES.dbName, DB_NAMES.usersCollectionName,
    //     query, update, options );
    result = await dbLib.createNewItem( DB_NAMES.dbName, DB_NAMES.transactionsCollectionName, doc );

    // Move amount from source account (if not outside).
    if( !srcAccountIsOutside &&
        !(result = await accounts.incrementAccountBalance( doc.username, doc.sourceAccount, doc.sourceInstitution, -doc.amount )) )
    {
        console.log( "Error updating source account!" );
        console.log( result );
        util.resolveAction( res, 502, { "response" : RESPONSE_CODES.DatabaseError } );
        return;
    } 

    // Move amount to destination account (if not outside).
    if( !destAccountIsOutside && 
        !(result = await accounts.incrementAccountBalance( doc.username, doc.destinationAccount, doc.destinationInstitution, doc.amount )) )
    {
        console.log( "Error updating destination account!" );
        console.log( result );
        util.resolveAction( res, 502, { "response" : RESPONSE_CODES.DatabaseError } );
        return;
    }


    util.resolveAction( res, 200, { "response" : RESPONSE_CODES.OK } );
    return;
}


async function deleteTransaction( res, req, data )
{
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

    console.log( `Deleting transaction ${data._id} for ${user.username}` );
    let result = await dbLib.getItem(
        DB_NAMES.dbName, DB_NAMES.transactionsCollectionName,
        { "_id": dbLib.createObjectID( data._id ), "username": user.username }
    );

    let srcAccountIsOutside = result.sourceAccount.toLowerCase() === "outside";
    let dstAccountIsOutside = result.destinationAccount.toLowerCase() === "outside";

    // Add money back to source account.
    if( !srcAccountIsOutside )
    {
        let src_result = await accounts.incrementAccountBalance( 
            user.username, result.sourceAccount, 
            result.sourceInstitution, result.amount 
        );
        
        if( !src_result )
        {
            util.resolveAction( res, 500, { response: RESPONSE_CODES.DatabaseError } );
            return;
        }
    }

    // Take money back from destination account.
    if( !dstAccountIsOutside ) 
    {
        let dst_result = await accounts.incrementAccountBalance( 
            user.username, result.destinationAccount, 
            result.destinationInstitution, -result.amount 
        );
        
        if( !dst_result )
        {
            // Failed to update destination account.
            // If we added money to the source account,
            // try to take it back.
            if( !srcAccountIsOutside )
            {
                await accounts.incrementAccountBalance( 
                    user.username, result.sourceAccount, 
                    result.sourceInstitution, -result.amount 
                );
            }
            util.resolveAction( res, 500, { response: RESPONSE_CODES.DatabaseError } );
            return;
        }
    }

    // Delete the transaction.
    result = await dbLib.deleteItem( 
        DB_NAMES.dbName, DB_NAMES.transactionsCollectionName, 
        { "_id": dbLib.createObjectID( data._id ), "username": user.username }    
    );

    // TODO: Check if bad delete was user error (item not existing) or server error.
    if( result.deletedCount != undefined && result.deletedCount == 1 )
    {
        util.resolveAction( res, 200, { response: RESPONSE_CODES.OK } );
    }
    else
    {
        // We failed to delete the transaction. Make an
        // attempt to un-update the account balances.
        if( !srcAccountIsOutside )
        {
            // Take money back from source.
            await accounts.incrementAccountBalance( 
                user.username, result.sourceAccount, 
                result.sourceInstitution, -result.amount 
            );
        }

        if( !dstAccountIsOutside )
        {
            // Add money back to destination.
            await accounts.incrementAccountBalance( 
                user.username, result.destinationAccount, 
                result.destinationInstitution, result.amount 
            );
        }

        util.resolveAction( res, 400, { response: RESPONSE_CODES.MissingData } );
    }

    return;
}
