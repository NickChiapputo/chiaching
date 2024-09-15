export const send = (uri, method, data, successCallback, errorCallback, parseResponse) => {
    let xhr = new XMLHttpRequest();
    xhr.onreadystatechange = function() {
        if( this.readyState == 4 && this.status == 200 )
        {
            try { parseResponse ? successCallback( JSON.parse( this.responseText ) ) : successCallback( this.responseText ); }
            catch(e) { errorCallback( e, this.responseText, this.status ); }
        }
        else if( this.readyState == 4 && this.status != 200 )
        {
            try { errorCallback( null, parseResponse ? JSON.parse( this.responseText ) : this.responseText, this.status ) }
            catch(e) { errorCallback( e, this.responseText, this.status ); }
        }
    }

    xhr.open( method, uri );
    if( method == "POST" && data ) xhr.send( JSON.stringify( data ) );
    else xhr.send();
};