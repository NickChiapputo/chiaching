// Requirements
const MongoDB = require( 'mongodb' );
const MongoClient = MongoDB.MongoClient;
const fs = require( 'fs' );


// Read in config file for secure constants.
var username, password;
try
{
	let content = JSON.parse( fs.readFileSync( 'db_config.json' ) );
	username = content.username;
	password = content.password;
}
catch( e )
{
	console.error( `Unable to read from config file.\n${e}\n \n ` );
}



// Global constants for MongoDB access.
const hostname = 'localhost';
const port = '27017';
const authentication = 'admin';
const dburl = `mongodb://${username}:${password}@${hostname}:${port}?authSource=${authentication}`
const mongoClientOptions = {
   useNewUrlParser: true,
   useUnifiedTopology: true
 };

const hubsDbName = 'hubs';
const hubsOccCollection = 'occupancy';


module.exports = {
    getAllItems: async function( query, options, dbName, collectionName )
    {
        const client = new MongoClient( dburl, mongoClientOptions );

        let result = null;
        try
        {
            await client.connect();

            let collection = client.db( dbName ).collection( collectionName );
            result = await getAllDocuments( query, options, collection );
        }
        catch( err )
        {
            console.error( `${err}` );
        }
        finally
        {
            if( !result )
                console.log( `Error connecting to MongoDB.` );

            client.close();
            return result;
        }
    },

    createNewItem: async function( dbName, collectionName, doc )
    {
        const client = new MongoClient( dburl, mongoClientOptions );

        let result = null;
        try
        {
            await client.connect();

            let collection = client.db( dbName ).collection( collectionName );
            result = await collection.insertOne( doc );
        }
        catch( err )
        {
            console.log( "Unable to create new document." );
            result = err;
        }
        finally
        {
            await client.close();
            return result;
        }
    },

	getItems: async function( dbName, collectionName, query, options )
	{
		const client = new MongoClient( dburl, mongoClientOptions );

		let result = null;
		try
		{
			await client.connect();


			// Retrieve the collection from the database.
			let collection = client.db( dbName ).collection( collectionName );


			result = await getAllDocuments( query, options, collection );
		}
		catch( err )
		{
			console.error( `${err}` );
		}
		finally
		{
			if( !result )
				console.log( `Error connecting to MongoDB.` );
			
			client.close();
			return result;
		}
	},

	getItem: async function( dbName, collectionName, query, options )
	{
		const client = new MongoClient( dburl, mongoClientOptions );

		let result = null;
		try
		{
			await client.connect();


			// Retrieve the collection from the database.
			let collection = client.db( dbName ).collection( collectionName );


			result = await getDocument( query, options, collection );
		}
		catch( err )
		{
			console.error( `${err}` );
		}
		finally
		{
			client.close();
			return result;
		}
	},

	updateItem: async function( dbName, collectionName, query, update, options )
	{
		const client = new MongoClient( dburl, mongoClientOptions );

		let result = null;
		try
		{
			await client.connect();


			// Retrieve the collection from the database.
			let collection = client.db( dbName ).collection( collectionName );

			result = await updateDocument( query, update, options, collection )
		}
		catch( err )
		{
			console.error( `${err}` );
		}
		finally
		{
			if( !result )
				console.log( `Error connecting to MongoDB.` );
			
			client.close();
			return result;
		}
	},

	updateItems: async function( dbName, collectionName, query, update, options )
	{
		const client = new MongoClient( dburl, mongoClientOptions );

		let result = null;
		try
		{
			await client.connect();


			// Retrieve the collection from the database.
			let collection = client.db( dbName ).collection( collectionName );

			result = await updateDocuments( query, update, options, collection )
		}
		catch( err )
		{
			console.error( `${err}` );
		}
		finally
		{
			if( !result )
				console.log( `Error connecting to MongoDB.` );
			
			client.close();
			return result;
		}
	},

	bulkUpdate: async function( dbName, collectionName, bulkUpdate )
	{
		const client = new MongoClient( dburl, mongoClientOptions );

		let result = null;
		try
		{
			await client.connect();


			// Retrieve the collection from the database.
			let collection = client.db( dbName ).collection( collectionName );

			result = await updateManyBulk( bulkUpdate, collection )
		}
		catch( err )
		{
			console.error( `${err}` );
		}
		finally
		{
			if( !result )
				console.log( `Error connecting to MongoDB.` );
			
			client.close();
			return result;
		}
	},

	deleteItem: async function( dbName, collectionName, query, options )
	{
		const client = new MongoClient( dburl, mongoClientOptions );

		let result = null;
		try
		{
			await client.connect();


			// Retrieve the collection from the database.
			let collection = client.db( dbName ).collection( collectionName );

			result = await deleteDocument( query, options, collection )
		}
		catch( err )
		{
			console.error( `${err}` );
		}
		finally
		{
			if( !result )
				console.log( `Error connecting to MongoDB.` );
			
			client.close();
			return result;
		}
	},

	aggregate: async function( dbName, collectionName, pipeline, options )
	{
		const client = new MongoClient( dburl, mongoClientOptions );

		let result = null;
		try
		{
			await client.connect();


			// Retrieve the collection from the database.
			let collection = client.db( dbName ).collection( collectionName );

			result = await aggregate( pipeline, options, collection )
		}
		catch( err )
		{
			console.error( `${err}` );
		}
		finally
		{
			if( !result )
				console.log( `Error connecting to MongoDB.` );
			
			client.close();
			return result;
		}
	},

	getDistinctValuesForField: async function ( dbName, collectionName, key, query, options )
	{
		const client = new MongoClient( dburl, mongoClientOptions );

		let result = null;
		try
		{
			await client.connect();
			let collection = client.db( dbName ).collection( collectionName );

			result = await collection.distinct( key, query, options );
		}
		catch( err )
		{
			console.error( `Distinct: ${err}` );
		}
		finally
		{
			if( !result )
				console.log( `Error connecting to MongoDB.` );
			
			client.close();
			return result;
		}
	},

	createObjectID : function( id )
	{
		return new MongoDB.ObjectId( id );
	},
}


var getCollection = async function( dbName, collectionName )
{
	let collection;

	try
	{
		// Connect client to the server.
		await client.connect();


		// Establish and verify connection.
		collection = await client.db( dbName ).collection( collectionName );
	}
	finally
	{
		await client.close();
	}


	console.log( `Get Collection: ${collection}` );
	return collection;
}


var getAllDocuments = function( query, options, collection )
{
	return collection.find( query, options ).toArray();
}


var getDocument = function( query, options, collection )
{
	return collection.findOne( query, options );
}


var updateDocument = function( query, update, options, collection )
{
	return collection.findOneAndUpdate( query, update, options );
}


var updateDocuments = function( query, update, options, collection )
{
	return collection.updateMany( query, update, options );
}

var deleteDocument = function( query, options, collection )
{
	return collection.deleteOne( query, options );
}

var updateManyBulk = function( bulkUpdate, collection )
{
	return collection.bulkWrite( bulkUpdate );
}

var aggregate = function( pipeline, options, collection )
{
	return collection.aggregate( pipeline, options ).toArray();
}


var getTimeStamp = function()
{
	return new Date().toISOString().substr( 11, 8 );
}
