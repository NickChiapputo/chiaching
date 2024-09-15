import {header} from '/header.js'
import {footer} from '/footer.js'

var redirURL = undefined;

document.addEventListener( "DOMContentLoaded", (e) => {
    document.getElementById( "header" ).outerHTML = header;
    document.getElementById( "footer" ).outerHTML = footer;

    for( var navItem of document.getElementById( "menubar" ).children )
    {
        // let navItem = navItems[ i ];
        if( navItem.children[ 0 ].href == window.location.href )
        {
            navItem.classList.add( "selected" );
            break;
        }
    }


    loginForm.addEventListener( "submit", sendLoginRequest );

    // Get the query key-value parameters
    // from the url and remove the leading '?'.
    let query = location.search.substr(1);

    // Create a JSON object to hold the
    // key-value pairs from the URL.
    let result = {};
    query.split( '&' ).forEach( function(part) {
        let item = part.split( '=' );
        result[ item[ 0 ] ] = decodeURIComponent( item[ 1 ] );
    } );

    if( result.redir_url )
    {
        redirURL = result.redir_url;
    }
    else
    {
        redirURL = "/";
    }


    document.getElementById( "spinner" ).style.display = "none";
    document.getElementById( "contentContainer" ).style.display = "block";
});

const sendLoginRequest = ( e ) => {
    var xmlHttp = new XMLHttpRequest();
    xmlHttp.onreadystatechange = function() {
        if( this.readyState == 4 && this.status == 200 )
        {
            window.location.href = redirURL;
        }
        else if( this.readyState == 4 && this.status != 200 )
        {
            console.log( `Error! HTTP Code: ${this.status}` );
        }
    };

    let data = {};
    new FormData( loginForm ).forEach( (val, key) => {
        data[ key ] = val;
    });


    xmlHttp.open( "POST", "/api/user/login" );
    xmlHttp.send( JSON.stringify( data ) );


    // Don't reload page after submitting.
    e.preventDefault();
    return false;
};

