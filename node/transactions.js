const fs = require( "fs" );
const dbLib = require( "./db.js" );
const util = require( "./util.js" );
const accounts = require( "./accounts.js" );
const mattresses = require( "./mattresses.js" );
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
    edit: editTransaction,
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
            util.resolveAction( res, 400, { response: RESPONSE_CODES.MissingData } );
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


async function getAllTransactions( res, req )
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

    // Check if optional mattress target exists.
    let mattress = undefined;
    if( util.validateNonEmptyString( data.mattress, false ) )
    {
        mattress = await mattresses.getMattress( user.username,
            util.parseStringTrim( data.mattress )
        );
        if( !mattress )
        {
            util.resolveAction( res, 400, {
                response: RESPONSE_CODES.InvalidFormData
            } );
            return;
        }

        doc.mattress = util.parseStringTrim( data.mattress );
    }
    else
    {
        console.log( `Mattress check failed: '${data.mattress}'` );
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
                 `    Mattress:            ${mattress ? mattress.name : ''}\n` +
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



    // Create new transaction.
    query = { username: user.username };
    update = {};
    options = {};
    result = await dbLib.createNewItem( DB_NAMES.dbName,
        DB_NAMES.transactionsCollectionName, doc
    );

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

    // If mattress is specified, update amount.
    if( mattress )
    {
        await mattresses.incrementMattressAmount(
            user.username, mattress.name,
            srcAccountIsOutside ? doc.amount : -doc.amount
        );
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


async function editTransaction( res, req, data )
{
    if( req.method !== "POST" )
    {
        util.resolveAction( res, 405, { response: RESPONSE_CODES.BadMethodPOST } );
        return;
    }

    // Verify user
    let user = await util.checkLoggedIn( res, req );
    if( user === 1 ) return;

    let fields_to_update = {};


    // Get original transaction.
    if( !util.validateNonEmptyString( data._id, true, res ) )
    {
        console.log( `  Invalid transaction _id ${data._id}` );
        return;
    }
    let original_transaction = await dbLib.getItem(
        DB_NAMES.dbName, DB_NAMES.transactionsCollectionName,
        { "_id": dbLib.createObjectID( data._id ) }, {}
    );

    // Verify we got the result and that the user actually owns this transaction.
    if( !original_transaction )
    {
        console.log( `  Transaction ${data._id} doesn't exist` );
        util.resolveAction( res, 400, { response: RESPONSE_CODES.InvalidFormData } );
        return;
    }

    if( original_transaction.username != user.username )
    {
        console.log( `  _id ${data._id} not owned by user` );
        util.resolveAction( res, 400, { response: RESPONSE_CODES.InvalidFormData } );
        return;
    }



    // Verify transaction fields if they exist.
    // Validate location exists after removing whitespace.
    if( util.validateNonEmptyString( data.location, false ) ) fields_to_update.location = data.location.trim();

    // Validate source account name exists after removing whitespace.
    let srcAccountIsOutside = false;
    if( data.sourceAccount )
    {
        if( util.validateNonEmptyString( data.sourceAccount, true, res ) )
        {
            fields_to_update.sourceAccount = data.sourceAccount.trim();
        }
        else
        {
            console.log( `  Invalid source account ${data.sourceAccount.trim()}` );
            return;
        }

        if( fields_to_update.sourceAccount.toLowerCase() === "outside" )
        {
            srcAccountIsOutside = true;
            fields_to_update.sourceInstitution = "Outside";
        }
        else
        {
            // Validate source institution name exists after removing whitespace.
            if( util.validateNonEmptyString( data.sourceInstitution, true, res ) )
            {
                fields_to_update.sourceInstitution = data.sourceInstitution.trim();
            }
            else
            {
                console.log( `  Invalid source institution ${data.sourceInstitution.trim()}` );
                return;
            }
        }
    }

    let destAccountIsOutside = false;
    if( data.destinationAccount )
    {
        // Validate destination account name exists after removing whitespace.
        if( util.validateNonEmptyString( data.destinationAccount, true, res ) )
        {
            fields_to_update.destinationAccount = data.destinationAccount.trim();
        }
        else
        {
            console.log( `  Invalid destination account ${data.destinationAccount.trim()}` );
            return;
        }

        if( fields_to_update.destinationAccount.toLowerCase() === "outside" )
        {
            if( srcAccountIsOutside )
            {
                // Can't both be outside!
                console.log( "Destination and source accounts are both 'Outside'." );
                util.resolveAction( res, 400, { "response" : RESPONSE_CODES.InvalidFormData } );
                return;
            }

            destAccountIsOutside = true;
            fields_to_update.destinationInstitution = "Outside";
        }
        else
        {
            // Validate destination institution name exists after removing whitespace.
            if( util.validateNonEmptyString( data.destinationInstitution, true, res ) )
            {
                fields_to_update.destinationInstitution = data.destinationInstitution.trim();
            }
            else
            {
                console.log( `  Invalid destination institution ${data.destinationInstitution.trim()}` );
                return;
            }
        }
    }

    // Validate tag exists after removing whitespace.
    if( util.validateNonEmptyString( data.tag, false ) ) fields_to_update.tag = data.tag.trim();

    // Validate date.
    if( util.validateDateString( data.date, false ) )
    {
        let date = new Date( data.date.trim() )
        fields_to_update.date = new Date( Date.UTC( date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() ) );
    }

    // Check if optional mattress target exists.
    let mattress = undefined;
    if( util.validateNonEmptyString( data.mattress, false ) )
    {
        mattress = await mattresses.getMattress( user.username,
            util.parseStringTrim( data.mattress )
        );
        if( !mattress )
        {
            util.resolveAction( res, 400, {
                response: RESPONSE_CODES.InvalidFormData
            } );
            return;
        }
    }

    // Validate amount exists, is non-negative, and only has two decimal places.
    if( data.amount )
    {
        if( util.validateNonNegativeFloat( data.amount, true, res ) )
        {
            fields_to_update.amount = parseFloat( data.amount.trim() );
        }
        else
        {
            console.log( `  Invalid amount ${data.amount}` );
            return;
        }
    }


    // Check if there is a description.
    if( data.description && data.description.length < 200 )
        fields_to_update.description = data.description.trim();


    // Look for matching username/name/institution for sourceAccount.
    let sourceAccount;
    if( fields_to_update.sourceAccount && !srcAccountIsOutside )
    {
        sourceAccount = await accounts.getAccount( user.username, fields_to_update.sourceAccount, fields_to_update.sourceInstitution );
        if( !sourceAccount )
        {
            console.log( `  Unkonwn source account: ${fields_to_update.sourceInstitution}/${fields_to_update.sourceAccount}` );
            util.resolveAction( res, 400, { "response": RESPONSE_CODES.InvalidFormData } );
            return;
        }
    }

    // Look for matching username/name/institution for destinationAccount.
    let destinationAccount;
    if( fields_to_update.destinationAccount && !destAccountIsOutside )
    {
        destinationAccount = await accounts.getAccount( user.username, fields_to_update.destinationAccount, fields_to_update.destinationInstitution );
        if( !destinationAccount )
        {
            console.log( `  Unkonwn destination account: ${fields_to_update.destinationInstitution}/${fields_to_update.destinationAccount}` );
            util.resolveAction( res, 400, { "response": RESPONSE_CODES.InvalidFormData } );
            return;
        }
    }


    console.log( "Updates to document:" );
    console.log( JSON.stringify( fields_to_update, null, 2 ) );

    let query = { "_id": dbLib.createObjectID( data._id ) };
    let update = { "$set": fields_to_update };

    // Update transaction
    let result = await dbLib.updateItem( DB_NAMES.dbName,
        DB_NAMES.transactionsCollectionName, query, update, {} );
    console.log( JSON.stringify( result, null, 2 ) );

    if( !result || result.lastErrorObject.n == 0 )
    {
        console.log( `  Update transaction failed with: ${JSON.stringify( result, null, 2 )}` );
        util.resolveAction( res, 502, { "response" : RESPONSE_CODES.DatabaseError } );
        return;
    }

    // If source account or amount has changed, add the original amount back to
    // the original source account. Then subtract the current or new amount
    // from the new source account (or original if unchanged).
    if( fields_to_update.sourceAccount || fields_to_update.amount != undefined )
    {
        // Add original amount back if the original
        // source account was not outside.
        if( original_transaction.sourceAccount.toLowerCase() != "outside" )
        {
            result = await accounts.incrementAccountBalance(
                user.username, original_transaction.sourceAccount,
                original_transaction.sourceInstitution,
                original_transaction.amount
            );

            if( !result )
            {
                console.log( "  Error adding original amount to original source account." );
                console.log( result );
                util.resolveAction( res, 502, { "response" : RESPONSE_CODES.DatabaseError } );
                return;
            }
        }

        // Subtract amount from new account if there is a new account and it is
        // not outside or if there is a new amount.
        if( (!srcAccountIsOutside && fields_to_update.sourceAccount) || fields_to_update.amount != undefined )
        {
            let account, institution, amount;
            if( fields_to_update.sourceAccount )
            {
                account = fields_to_update.sourceAccount;
                institution = fields_to_update.sourceInstitution;
            }
            else
            {
                account = original_transaction.sourceAccount;
                institution = original_transaction.sourceInstitution;
            }

            if( fields_to_update.amount != undefined )
            {
                amount = fields_to_update.amount;
            }
            else
            {
                amount = original_transaction.amount;
            }

            result = await accounts.incrementAccountBalance(
                user.username, account, institution, -amount
            );

            if( !result )
            {
                console.log( "  Error subtracting amount from source account." );
                console.log( result );
                util.resolveAction( res, 502, { "response" : RESPONSE_CODES.DatabaseError } );
                return;
            }
        }
    }

    // If destination account has changed, subtract the original amount back.
    // Then add the current or new amount from the new destination account.
    if( fields_to_update.destinationAccount || fields_to_update.amount != undefined )
    {
        // Subtract original amount if the original destination account was
        // not outside.
        if( original_transaction.destinationAccount.toLowerCase() != "outside" )
        {
            result = await accounts.incrementAccountBalance(
                user.username, original_transaction.destinationAccount,
                original_transaction.destinationInstitution,
                -original_transaction.amount
            );

            if( !result )
            {
                console.log( "  Error subtracting original amount from original destination account." );
                console.log( result );
                util.resolveAction( res, 502, { "response" : RESPONSE_CODES.DatabaseError } );
                return;
            }
        }

        // Add amount (original or new if exists) to new destination account if
        // there is a new one and it is not outside or the original one if there
        // is a new amount.
        if( (!destAccountIsOutside && fields_to_update.destinationAccount) ||
            (fields_to_update.amount != undefined && original_transaction.destinationAccount.toLowerCase() != "outside") )
        {
            let account, institution, amount;
            if( fields_to_update.destinationAccount )
            {
                account = fields_to_update.destinationAccount;
                institution = fields_to_update.destinationInstitution;
            }
            else
            {
                account = original_transaction.destinationAccount;
                institution = original_transaction.destinationInstitution;
            }

            if( fields_to_update.amount )
            {
                amount = fields_to_update.amount;
            }
            else
            {
                amount = original_transaction.amount;
            }

            result = await accounts.incrementAccountBalance(
                user.username, account, institution, amount
            );

            if( !result )
            {
                console.log( "  Error adding amount to destination account." );
                console.log( result );
                util.resolveAction( res, 502, { "response" : RESPONSE_CODES.DatabaseError } );
                return;
            }
        }
    }


    util.resolveAction( res, 200, { response: RESPONSE_CODES.OK } );
    return;
}
