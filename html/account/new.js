import {header} from '/header.js'
import {footer} from '/footer.js'

var newAccountForm = undefined;

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


    newAccountForm = document.getElementById( "newAccountForm" );
    newAccountForm.addEventListener( "submit", sendCreateAccountRequest );


    document.getElementById( "spinner" ).style.display = "none";
    document.getElementById( "contentContainer" ).style.display = "block";
});

function sendCreateAccountRequest( e )
{
    let xmlHttp = new XMLHttpRequest();
    xmlHttp.onreadystatechange = function() {
        if( this.readyState == 4 && this.status == 200 )
        {
            console.log( `Good response!` );

            let response = undefined;
            try
            {
                response = JSON.parse( this.responseText );
            }
            catch( e )
            {
                console.log( "Error parsing response. ${this.responseText}" );
                return;
            }

            console.log( `Response:\n${JSON.stringify( response, null, 4 )}` );

            alert( `Account created!` );
        }
        else if( this.readyState == 4 && this.status != 200 )
        {
            console.log( `Error! HTTP Code: ${this.status}` );

            let response = undefined;
            try
            {
                response = JSON.parse( this.responseText );
            }
            catch( e )
            {
                console.log( "Error parsing response. ${this.responseText}" );
                return;
            }
            console.log( `Response:\n${JSON.stringify( response, null, 4 )}` );

            document.getElementById( "serverResponse" ).innerHTML = `${response.result}`;
            document.getElementById( "serverResponse" ).style.display = "";
            alert( `${response.result}` );
        }
    };

    let data = {};
    new FormData( newAccountForm ).forEach( (val, key) => {
        data[ key ] = val;
    });


    xmlHttp.open( "POST", "/api/auth" );
    xmlHttp.send( JSON.stringify( { 'data': data, 'action': 'create-account' } ) );


    // Don't reload page after submitting.
    e.preventDefault();
    return false;
}

