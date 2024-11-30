export const send = (uri, method, data, successCallback, errorCallback, parseResponse) => {
    return new Promise((resolve, reject) => {
        let xhr = new XMLHttpRequest();
        xhr.onreadystatechange = function() {
            if( this.readyState == 4 && this.status == 200 )
            {
                try {
                    let result = parseResponse ?
                        JSON.parse( this.responseText ) :
                        this.responseText;
                    successCallback( result );
                    resolve( result );
                } catch(e) {
                    errorCallback( e, this.responseText, this.status );
                    reject({error: e, status: this.status});
                }
            }
            else if( this.readyState == 4 && this.status != 200 )
            {
                try {
                    let result = parseResponse ?
                        JSON.parse( this.responseText ) :
                        this.responseText;
                    errorCallback( null, result, this.status );
                    reject({status: this.status});
                } catch(e) {
                    errorCallback( e, this.responseText, this.status );
                    reject({error: e, status: this.status});
                }
            }
        }

        xhr.open( method, uri );
        if( method == "POST" && data ) xhr.send( JSON.stringify( data ) );
        else xhr.send();
    });
};
