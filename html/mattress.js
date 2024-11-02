/* Exports */
export const init = () => {
    newMattressForm.addEventListener( "submit", createNewMattress );
    addMattressButton.addEventListener( "click", toggleNewMattressForm );
    getMattresses();
};

export var mattressNames = [];

/* Imports */
import {send} from "/send.js"

/* Local Variables and Functions */
var showNewMattressForm = false;
const addMattressButtonHideText = "+ Add Mattress";
const addMattressButtonShowText = "— Add Mattress";


function getMattresses ()
{
    send( "/api/mattresses/getNames", "GET", null,
        (resp, status) => {
            // Display in mattresses section.
            clearMattresses();
            mattressNames = resp.names;
            mattressNames.forEach( getMattress );

            console.log( `Mattress Names: ${mattressNames}` );
        },
        (e, resp, status) => {
            console.error( e );
            console.log( status, resp );
        },
        true
    );
}

function getMattress(mattressName)
{
    let query = {
        name: mattressName,
    };

    send( "/api/mattresses/get", "POST", query,
        (resp, status) => { displayMattress( resp.mattress ); },
        (e, resp, status) => {
            console.error( e );
            console.log( status, resp );
        },
        true
    );
};

function displayMattress( mattress )
{
    console.log( `${mattress.name}: $${mattress.amount}/$${mattress.maxAmount}` );
}

function createNewMattress(e)
{
    console.log( "Creating new mattress." );

    let data = {
        "name": mattressName.value,
        "maxAmount": mattressMaxAmount.value,
        "amount": mattressInitialAmount.value,
    };

    send(
        "/api/mattresses/new", "POST", data,
        (resp, status) => { console.log( resp ); },
        (e, resp, status) => {
            console.error( e );
            console.log( status, resp );
        },
        true
    );

    // Don't reload page after submitting.
    e.preventDefault();
    return false;
}

function clearMattresses()
{
    mattressList.innerHTML = '';
}

function toggleNewMattressForm(e)
{
    showNewMattressForm = !showNewMattressForm;

    newMattressForm.style.display = showNewMattressForm ? "" : "none";
    addMattressButton.innerHTML = showNewMattressForm ? addMattressButtonShowText : addMattressButtonHideText;
}